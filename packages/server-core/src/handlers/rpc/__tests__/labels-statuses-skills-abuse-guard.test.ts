/**
 * M.13 T086c — TokenBucket + BudgetGuard wiring for additional
 * mutating RPC handlers (`labels.create`, `labels.delete`,
 * `statuses.reorder`, `skills.delete`).
 *
 * Mirrors the T071b/T071c/T086b pattern in
 * `roles-rate-limit.test.ts` and `missions-rate-limit.test.ts`:
 *
 *  - The gates run BEFORE input validation and BEFORE the filesystem
 *    operation, so a rate-limited / budget-exhausted call returns the
 *    typed `{error, reason}` envelope without touching the workspace
 *    storage at all. This lets the tests assert the gate contract
 *    without needing real workspace fixtures.
 *  - Backward compatibility: when no `rateLimiter` and no `budgetGuard`
 *    are injected, the handler proceeds past the gate into the existing
 *    validation/storage path. We verify that path is unchanged by
 *    asserting it still surfaces the original `Workspace not found`
 *    error for an unknown workspace id.
 */

import { describe, expect, it } from 'bun:test'
import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import { BudgetGuard, TokenBucket } from '@rox-one/shared/security'
import type {
  HandlerFn,
  RequestContext,
  RpcServer,
} from '@rox-one/server-core/transport'

import type { HandlerDeps } from '../../handler-deps'
import { registerLabelsHandlers } from '../labels'
import { registerStatusesHandlers } from '../statuses'
import { registerSkillsHandlers } from '../skills'

const LIMITED = { error: 'rate-limited', reason: 'token-bucket-exhausted' }
const BUDGET_EXCEEDED = { error: 'budget-exceeded', reason: 'per-actor-cap-exhausted' }

interface Harness {
  handlers: Map<string, HandlerFn>
  bucket: TokenBucket | undefined
  budgetGuard: BudgetGuard<string> | undefined
  tick(ms: number): void
}

function createHarness(opts: {
  bucketCapacity?: number
  bucketRefillPerSec?: number
  withLimiter?: boolean
  budgetPerKey?: number
} = {}): Harness {
  const handlers = new Map<string, HandlerFn>()
  const server: RpcServer = {
    handle: (channel, handler) => { handlers.set(channel, handler) },
    push: () => {},
    invokeClient: async () => undefined,
  }

  let nowMs = 0
  const bucket = opts.withLimiter
    ? new TokenBucket({
        capacity: opts.bucketCapacity ?? 3,
        refillRatePerSec: opts.bucketRefillPerSec ?? 0,
        clock: () => nowMs,
      })
    : undefined

  const budgetGuard = opts.budgetPerKey !== undefined
    ? new BudgetGuard<string>({ budgetPerKey: opts.budgetPerKey })
    : undefined

  const deps: HandlerDeps = {
    sessionManager: {} as HandlerDeps['sessionManager'],
    oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
    rateLimiter: bucket,
    budgetGuard,
    platform: {
      appRootPath: '/', resourcesPath: '/', isPackaged: false, appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      imageProcessor: { getMetadata: async () => null, process: async () => Buffer.from('') },
    } as HandlerDeps['platform'],
  }

  registerLabelsHandlers(server, deps)
  registerStatusesHandlers(server, deps)
  registerSkillsHandlers(server, deps)

  return { handlers, bucket, budgetGuard, tick(ms) { nowMs += ms } }
}

function ctxFor(userId: string | null): RequestContext {
  return {
    clientId: 'c1',
    workspaceId: null,
    webContentsId: null,
    userId,
    sessionId: 's1',
  }
}

// Fixture payloads — never actually persisted because the gate short-circuits
// the handler before workspace lookup.
const SAMPLE_LABEL_INPUT = { name: 'green', color: '#00ff00' }
const SAMPLE_ORDERED_IDS = ['s1', 's2', 's3']
const SAMPLE_SLUG = 'my-skill'

// ============================================================================
// labels.create — TokenBucket + BudgetGuard
// ============================================================================

describe('labels.create — TokenBucket rate-limit (T086c)', () => {
  it('allows up to `capacity` creates in a burst, then rate-limits subsequent attempts', async () => {
    const h = createHarness({ bucketCapacity: 2, bucketRefillPerSec: 0, withLimiter: true })
    const create = h.handlers.get(RPC_CHANNELS.labels.CREATE)!

    // First 2 consume tokens. They will fail at workspace lookup with
    // `Workspace not found` (no real fixture), but the token was spent.
    await expect(create(ctxFor('admin'), 'ws-x', SAMPLE_LABEL_INPUT)).rejects.toThrow(/Workspace not found/)
    await expect(create(ctxFor('admin'), 'ws-x', SAMPLE_LABEL_INPUT)).rejects.toThrow(/Workspace not found/)

    // Bucket now empty — next call short-circuits with the typed envelope
    // and never touches the workspace lookup.
    expect(await create(ctxFor('admin'), 'ws-x', SAMPLE_LABEL_INPUT)).toEqual(LIMITED)
    expect(await create(ctxFor('admin'), 'ws-x', SAMPLE_LABEL_INPUT)).toEqual(LIMITED)
  })

  it('rate-limit fires BEFORE validation (malformed input still drains the bucket)', async () => {
    // Bucket of 1; first call burns the token despite a malformed
    // workspace id (parseId would normally throw). Second call must
    // return the typed rate-limited envelope, NOT an invalid-argument
    // throw — proving the gate ran first.
    const h = createHarness({ bucketCapacity: 1, bucketRefillPerSec: 0, withLimiter: true })
    const create = h.handlers.get(RPC_CHANNELS.labels.CREATE)!

    // First call burns the token. The handler attempts validation
    // afterwards and throws on the empty workspaceId.
    await expect(create(ctxFor('admin'), '', SAMPLE_LABEL_INPUT)).rejects.toThrow()

    // Bucket empty — second call must return the envelope and NOT throw.
    expect(await create(ctxFor('admin'), '', SAMPLE_LABEL_INPUT)).toEqual(LIMITED)
  })

  it('refills tokens after the clock advances, restoring throughput', async () => {
    const h = createHarness({ bucketCapacity: 1, bucketRefillPerSec: 1, withLimiter: true })
    const create = h.handlers.get(RPC_CHANNELS.labels.CREATE)!

    // Burn the only token.
    await expect(create(ctxFor('admin'), 'ws-x', SAMPLE_LABEL_INPUT)).rejects.toThrow(/Workspace not found/)
    expect(await create(ctxFor('admin'), 'ws-x', SAMPLE_LABEL_INPUT)).toEqual(LIMITED)

    // 2s @ 1 token/s — bucket refilled to capacity.
    h.tick(2000)
    // Token available — handler runs through, fails at workspace lookup.
    await expect(create(ctxFor('admin'), 'ws-x', SAMPLE_LABEL_INPUT)).rejects.toThrow(/Workspace not found/)
  })
})

describe('labels.create — BudgetGuard per-actor cap (T086c)', () => {
  it('budget exhaustion returns the typed envelope and stops at the gate', async () => {
    // Per-actor cap of 1 with no token-bucket. First call consumes the
    // budget (and fails at workspace lookup). Second call must return
    // the budget-exceeded envelope — handler never reaches workspace
    // lookup.
    const h = createHarness({ budgetPerKey: 1 })
    const create = h.handlers.get(RPC_CHANNELS.labels.CREATE)!

    await expect(create(ctxFor('admin'), 'ws-x', SAMPLE_LABEL_INPUT)).rejects.toThrow(/Workspace not found/)
    expect(await create(ctxFor('admin'), 'ws-x', SAMPLE_LABEL_INPUT)).toEqual(BUDGET_EXCEEDED)
    expect(h.budgetGuard!.usage('admin')).toBe(1)
  })

  it('different actor IDs have isolated budgets', async () => {
    const h = createHarness({ budgetPerKey: 1 })
    const create = h.handlers.get(RPC_CHANNELS.labels.CREATE)!

    // admin1 burns their cap (filesystem failure absorbed below).
    await expect(create(ctxFor('admin1'), 'ws-x', SAMPLE_LABEL_INPUT)).rejects.toThrow(/Workspace not found/)
    expect(await create(ctxFor('admin1'), 'ws-x', SAMPLE_LABEL_INPUT)).toEqual(BUDGET_EXCEEDED)

    // admin2 is unaffected.
    await expect(create(ctxFor('admin2'), 'ws-x', SAMPLE_LABEL_INPUT)).rejects.toThrow(/Workspace not found/)
    expect(await create(ctxFor('admin2'), 'ws-x', SAMPLE_LABEL_INPUT)).toEqual(BUDGET_EXCEEDED)
    expect(h.budgetGuard!.usage('admin1')).toBe(1)
    expect(h.budgetGuard!.usage('admin2')).toBe(1)
  })
})

// ============================================================================
// labels.delete — shared budget with labels.create
// ============================================================================

describe('labels.delete — TokenBucket + BudgetGuard (T086c)', () => {
  it('shares the rate-limiter bucket with labels.create so create + delete bursts cannot bypass the cap', async () => {
    // Capacity 1 — one mutation across either channel exhausts the
    // bucket. Both subsequent calls must return the same typed
    // rate-limit envelope regardless of which channel.
    const h = createHarness({ bucketCapacity: 1, bucketRefillPerSec: 0, withLimiter: true })
    const create = h.handlers.get(RPC_CHANNELS.labels.CREATE)!
    const del = h.handlers.get(RPC_CHANNELS.labels.DELETE)!

    // First create burns the token.
    await expect(create(ctxFor('admin'), 'ws-x', SAMPLE_LABEL_INPUT)).rejects.toThrow(/Workspace not found/)
    // Bucket empty — both channels short-circuit.
    expect(await create(ctxFor('admin'), 'ws-x', SAMPLE_LABEL_INPUT)).toEqual(LIMITED)
    expect(await del(ctxFor('admin'), 'ws-x', 'some-label-id')).toEqual(LIMITED)
  })

  it('shares the per-actor budget with labels.create', async () => {
    // Cap 2. One create + one delete consumes the whole budget. Third
    // mutation must return the budget envelope no matter which channel.
    const h = createHarness({ budgetPerKey: 2 })
    const create = h.handlers.get(RPC_CHANNELS.labels.CREATE)!
    const del = h.handlers.get(RPC_CHANNELS.labels.DELETE)!

    await expect(create(ctxFor('admin'), 'ws-x', SAMPLE_LABEL_INPUT)).rejects.toThrow(/Workspace not found/)
    await expect(del(ctxFor('admin'), 'ws-x', 'some-label-id')).rejects.toThrow(/Workspace not found/)
    expect(await create(ctxFor('admin'), 'ws-x', SAMPLE_LABEL_INPUT)).toEqual(BUDGET_EXCEEDED)
    expect(await del(ctxFor('admin'), 'ws-x', 'some-label-id')).toEqual(BUDGET_EXCEEDED)
    expect(h.budgetGuard!.usage('admin')).toBe(2)
  })
})

// ============================================================================
// statuses.reorder — TokenBucket + BudgetGuard
// ============================================================================

describe('statuses.reorder — TokenBucket rate-limit (T086c)', () => {
  it('allows up to `capacity` reorders in a burst, then rate-limits', async () => {
    const h = createHarness({ bucketCapacity: 2, bucketRefillPerSec: 0, withLimiter: true })
    const reorder = h.handlers.get(RPC_CHANNELS.statuses.REORDER)!

    await expect(reorder(ctxFor('admin'), 'ws-x', SAMPLE_ORDERED_IDS)).rejects.toThrow(/Workspace not found/)
    await expect(reorder(ctxFor('admin'), 'ws-x', SAMPLE_ORDERED_IDS)).rejects.toThrow(/Workspace not found/)
    expect(await reorder(ctxFor('admin'), 'ws-x', SAMPLE_ORDERED_IDS)).toEqual(LIMITED)
  })
})

describe('statuses.reorder — BudgetGuard per-actor cap (T086c)', () => {
  it('budget exhaustion returns the typed envelope', async () => {
    const h = createHarness({ budgetPerKey: 1 })
    const reorder = h.handlers.get(RPC_CHANNELS.statuses.REORDER)!

    await expect(reorder(ctxFor('admin'), 'ws-x', SAMPLE_ORDERED_IDS)).rejects.toThrow(/Workspace not found/)
    expect(await reorder(ctxFor('admin'), 'ws-x', SAMPLE_ORDERED_IDS)).toEqual(BUDGET_EXCEEDED)
    expect(h.budgetGuard!.usage('admin')).toBe(1)
  })

  it('reset restores the per-actor budget', async () => {
    const h = createHarness({ budgetPerKey: 1 })
    const reorder = h.handlers.get(RPC_CHANNELS.statuses.REORDER)!

    await expect(reorder(ctxFor('admin'), 'ws-x', SAMPLE_ORDERED_IDS)).rejects.toThrow(/Workspace not found/)
    expect(await reorder(ctxFor('admin'), 'ws-x', SAMPLE_ORDERED_IDS)).toEqual(BUDGET_EXCEEDED)

    h.budgetGuard!.reset('admin')
    // Budget restored — next call proceeds past the gate.
    await expect(reorder(ctxFor('admin'), 'ws-x', SAMPLE_ORDERED_IDS)).rejects.toThrow(/Workspace not found/)
    expect(h.budgetGuard!.usage('admin')).toBe(1)
  })
})

// ============================================================================
// skills.delete — TokenBucket + BudgetGuard
// ============================================================================

describe('skills.delete — TokenBucket rate-limit (T086c)', () => {
  it('rate-limit fires BEFORE validation (malformed slug still drains the bucket)', async () => {
    const h = createHarness({ bucketCapacity: 1, bucketRefillPerSec: 0, withLimiter: true })
    const del = h.handlers.get(RPC_CHANNELS.skills.DELETE)!

    // Empty slug normally fails parseSlug — but the gate runs first and
    // burns the token.
    await expect(del(ctxFor('admin'), 'ws-x', '')).rejects.toThrow()
    // Bucket empty — second call short-circuits with the typed envelope.
    expect(await del(ctxFor('admin'), 'ws-x', SAMPLE_SLUG)).toEqual(LIMITED)
  })
})

describe('skills.delete — BudgetGuard per-actor cap (T086c)', () => {
  it('budget exhaustion returns the typed envelope and isolates per-actor', async () => {
    const h = createHarness({ budgetPerKey: 1 })
    const del = h.handlers.get(RPC_CHANNELS.skills.DELETE)!

    // admin1 burns the cap.
    await expect(del(ctxFor('admin1'), 'ws-x', SAMPLE_SLUG)).rejects.toThrow(/Workspace not found/)
    expect(await del(ctxFor('admin1'), 'ws-x', SAMPLE_SLUG)).toEqual(BUDGET_EXCEEDED)
    // admin2 unaffected.
    await expect(del(ctxFor('admin2'), 'ws-x', SAMPLE_SLUG)).rejects.toThrow(/Workspace not found/)
    expect(h.budgetGuard!.usage('admin1')).toBe(1)
    expect(h.budgetGuard!.usage('admin2')).toBe(1)
  })
})

// ============================================================================
// Backward-compatibility — no gates wired
// ============================================================================

describe('T086c — backward compatibility', () => {
  it('no rateLimiter and no budgetGuard => handler reaches workspace lookup (no abuse-guard envelopes)', async () => {
    const h = createHarness({})
    expect(h.bucket).toBeUndefined()
    expect(h.budgetGuard).toBeUndefined()

    const create = h.handlers.get(RPC_CHANNELS.labels.CREATE)!
    const del = h.handlers.get(RPC_CHANNELS.labels.DELETE)!
    const reorder = h.handlers.get(RPC_CHANNELS.statuses.REORDER)!
    const skillDel = h.handlers.get(RPC_CHANNELS.skills.DELETE)!

    // Each handler proceeds past the (absent) gate and throws the
    // original `Workspace not found` error — the gate is invisible.
    await expect(create(ctxFor('admin'), 'ws-x', SAMPLE_LABEL_INPUT)).rejects.toThrow(/Workspace not found/)
    await expect(del(ctxFor('admin'), 'ws-x', 'lbl-1')).rejects.toThrow(/Workspace not found/)
    await expect(reorder(ctxFor('admin'), 'ws-x', SAMPLE_ORDERED_IDS)).rejects.toThrow(/Workspace not found/)
    await expect(skillDel(ctxFor('admin'), 'ws-x', SAMPLE_SLUG)).rejects.toThrow(/Workspace not found/)
  })

  it('null userId falls back to the anonymous sentinel for per-actor budgets', async () => {
    const h = createHarness({ budgetPerKey: 1 })
    const create = h.handlers.get(RPC_CHANNELS.labels.CREATE)!

    // First anonymous call consumes the cap.
    await expect(create(ctxFor(null), 'ws-x', SAMPLE_LABEL_INPUT)).rejects.toThrow(/Workspace not found/)
    // Second anonymous call hits the budget envelope.
    expect(await create(ctxFor(null), 'ws-x', SAMPLE_LABEL_INPUT)).toEqual(BUDGET_EXCEEDED)
    expect(h.budgetGuard!.usage('__anonymous__')).toBe(1)
  })
})
