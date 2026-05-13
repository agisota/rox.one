/**
 * T071c: TokenBucket rate-limit wiring in `missions.dispatchEvent`.
 * Mirrors the T071b pattern in `roles-rate-limit.test.ts`. Broader
 * mission RPC matrix lives in `missions-rpc.test.ts`.
 */

import { describe, expect, it } from 'bun:test'
import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import {
  InMemoryGrantStore,
  RbacResolver,
  type RoleGrant,
} from '@rox-one/shared/auth'
import { BudgetGuard, TokenBucket } from '@rox-one/shared/security'
import type {
  HandlerFn,
  RequestContext,
  RpcServer,
} from '@rox-one/server-core/transport'

import type { HandlerDeps } from '../../handler-deps'
import {
  InMemoryMissionStore,
  MissionScheduler,
  type UuidGenerator,
} from '../../../missions'
import { unsafeMissionId } from '../../../missions/mission-id.ts'
import { registerMissionsCoreHandlers } from '../missions'

const WORKSPACE_A = 'W_A'

function fakeUuidGen(): UuidGenerator {
  let i = 0
  return () => {
    i += 1
    const hex = i.toString(16).padStart(12, '0')
    return unsafeMissionId(`01977a3b-5c4d-7abc-9def-${hex}`)
  }
}

interface Harness {
  handlers: Map<string, HandlerFn>
  scheduler: MissionScheduler
  bucket: TokenBucket | undefined
  budgetGuard: BudgetGuard<string> | undefined
  tick(ms: number): void
}

function userGrant(
  actorId: string, scopeKind: RoleGrant['scopeKind'], scopeId: string | null, roleId: string,
): RoleGrant {
  return { roleId, actorKind: 'user', actorId, scopeKind, scopeId }
}

function createHarness(opts: {
  initialGrants?: ReadonlyArray<RoleGrant>
  bucketCapacity?: number
  bucketRefillPerSec?: number
  withLimiter?: boolean
  budgetPerKey?: number
} = {}): Harness {
  const handlers = new Map<string, HandlerFn>()
  const server: RpcServer = {
    handle: (channel, handler) => { handlers.set(channel, handler) },
    push: () => {}, invokeClient: async () => undefined,
  }

  let n = Date.parse('2026-05-14T00:00:00.000Z')
  const clock = { now: () => new Date(n).toISOString() }
  const scheduler = new MissionScheduler({
    store: new InMemoryMissionStore(), clock, uuid: fakeUuidGen(),
  })

  let nowMs = 0
  const resolver = new RbacResolver(new InMemoryGrantStore(opts.initialGrants ?? []))
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
    rbacResolver: resolver, missionScheduler: scheduler, rateLimiter: bucket,
    budgetGuard,
    platform: {
      appRootPath: '/', resourcesPath: '/', isPackaged: false, appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      imageProcessor: { getMetadata: async () => null, process: async () => Buffer.from('') },
    } as HandlerDeps['platform'],
  }

  registerMissionsCoreHandlers(server, deps)
  return { handlers, scheduler, bucket, budgetGuard, tick(ms) { nowMs += ms } }
}

function ctxFor(
  userId: string | null,
  workspaceId: string | null = WORKSPACE_A,
): RequestContext {
  return { clientId: 'c1', workspaceId, webContentsId: null, userId, sessionId: 's1' }
}

const LIMITED = { error: 'rate-limited', reason: 'token-bucket-exhausted' }
const BUDGET_EXCEEDED = { error: 'budget-exceeded', reason: 'per-actor-cap-exhausted' }

describe('missions.dispatchEvent — TokenBucket rate-limit (T071c)', () => {
  it('allows up to `capacity` dispatches in a burst, then rate-limits subsequent attempts', async () => {
    // Mint 5 distinct missions so each Start hits a fresh Pending
    // mission — the rate-limit gate stops the burst, not an
    // illegal-transition collision.
    const h = createHarness({
      initialGrants: [userGrant('admin', 'global', null, 'owner')],
      bucketCapacity: 2, bucketRefillPerSec: 0, withLimiter: true,
    })
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!

    const minted: string[] = []
    for (let i = 0; i < 5; i++) {
      const r = await create(ctxFor('admin'))
      minted.push(r.mission.id)
    }

    const results: unknown[] = []
    for (const id of minted) {
      results.push(await dispatch(ctxFor('admin'), { id, event: { kind: 'Start' } }))
    }

    expect(results.filter((r) => (r as { ok?: boolean }).ok === true).length).toBe(2)
    expect(results.filter((r) => (r as { error?: string }).error === 'rate-limited').length).toBe(3)
    expect((results[0] as { ok?: boolean }).ok).toBe(true)
    expect((results[1] as { ok?: boolean }).ok).toBe(true)
    expect(results[2]).toEqual(LIMITED)
    expect(results[4]).toEqual(LIMITED)

    // Rate-limited dispatches must NOT mutate state.
    const m3 = await h.scheduler.get(minted[2] as never)
    const m5 = await h.scheduler.get(minted[4] as never)
    expect(m3?.state.kind).toBe('Pending')
    expect(m5?.state.kind).toBe('Pending')
  })

  it('rate-limit fires BEFORE permission/validation (drains tokens on rejected requests)', async () => {
    // Caller has no owner grant. Bucket still drains so abuse traffic
    // with malformed/unauth payloads cannot bypass the limit.
    const h = createHarness({
      bucketCapacity: 2, bucketRefillPerSec: 0, withLimiter: true,
    })
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!
    const ghost = unsafeMissionId('01977a3b-5c4d-7abc-9def-deadbeefcafe')

    expect(await dispatch(ctxFor('u1'), { id: ghost, event: { kind: 'Start' } }))
      .toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
    expect(await dispatch(ctxFor('u1'), { id: ghost, event: { kind: 'Start' } }))
      .toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
    // Bucket now empty — next call is rate-limited, not permission-denied.
    expect(await dispatch(ctxFor('u1'), { id: ghost, event: { kind: 'Start' } }))
      .toEqual(LIMITED)
  })

  it('refills tokens after the clock advances, restoring throughput', async () => {
    const h = createHarness({
      initialGrants: [userGrant('admin', 'global', null, 'owner')],
      bucketCapacity: 1, bucketRefillPerSec: 1, withLimiter: true,
    })
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!

    const m1 = await create(ctxFor('admin'))
    const m2 = await create(ctxFor('admin'))

    expect((await dispatch(ctxFor('admin'), { id: m1.mission.id, event: { kind: 'Start' } })).ok).toBe(true)
    expect(await dispatch(ctxFor('admin'), { id: m2.mission.id, event: { kind: 'Start' } })).toEqual(LIMITED)

    h.tick(2000)
    expect((await dispatch(ctxFor('admin'), { id: m2.mission.id, event: { kind: 'Start' } })).ok).toBe(true)
  })
})

describe('missions.dispatchEvent — backward compatibility (T071c)', () => {
  it('no rate-limiter => unbounded dispatches succeed', async () => {
    const h = createHarness({
      initialGrants: [userGrant('admin', 'global', null, 'owner')],
      withLimiter: false,
    })
    expect(h.bucket).toBeUndefined()
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!

    for (let i = 0; i < 10; i++) {
      const r = await create(ctxFor('admin'))
      const d = await dispatch(ctxFor('admin'), { id: r.mission.id, event: { kind: 'Start' } })
      expect(d.ok).toBe(true)
    }
  })
})

describe('missions.dispatchEvent — BudgetGuard per-actor cap (T086b)', () => {
  it('budget exhaustion returns budget-exceeded after the per-actor cap', async () => {
    // Per-actor cap of 2 with no token-bucket. The first two dispatches
    // succeed; the third returns the budget-exceeded envelope and must
    // not mutate the mission state.
    const h = createHarness({
      initialGrants: [userGrant('admin', 'global', null, 'owner')],
      budgetPerKey: 2,
    })
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!

    const m1 = await create(ctxFor('admin'))
    const m2 = await create(ctxFor('admin'))
    const m3 = await create(ctxFor('admin'))

    expect((await dispatch(ctxFor('admin'), { id: m1.mission.id, event: { kind: 'Start' } })).ok).toBe(true)
    expect((await dispatch(ctxFor('admin'), { id: m2.mission.id, event: { kind: 'Start' } })).ok).toBe(true)
    expect(await dispatch(ctxFor('admin'), { id: m3.mission.id, event: { kind: 'Start' } }))
      .toEqual(BUDGET_EXCEEDED)

    // Rejected dispatch leaves the mission Pending.
    const rec = await h.scheduler.get(m3.mission.id as never)
    expect(rec?.state.kind).toBe('Pending')
    expect(h.budgetGuard!.usage('admin')).toBe(2)
  })

  it('different actor IDs have isolated budgets', async () => {
    // Two global owners with cap 1 each. Both can land one dispatch
    // before either is gated.
    const h = createHarness({
      initialGrants: [
        userGrant('admin1', 'global', null, 'owner'),
        userGrant('admin2', 'global', null, 'owner'),
      ],
      budgetPerKey: 1,
    })
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!

    const m1 = await create(ctxFor('admin1'))
    const m2 = await create(ctxFor('admin2'))
    const m3 = await create(ctxFor('admin1'))
    const m4 = await create(ctxFor('admin2'))

    expect((await dispatch(ctxFor('admin1'), { id: m1.mission.id, event: { kind: 'Start' } })).ok).toBe(true)
    expect((await dispatch(ctxFor('admin2'), { id: m2.mission.id, event: { kind: 'Start' } })).ok).toBe(true)
    expect(await dispatch(ctxFor('admin1'), { id: m3.mission.id, event: { kind: 'Start' } }))
      .toEqual(BUDGET_EXCEEDED)
    expect(await dispatch(ctxFor('admin2'), { id: m4.mission.id, event: { kind: 'Start' } }))
      .toEqual(BUDGET_EXCEEDED)
    expect(h.budgetGuard!.usage('admin1')).toBe(1)
    expect(h.budgetGuard!.usage('admin2')).toBe(1)
  })

  it('reset restores the per-actor budget', async () => {
    // After exhaustion, `BudgetGuard.reset(key)` zeroes that actor's
    // usage and subsequent dispatches succeed again.
    const h = createHarness({
      initialGrants: [userGrant('admin', 'global', null, 'owner')],
      budgetPerKey: 1,
    })
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!

    const m1 = await create(ctxFor('admin'))
    const m2 = await create(ctxFor('admin'))

    expect((await dispatch(ctxFor('admin'), { id: m1.mission.id, event: { kind: 'Start' } })).ok).toBe(true)
    expect(await dispatch(ctxFor('admin'), { id: m2.mission.id, event: { kind: 'Start' } }))
      .toEqual(BUDGET_EXCEEDED)

    h.budgetGuard!.reset('admin')
    expect((await dispatch(ctxFor('admin'), { id: m2.mission.id, event: { kind: 'Start' } })).ok).toBe(true)
    expect(h.budgetGuard!.usage('admin')).toBe(1)
  })

  it('backward-compat: no budgetGuard => no error', async () => {
    // The handler must behave identically to the pre-T086b baseline
    // when no guard is wired. 10 create+dispatch cycles all succeed.
    const h = createHarness({ initialGrants: [userGrant('admin', 'global', null, 'owner')] })
    expect(h.budgetGuard).toBeUndefined()
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!

    for (let i = 0; i < 10; i++) {
      const r = await create(ctxFor('admin'))
      expect((await dispatch(ctxFor('admin'), { id: r.mission.id, event: { kind: 'Start' } })).ok).toBe(true)
    }
  })
})
