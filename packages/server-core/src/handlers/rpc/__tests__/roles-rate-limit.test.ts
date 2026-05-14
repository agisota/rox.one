/**
 * T071b: TokenBucket rate-limit wiring in the RBAC admin RPC handlers.
 * Scoped to rate-limit side-effects; broader matrix lives in `roles.test.ts`.
 */

import { describe, expect, it } from 'bun:test'
import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import {
  InMemoryGrantStore, InMemoryRoleStore, RbacResolver, type RoleGrant,
} from '@rox-one/shared/auth'
import { BudgetGuard, TokenBucket } from '@rox-one/shared/security'
import {
  type AuditEvent, type AuditSink, createAuditProducer, createStructuredLogger,
} from '@rox-one/shared/observability'
import type { RpcServer, HandlerFn, RequestContext } from '@rox-one/server-core/transport'
import type { HandlerDeps } from '../../handler-deps'
import { registerRolesCoreHandlers } from '../roles'

const FIXED_NOW = new Date('2026-05-13T12:00:00.000Z')
const fixedClock = (): Date => FIXED_NOW

interface Harness {
  handlers: Map<string, HandlerFn>
  grantStore: InMemoryGrantStore
  audit: AuditEvent[]
  bucket: TokenBucket | undefined
  budgetGuard: BudgetGuard<string> | undefined
  tick(ms: number): void
}

function createHarness(opts: {
  initialGrants?: ReadonlyArray<RoleGrant>
  bucketCapacity?: number
  bucketRefillPerSec?: number
  withLimiter?: boolean
  withAudit?: boolean
  budgetPerKey?: number
} = {}): Harness {
  const handlers = new Map<string, HandlerFn>()
  const server: RpcServer = {
    handle: (c, h) => { handlers.set(c, h) },
    push: () => {},
    invokeClient: async () => undefined,
  }

  let nowMs = 0
  const bucketClock = () => nowMs

  const audit: AuditEvent[] = []
  const sink: AuditSink = (e) => { audit.push(e) }
  const logger = createStructuredLogger({ sink: () => {}, threshold: 'trace', clock: fixedClock })
  const auditProducer = opts.withAudit
    ? createAuditProducer({ sink, logger, clock: fixedClock })
    : undefined

  const grantStore = new InMemoryGrantStore(opts.initialGrants ?? [])
  const roleStore = new InMemoryRoleStore()
  const resolver = new RbacResolver(grantStore)

  const bucket = opts.withLimiter
    ? new TokenBucket({
        capacity: opts.bucketCapacity ?? 3,
        refillRatePerSec: opts.bucketRefillPerSec ?? 0,
        clock: bucketClock,
      })
    : undefined

  const budgetGuard = opts.budgetPerKey !== undefined
    ? new BudgetGuard<string>({ budgetPerKey: opts.budgetPerKey })
    : undefined

  const deps: HandlerDeps = {
    sessionManager: {} as HandlerDeps['sessionManager'],
    oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
    rbacResolver: resolver,
    grantStore, roleStore, auditProducer,
    rateLimiter: bucket,
    budgetGuard,
    platform: {
      appRootPath: '/', resourcesPath: '/', isPackaged: false, appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      imageProcessor: { getMetadata: async () => null, process: async () => Buffer.from('') },
    } as HandlerDeps['platform'],
  }

  registerRolesCoreHandlers(server, deps)
  return { handlers, grantStore, audit, bucket, budgetGuard, tick(ms) { nowMs += ms } }
}

const ctxFor = (userId: string | null): RequestContext => ({
  clientId: 'c1', workspaceId: null, webContentsId: null, userId, sessionId: 's1',
})

function userGrant(
  actorId: string, scopeKind: 'workspace' | 'org' | 'global', scopeId: string | null, roleId: string,
): RoleGrant {
  return { roleId, actorKind: 'user', actorId, scopeKind, scopeId }
}

const LIMITED = { error: 'rate-limited', reason: 'token-bucket-exhausted' }
const BUDGET_EXCEEDED = { error: 'budget-exceeded', reason: 'per-actor-cap-exhausted' }

describe('roles.grant — TokenBucket rate-limit (T071b)', () => {
  it('allows up to `capacity` grants in a burst, then rate-limits subsequent attempts', async () => {
    const h = createHarness({
      initialGrants: [userGrant('admin', 'global', null, 'owner')],
      bucketCapacity: 3, bucketRefillPerSec: 0, withLimiter: true,
    })
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!

    const results: unknown[] = []
    for (let i = 0; i < 10; i++) {
      results.push(await grant(ctxFor('admin'), userGrant(`u${i}`, 'workspace', 'W1', 'viewer')))
    }

    expect(results.filter((r) => (r as { ok?: boolean }).ok === true).length).toBe(3)
    expect(results.filter((r) => (r as { error?: string }).error === 'rate-limited').length).toBe(7)
    expect(results[0]).toEqual({ ok: true })
    expect(results[2]).toEqual({ ok: true })
    expect(results[3]).toEqual(LIMITED)
    expect(results[9]).toEqual(LIMITED)

    // Only u0/u1/u2 reached the store.
    expect(await h.grantStore.grantsForUser('u0')).toHaveLength(1)
    expect(await h.grantStore.grantsForUser('u2')).toHaveLength(1)
    expect(await h.grantStore.grantsForUser('u3')).toHaveLength(0)
    expect(await h.grantStore.grantsForUser('u9')).toHaveLength(0)
  })

  it('refills tokens after the clock advances, restoring throughput', async () => {
    const h = createHarness({
      initialGrants: [userGrant('admin', 'global', null, 'owner')],
      bucketCapacity: 2, bucketRefillPerSec: 1, withLimiter: true,
    })
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!

    expect(await grant(ctxFor('admin'), userGrant('u1', 'workspace', 'W1', 'viewer'))).toEqual({ ok: true })
    expect(await grant(ctxFor('admin'), userGrant('u2', 'workspace', 'W1', 'viewer'))).toEqual({ ok: true })
    expect(await grant(ctxFor('admin'), userGrant('u3', 'workspace', 'W1', 'viewer'))).toEqual(LIMITED)

    h.tick(2000)
    expect(await grant(ctxFor('admin'), userGrant('u3', 'workspace', 'W1', 'viewer'))).toEqual({ ok: true })
    expect(await grant(ctxFor('admin'), userGrant('u4', 'workspace', 'W1', 'viewer'))).toEqual({ ok: true })
    expect(await grant(ctxFor('admin'), userGrant('u5', 'workspace', 'W1', 'viewer'))).toEqual(LIMITED)
  })

  it('rate-limit fires BEFORE the audit producer (no audit emit on limited grant)', async () => {
    // Capacity 1 — second grant must be rate-limited and emit no audit record.
    const h = createHarness({
      initialGrants: [userGrant('admin', 'global', null, 'owner')],
      bucketCapacity: 1, bucketRefillPerSec: 0, withLimiter: true, withAudit: true,
    })
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!

    expect(await grant(ctxFor('admin'), userGrant('u1', 'workspace', 'W1', 'viewer'))).toEqual({ ok: true })
    expect(await grant(ctxFor('admin'), userGrant('u2', 'workspace', 'W1', 'viewer'))).toEqual(LIMITED)

    expect(h.audit.length).toBe(1)
    expect(h.audit[0]!.kind).toBe('RoleGranted')
    expect((h.audit[0] as unknown as { subject: { id: string } }).subject.id).toBe('u1')
  })

  it('rate-limit fires BEFORE permission/validation (drains tokens on rejected requests)', async () => {
    // Caller has no owner grant => permission-denied. Bucket still drains
    // so abuse traffic cannot bypass the limit.
    const h = createHarness({ bucketCapacity: 2, bucketRefillPerSec: 0, withLimiter: true })
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!

    expect(await grant(ctxFor('u1'), userGrant('u2', 'workspace', 'W1', 'viewer')))
      .toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
    expect(await grant(ctxFor('u1'), userGrant('u2', 'workspace', 'W1', 'viewer')))
      .toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
    // Bucket now empty — next call is rate-limited, not permission-denied.
    expect(await grant(ctxFor('u1'), userGrant('u2', 'workspace', 'W1', 'viewer'))).toEqual(LIMITED)
  })
})

describe('roles.revoke — TokenBucket rate-limit (T071b)', () => {
  it('rate-limits revoke once the bucket is exhausted; un-revoked grant remains', async () => {
    const h = createHarness({
      initialGrants: [
        userGrant('admin', 'global', null, 'owner'),
        userGrant('u1', 'workspace', 'W1', 'viewer'),
        userGrant('u2', 'workspace', 'W1', 'viewer'),
        userGrant('u3', 'workspace', 'W1', 'viewer'),
      ],
      bucketCapacity: 2, bucketRefillPerSec: 0, withLimiter: true,
    })
    const revoke = h.handlers.get(RPC_CHANNELS.roles.REVOKE)!

    expect(await revoke(ctxFor('admin'), userGrant('u1', 'workspace', 'W1', 'viewer'))).toEqual({ ok: true, revoked: true })
    expect(await revoke(ctxFor('admin'), userGrant('u2', 'workspace', 'W1', 'viewer'))).toEqual({ ok: true, revoked: true })
    expect(await revoke(ctxFor('admin'), userGrant('u3', 'workspace', 'W1', 'viewer'))).toEqual(LIMITED)

    // u3's grant remains because the third revoke was gated out.
    expect(await h.grantStore.grantsForUser('u3')).toHaveLength(1)
  })

  it('grant and revoke share the same bucket (mutual rate-limit)', async () => {
    const h = createHarness({
      initialGrants: [
        userGrant('admin', 'global', null, 'owner'),
        userGrant('u1', 'workspace', 'W1', 'viewer'),
      ],
      bucketCapacity: 2, bucketRefillPerSec: 0, withLimiter: true,
    })
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!
    const revoke = h.handlers.get(RPC_CHANNELS.roles.REVOKE)!

    expect(await grant(ctxFor('admin'), userGrant('u2', 'workspace', 'W1', 'viewer'))).toEqual({ ok: true })
    expect(await revoke(ctxFor('admin'), userGrant('u1', 'workspace', 'W1', 'viewer'))).toEqual({ ok: true, revoked: true })
    expect(await grant(ctxFor('admin'), userGrant('u3', 'workspace', 'W1', 'viewer'))).toEqual(LIMITED)
  })
})

describe('No rate limiter — backward compatibility (T071b)', () => {
  it('unbounded grants succeed when rateLimiter is undefined', async () => {
    const h = createHarness({
      initialGrants: [userGrant('admin', 'global', null, 'owner')],
      withLimiter: false,
    })
    expect(h.bucket).toBeUndefined()
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!

    for (let i = 0; i < 20; i++) {
      expect(await grant(ctxFor('admin'), userGrant(`u${i}`, 'workspace', 'W1', 'viewer'))).toEqual({ ok: true })
    }
    expect(await h.grantStore.grantsForUser('u0')).toHaveLength(1)
    expect(await h.grantStore.grantsForUser('u19')).toHaveLength(1)
  })

  it('unbounded revokes succeed when rateLimiter is undefined', async () => {
    const initial: RoleGrant[] = [userGrant('admin', 'global', null, 'owner')]
    for (let i = 0; i < 5; i++) initial.push(userGrant(`u${i}`, 'workspace', 'W1', 'viewer'))
    const h = createHarness({ initialGrants: initial, withLimiter: false })
    const revoke = h.handlers.get(RPC_CHANNELS.roles.REVOKE)!

    for (let i = 0; i < 5; i++) {
      expect(await revoke(ctxFor('admin'), userGrant(`u${i}`, 'workspace', 'W1', 'viewer')))
        .toEqual({ ok: true, revoked: true })
    }
  })
})

describe('roles.{grant,revoke} — BudgetGuard per-actor cap (T086b)', () => {
  it('budget exhaustion returns budget-exceeded after the per-actor cap', async () => {
    // Per-actor cap of 2 with no token-bucket. After 2 successful grants
    // from `admin` the third returns the budget-exceeded envelope.
    const h = createHarness({
      initialGrants: [userGrant('admin', 'global', null, 'owner')],
      budgetPerKey: 2,
    })
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!

    expect(await grant(ctxFor('admin'), userGrant('u1', 'workspace', 'W1', 'viewer')))
      .toEqual({ ok: true })
    expect(await grant(ctxFor('admin'), userGrant('u2', 'workspace', 'W1', 'viewer')))
      .toEqual({ ok: true })
    expect(await grant(ctxFor('admin'), userGrant('u3', 'workspace', 'W1', 'viewer')))
      .toEqual(BUDGET_EXCEEDED)

    // The rejected grant must not have reached the store.
    expect(await h.grantStore.grantsForUser('u3')).toHaveLength(0)
    expect(h.budgetGuard!.usage('admin')).toBe(2)
  })

  it('different actor IDs have isolated budgets', async () => {
    // Both `admin1` and `admin2` hold global owner grants. With cap 1
    // each, both can land one grant before either is gated.
    const h = createHarness({
      initialGrants: [
        userGrant('admin1', 'global', null, 'owner'),
        userGrant('admin2', 'global', null, 'owner'),
      ],
      budgetPerKey: 1,
    })
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!

    expect(await grant(ctxFor('admin1'), userGrant('u1', 'workspace', 'W1', 'viewer')))
      .toEqual({ ok: true })
    expect(await grant(ctxFor('admin2'), userGrant('u2', 'workspace', 'W1', 'viewer')))
      .toEqual({ ok: true })
    // Both actors now exhausted independently.
    expect(await grant(ctxFor('admin1'), userGrant('u3', 'workspace', 'W1', 'viewer')))
      .toEqual(BUDGET_EXCEEDED)
    expect(await grant(ctxFor('admin2'), userGrant('u4', 'workspace', 'W1', 'viewer')))
      .toEqual(BUDGET_EXCEEDED)
    expect(h.budgetGuard!.usage('admin1')).toBe(1)
    expect(h.budgetGuard!.usage('admin2')).toBe(1)
  })

  it('grant and revoke share the same per-actor budget', async () => {
    // Per-actor cap 2. A single grant + a single revoke from the same
    // actor exhausts the budget — the third mutation (grant or revoke)
    // is gated regardless of channel.
    const h = createHarness({
      initialGrants: [
        userGrant('admin', 'global', null, 'owner'),
        userGrant('u1', 'workspace', 'W1', 'viewer'),
      ],
      budgetPerKey: 2,
    })
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!
    const revoke = h.handlers.get(RPC_CHANNELS.roles.REVOKE)!

    expect(await grant(ctxFor('admin'), userGrant('u2', 'workspace', 'W1', 'viewer')))
      .toEqual({ ok: true })
    expect(await revoke(ctxFor('admin'), userGrant('u1', 'workspace', 'W1', 'viewer')))
      .toEqual({ ok: true, revoked: true })
    expect(await grant(ctxFor('admin'), userGrant('u3', 'workspace', 'W1', 'viewer')))
      .toEqual(BUDGET_EXCEEDED)
    expect(await revoke(ctxFor('admin'), userGrant('u2', 'workspace', 'W1', 'viewer')))
      .toEqual(BUDGET_EXCEEDED)
  })

  it('reset restores the per-actor budget', async () => {
    // After exhaustion, `BudgetGuard.reset(key)` zeroes that actor's
    // usage and subsequent mutations succeed again.
    const h = createHarness({
      initialGrants: [userGrant('admin', 'global', null, 'owner')],
      budgetPerKey: 1,
    })
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!

    expect(await grant(ctxFor('admin'), userGrant('u1', 'workspace', 'W1', 'viewer')))
      .toEqual({ ok: true })
    expect(await grant(ctxFor('admin'), userGrant('u2', 'workspace', 'W1', 'viewer')))
      .toEqual(BUDGET_EXCEEDED)

    h.budgetGuard!.reset('admin')
    expect(await grant(ctxFor('admin'), userGrant('u2', 'workspace', 'W1', 'viewer')))
      .toEqual({ ok: true })
    expect(h.budgetGuard!.usage('admin')).toBe(1)
  })

  it('backward-compat: no budgetGuard => no error', async () => {
    // The handler must behave identically to the pre-T086b baseline
    // when no guard is wired. Both grant and revoke succeed unbounded.
    const initial: RoleGrant[] = [userGrant('admin', 'global', null, 'owner')]
    for (let i = 0; i < 5; i++) initial.push(userGrant(`u${i}`, 'workspace', 'W1', 'viewer'))
    const h = createHarness({ initialGrants: initial })
    expect(h.budgetGuard).toBeUndefined()
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!
    const revoke = h.handlers.get(RPC_CHANNELS.roles.REVOKE)!

    for (let i = 5; i < 25; i++) {
      expect(await grant(ctxFor('admin'), userGrant(`u${i}`, 'workspace', 'W1', 'viewer')))
        .toEqual({ ok: true })
    }
    for (let i = 0; i < 5; i++) {
      expect(await revoke(ctxFor('admin'), userGrant(`u${i}`, 'workspace', 'W1', 'viewer')))
        .toEqual({ ok: true, revoked: true })
    }
  })
})
