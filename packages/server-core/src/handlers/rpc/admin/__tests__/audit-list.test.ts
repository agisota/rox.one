/**
 * T250-rpc — admin RPC `audit.list` handler tests.
 *
 * Covers:
 *  - Owner gate: only global-owner callers reach the store.
 *  - Empty store: shape contract on the cold-start path.
 *  - Cursor round-trip: page 1 -> page 2 -> exhaust.
 *  - Filters: action, actor, since/until.
 *  - Schema rejection: zero/over-cap limit, invalid date, unknown
 *    fields (strict mode).
 *  - Optional dep: missing `auditEventStore` returns
 *    `audit-not-configured`.
 *  - Store failure: list errors are wrapped, never leaked raw.
 *
 * Harness mirrors `missions-rpc.test.ts`: a stub `RpcServer` that
 * records `handle()` registrations, an `InMemoryAuditEventStore`
 * (the canonical M.1.5 fixture), and the canonical
 * `InMemoryGrantStore` / `RbacResolver` from `@rox-one/shared/auth`.
 */

import { describe, expect, it } from 'bun:test'
import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import {
  InMemoryGrantStore,
  RbacResolver,
  type RoleGrant,
} from '@rox-one/shared/auth'
import {
  InMemoryAuditEventStore,
  type AuditEventRecord,
  type AuditEventStorageBackend,
} from '@rox-one/shared/audit'
import type {
  HandlerFn,
  RequestContext,
  RpcServer,
} from '@rox-one/server-core/transport'

import type { HandlerDeps } from '../../../handler-deps'
import {
  registerAuditAdminHandlers,
  type AuditListOk,
  type AuditListResult,
} from '../audit-list'

interface Harness {
  handlers: Map<string, HandlerFn>
  store: InMemoryAuditEventStore
  grantStore: InMemoryGrantStore
}

function userGrant(
  actorId: string,
  scopeKind: RoleGrant['scopeKind'],
  scopeId: string | null,
  roleId: string,
): RoleGrant {
  return { roleId, actorKind: 'user', actorId, scopeKind, scopeId }
}

function createHarness(options: {
  grants?: ReadonlyArray<RoleGrant>
  withStore?: boolean
  storeOverride?: AuditEventStorageBackend
} = {}): Harness {
  const handlers = new Map<string, HandlerFn>()
  const server: RpcServer = {
    handle: (channel, handler) => {
      handlers.set(channel, handler)
    },
    push: () => {},
    invokeClient: async () => undefined,
  }

  const store = new InMemoryAuditEventStore()
  const grantStore = new InMemoryGrantStore(options.grants ?? [])
  const resolver = new RbacResolver(grantStore)

  const auditStore: AuditEventStorageBackend | undefined = options.withStore === false
    ? undefined
    : options.storeOverride ?? store

  const deps: HandlerDeps = {
    sessionManager: {} as HandlerDeps['sessionManager'],
    oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
    rbacResolver: resolver,
    auditEventStore: auditStore,
    platform: {
      appRootPath: '/',
      resourcesPath: '/',
      isPackaged: false,
      appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      imageProcessor: { getMetadata: async () => null, process: async () => Buffer.from('') },
    } as HandlerDeps['platform'],
  }

  registerAuditAdminHandlers(server, deps)
  return { handlers, store, grantStore }
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

async function seedSequence(
  store: InMemoryAuditEventStore,
  count: number,
  options: {
    eventType?: string
    actorId?: string
    tsStart?: string
    stepMs?: number
  } = {},
): Promise<AuditEventRecord[]> {
  const eventType = options.eventType ?? 'scope.factory.downgraded'
  const actorId = options.actorId ?? 'user-1'
  const startMs = Date.parse(options.tsStart ?? '2026-05-10T00:00:00.000Z')
  const step = options.stepMs ?? 60_000
  const records: AuditEventRecord[] = []
  for (let i = 0; i < count; i += 1) {
    const r = await store.append({
      actor: { type: 'user', id: actorId },
      tenantId: 'tenant-a',
      eventType,
      severity: 'info',
      payload: { i },
      ts: new Date(startMs + i * step).toISOString(),
    })
    records.push(r)
  }
  return records
}

function assertOk(result: AuditListResult): asserts result is AuditListOk {
  if (!('ok' in result) || result.ok !== true) {
    throw new Error(`expected ok result, got: ${JSON.stringify(result)}`)
  }
}

function callList(handlers: Map<string, HandlerFn>) {
  const handler = handlers.get(RPC_CHANNELS.audit.LIST)
  if (!handler) throw new Error('audit.list handler not registered')
  return handler
}

describe('audit.list — registration', () => {
  it('registers the audit.list channel exactly once', () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    expect(h.handlers.has(RPC_CHANNELS.audit.LIST)).toBe(true)
    expect(h.handlers.size).toBe(1)
  })
})

describe('audit.list — owner gate', () => {
  it('rejects unauthenticated callers with no-user', async () => {
    const h = createHarness()
    const result = await callList(h.handlers)(ctxFor(null), {})
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-user' })
  })

  it('rejects callers without a global owner grant', async () => {
    const h = createHarness({
      grants: [userGrant('u_other', 'workspace', 'W1', 'editor')],
    })
    const result = await callList(h.handlers)(ctxFor('u_other'), {})
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
  })

  it('rejects workspace-owners that are not global owners', async () => {
    const h = createHarness({
      grants: [userGrant('w_owner', 'workspace', 'W1', 'owner')],
    })
    const result = await callList(h.handlers)(ctxFor('w_owner'), {})
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
  })

  it('returns rbac-not-configured when no resolver is wired', async () => {
    const handlers = new Map<string, HandlerFn>()
    const server: RpcServer = {
      handle: (channel, handler) => { handlers.set(channel, handler) },
      push: () => {},
      invokeClient: async () => undefined,
    }
    const deps: HandlerDeps = {
      sessionManager: {} as HandlerDeps['sessionManager'],
      oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
      // rbacResolver intentionally omitted
      auditEventStore: new InMemoryAuditEventStore(),
      platform: {
        appRootPath: '/', resourcesPath: '/', isPackaged: false, appVersion: '0.0.0-test',
        isDebugMode: true,
        logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
        imageProcessor: { getMetadata: async () => null, process: async () => Buffer.from('') },
      } as HandlerDeps['platform'],
    }
    registerAuditAdminHandlers(server, deps)
    const result = await handlers.get(RPC_CHANNELS.audit.LIST)!(ctxFor('admin'), {})
    expect(result).toEqual({ error: 'rbac-not-configured', reason: 'no-rbac-resolver' })
  })

  it('admits a global-owner caller and reaches the store', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    const result = await callList(h.handlers)(ctxFor('admin'), {})
    assertOk(result)
    expect(result.entries).toEqual([])
    expect(result.totalCount).toBe(0)
    expect(result.nextCursor).toBeNull()
  })
})

describe('audit.list — empty store', () => {
  it('returns the canonical empty shape', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    const result = await callList(h.handlers)(ctxFor('admin'), {})
    assertOk(result)
    expect(result).toEqual({
      ok: true,
      entries: [],
      nextCursor: null,
      totalCount: 0,
    })
  })
})

describe('audit.list — pagination cursor', () => {
  it('returns entries newest-first, capped at the requested limit', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    await seedSequence(h.store, 5)

    const result = await callList(h.handlers)(ctxFor('admin'), { limit: 3 })
    assertOk(result)
    expect(result.entries).toHaveLength(3)
    expect(result.totalCount).toBe(5)
    expect(result.nextCursor).not.toBeNull()
    // Newest first.
    expect(result.entries[0]!.ts > result.entries[1]!.ts).toBe(true)
    expect(result.entries[1]!.ts > result.entries[2]!.ts).toBe(true)
  })

  it('round-trips cursor: page1 -> page2 covers every record exactly once', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    const seeded = await seedSequence(h.store, 5)

    const page1 = await callList(h.handlers)(ctxFor('admin'), { limit: 3 })
    assertOk(page1)
    expect(page1.entries).toHaveLength(3)
    expect(page1.nextCursor).not.toBeNull()

    const page2 = await callList(h.handlers)(ctxFor('admin'), {
      cursor: page1.nextCursor!,
      limit: 3,
    })
    assertOk(page2)
    expect(page2.entries).toHaveLength(2)
    // No third page — list exhausted.
    expect(page2.nextCursor).toBeNull()

    // Union of pages = full seed, no duplicates.
    const seenIds = [...page1.entries, ...page2.entries].map((r) => r.eventId)
    expect(new Set(seenIds).size).toBe(5)
    const seedIds = new Set(seeded.map((r) => r.eventId))
    for (const id of seenIds) {
      expect(seedIds.has(id)).toBe(true)
    }
  })

  it('treats a forged / corrupt cursor as a soft restart', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    await seedSequence(h.store, 3)

    const result = await callList(h.handlers)(ctxFor('admin'), {
      cursor: 'this-is-not-a-real-base64-cursor!!!',
      limit: 10,
    })
    assertOk(result)
    expect(result.entries).toHaveLength(3)
    expect(result.totalCount).toBe(3)
    expect(result.nextCursor).toBeNull()
  })

  it('exposes opaque cursors (no raw timestamp in the string)', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    await seedSequence(h.store, 5, { tsStart: '2026-05-10T00:00:00.000Z' })

    const page1 = await callList(h.handlers)(ctxFor('admin'), { limit: 2 })
    assertOk(page1)
    expect(page1.nextCursor).not.toBeNull()
    // The raw ISO timestamp must not appear verbatim in the wire cursor —
    // forge-resistance and renderer drift are both easier when the
    // cursor is opaque.
    expect(page1.nextCursor!).not.toContain('2026-05-10')
    expect(page1.nextCursor!).not.toContain(':')
  })
})

describe('audit.list — filters', () => {
  it('filters by action (eventType equality)', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    await seedSequence(h.store, 2, { eventType: 'RoleGranted', tsStart: '2026-05-10T00:00:00.000Z' })
    await seedSequence(h.store, 3, { eventType: 'MissionStarted', tsStart: '2026-05-10T01:00:00.000Z' })

    const result = await callList(h.handlers)(ctxFor('admin'), {
      filter: { action: 'MissionStarted' },
    })
    assertOk(result)
    expect(result.entries).toHaveLength(3)
    expect(result.totalCount).toBe(3)
    for (const r of result.entries) {
      expect(r.eventType).toBe('MissionStarted')
    }
  })

  it('filters by actor (actor.id equality)', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    await seedSequence(h.store, 2, { actorId: 'alice', tsStart: '2026-05-10T00:00:00.000Z' })
    await seedSequence(h.store, 3, { actorId: 'bob', tsStart: '2026-05-10T02:00:00.000Z' })

    const result = await callList(h.handlers)(ctxFor('admin'), {
      filter: { actor: 'alice' },
    })
    assertOk(result)
    expect(result.entries).toHaveLength(2)
    expect(result.totalCount).toBe(2)
    for (const r of result.entries) {
      expect(r.actor.id).toBe('alice')
    }
  })

  it('filters by since/until inclusive date range', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    // 5 events one minute apart starting 2026-05-10T00:00:00Z.
    await seedSequence(h.store, 5, { tsStart: '2026-05-10T00:00:00.000Z', stepMs: 60_000 })

    const result = await callList(h.handlers)(ctxFor('admin'), {
      filter: {
        since: '2026-05-10T00:01:00.000Z',
        until: '2026-05-10T00:03:00.000Z',
      },
    })
    assertOk(result)
    // Inclusive bounds — should include the 00:01, 00:02, 00:03 records (3).
    expect(result.entries).toHaveLength(3)
    expect(result.totalCount).toBe(3)
    for (const r of result.entries) {
      const ms = Date.parse(r.ts)
      expect(ms).toBeGreaterThanOrEqual(Date.parse('2026-05-10T00:01:00.000Z'))
      expect(ms).toBeLessThanOrEqual(Date.parse('2026-05-10T00:03:00.000Z'))
    }
  })

  it('composes filters and cursor across pages', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    await seedSequence(h.store, 2, { actorId: 'alice', tsStart: '2026-05-10T00:00:00.000Z' })
    await seedSequence(h.store, 4, { actorId: 'bob', tsStart: '2026-05-10T01:00:00.000Z' })

    const page1 = await callList(h.handlers)(ctxFor('admin'), {
      filter: { actor: 'bob' },
      limit: 2,
    })
    assertOk(page1)
    expect(page1.entries).toHaveLength(2)
    expect(page1.totalCount).toBe(4)
    expect(page1.nextCursor).not.toBeNull()
    expect(page1.entries.every((r) => r.actor.id === 'bob')).toBe(true)

    const page2 = await callList(h.handlers)(ctxFor('admin'), {
      filter: { actor: 'bob' },
      cursor: page1.nextCursor!,
      limit: 2,
    })
    assertOk(page2)
    expect(page2.entries).toHaveLength(2)
    expect(page2.totalCount).toBe(4)
    expect(page2.nextCursor).toBeNull()
    expect(page2.entries.every((r) => r.actor.id === 'bob')).toBe(true)
  })
})

describe('audit.list — schema rejection (Zod strict mode)', () => {
  it('rejects limit=0', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    const result = await callList(h.handlers)(ctxFor('admin'), { limit: 0 })
    expect(result).toEqual({ error: 'invalid-argument', reason: 'invalid-limit' })
  })

  it('rejects limit above the 100 cap', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    const result = await callList(h.handlers)(ctxFor('admin'), { limit: 200 })
    expect(result).toEqual({ error: 'invalid-argument', reason: 'invalid-limit' })
  })

  it('rejects a non-integer limit', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    const result = await callList(h.handlers)(ctxFor('admin'), { limit: 1.5 })
    expect(result).toEqual({ error: 'invalid-argument', reason: 'invalid-limit' })
  })

  it('rejects an invalid since date string', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    const result = await callList(h.handlers)(ctxFor('admin'), {
      filter: { since: 'not-a-date' },
    })
    expect(result).toEqual({ error: 'invalid-argument', reason: 'invalid-filter.since' })
  })

  it('rejects an invalid until date string', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    const result = await callList(h.handlers)(ctxFor('admin'), {
      filter: { until: 'tomorrow' },
    })
    expect(result).toEqual({ error: 'invalid-argument', reason: 'invalid-filter.until' })
  })

  it('rejects unknown top-level fields (strict mode)', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    // Extra `mystery` field — strict() rejects, owner-gate not reached.
    const result = await callList(h.handlers)(ctxFor('admin'), { mystery: 'fish', limit: 10 })
    expect((result as { error: string }).error).toBe('invalid-argument')
  })

  it('rejects unknown filter fields (nested strict mode)', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    const result = await callList(h.handlers)(ctxFor('admin'), {
      filter: { action: 'X', extra: 'y' },
    })
    expect((result as { error: string }).error).toBe('invalid-argument')
  })

  it('accepts an empty input (defaults applied)', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    const result = await callList(h.handlers)(ctxFor('admin'), {})
    assertOk(result)
    expect(result.entries).toEqual([])
  })

  it('accepts undefined input (defaults applied)', async () => {
    const h = createHarness({ grants: [userGrant('admin', 'global', null, 'owner')] })
    const result = await callList(h.handlers)(ctxFor('admin'), undefined)
    assertOk(result)
    expect(result.entries).toEqual([])
  })
})

describe('audit.list — optional dependency / store failure', () => {
  it('returns audit-not-configured when no store is wired', async () => {
    const h = createHarness({
      grants: [userGrant('admin', 'global', null, 'owner')],
      withStore: false,
    })
    const result = await callList(h.handlers)(ctxFor('admin'), {})
    expect(result).toEqual({ error: 'audit-not-configured', reason: 'no-audit-event-store' })
  })

  it('wraps a thrown listRecords error in a stable envelope', async () => {
    const failing: AuditEventStorageBackend = {
      append: async () => { throw new Error('append should not run'); },
      listRecords: async () => { throw new Error('boom: secret-sql-fragment'); },
    }
    const h = createHarness({
      grants: [userGrant('admin', 'global', null, 'owner')],
      storeOverride: failing,
    })
    const result = await callList(h.handlers)(ctxFor('admin'), {})
    expect(result).toEqual({ error: 'audit-store-error', reason: 'list-records-failed' })
    // The raw error message must not appear on the wire.
    expect(JSON.stringify(result)).not.toContain('boom')
    expect(JSON.stringify(result)).not.toContain('secret-sql-fragment')
  })
})
