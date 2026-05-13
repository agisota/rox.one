import { describe, expect, it } from 'bun:test'

import { SqliteAdapter } from '../sqlite-adapter'
import { uuidV7 } from '../uuid-v7'
import type {
  AccountRow,
  AuditEventRow,
  RoleGrantRow,
  WorkspaceRow,
} from '../../adapter'

function isoNow(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString()
}

function memoryAdapter(): SqliteAdapter {
  return SqliteAdapter.open({ path: ':memory:', disableWal: true })
}

describe('SqliteAdapter — accounts', () => {
  it('puts and gets an account', async () => {
    const adapter = memoryAdapter()
    const row: AccountRow = {
      id: uuidV7(),
      email: 'first@example.com',
      createdAt: isoNow(),
    }
    await adapter.putAccount(row)

    const fetched = await adapter.getAccount(row.id)
    expect(fetched).not.toBeNull()
    expect(fetched?.id).toBe(row.id)
    expect(fetched?.email).toBe('first@example.com')
    expect(fetched?.createdAt).toBe(row.createdAt)

    await adapter.close()
  })

  it('returns null for an unknown id', async () => {
    const adapter = memoryAdapter()
    const fetched = await adapter.getAccount(uuidV7())
    expect(fetched).toBeNull()
    await adapter.close()
  })

  it('upserts on duplicate id', async () => {
    const adapter = memoryAdapter()
    const id = uuidV7()
    await adapter.putAccount({ id, email: 'a@example.com', createdAt: isoNow() })
    await adapter.putAccount({ id, email: 'b@example.com', createdAt: isoNow(1) })
    const fetched = await adapter.getAccount(id)
    expect(fetched?.email).toBe('b@example.com')
    await adapter.close()
  })

  it('enforces unique email at the database level', async () => {
    const adapter = memoryAdapter()
    await adapter.putAccount({ id: uuidV7(), email: 'shared@example.com', createdAt: isoNow() })
    await expect(
      adapter.putAccount({ id: uuidV7(), email: 'shared@example.com', createdAt: isoNow() }),
    ).rejects.toThrow()
    await adapter.close()
  })
})

describe('SqliteAdapter — workspaces', () => {
  it('lists workspaces for an account in created-at order', async () => {
    const adapter = memoryAdapter()
    const accountId = uuidV7()
    await adapter.putAccount({ id: accountId, email: 'ws@example.com', createdAt: isoNow() })

    const w1: WorkspaceRow = {
      id: uuidV7(),
      accountId,
      name: 'Alpha',
      createdAt: isoNow(),
    }
    const w2: WorkspaceRow = {
      id: uuidV7(),
      accountId,
      name: 'Beta',
      createdAt: isoNow(10),
    }
    await adapter.putWorkspace(w1)
    await adapter.putWorkspace(w2)

    const rows = await adapter.listWorkspaces(accountId)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.id).toBe(w1.id)
    expect(rows[1]?.id).toBe(w2.id)
    expect(rows[0]?.name).toBe('Alpha')
    expect(rows[1]?.name).toBe('Beta')

    await adapter.close()
  })

  it('returns an empty list for an unknown account', async () => {
    const adapter = memoryAdapter()
    const rows = await adapter.listWorkspaces(uuidV7())
    expect(rows).toHaveLength(0)
    await adapter.close()
  })

  it('enforces the account_id FK constraint', async () => {
    const adapter = memoryAdapter()
    await expect(
      adapter.putWorkspace({
        id: uuidV7(),
        accountId: uuidV7(), // no parent
        name: 'Orphan',
        createdAt: isoNow(),
      }),
    ).rejects.toThrow()
    await adapter.close()
  })

  it('cascades workspace delete when the parent account is removed', async () => {
    const adapter = memoryAdapter()
    const accountId = uuidV7()
    await adapter.putAccount({ id: accountId, email: 'cascade@example.com', createdAt: isoNow() })
    await adapter.putWorkspace({
      id: uuidV7(),
      accountId,
      name: 'Doomed',
      createdAt: isoNow(),
    })

    // Manual delete to verify ON DELETE CASCADE.
    adapter.db.run('DELETE FROM accounts WHERE id = ?;', [accountId])
    const rows = await adapter.listWorkspaces(accountId)
    expect(rows).toHaveLength(0)

    await adapter.close()
  })
})

describe('SqliteAdapter — role_grants', () => {
  it('persists and reads grants for an actor', async () => {
    const adapter = memoryAdapter()
    const actorId = uuidV7()
    const grant: RoleGrantRow = {
      id: uuidV7(),
      actorId,
      roleId: 'workspace.admin',
      scopeKind: 'workspace',
      scopeId: uuidV7(),
      createdAt: isoNow(),
    }
    await adapter.putGrant(grant)
    const rows = await adapter.getGrants(actorId)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.roleId).toBe('workspace.admin')
    expect(rows[0]?.scopeKind).toBe('workspace')
    await adapter.close()
  })

  it('allows null scope_id for global grants', async () => {
    const adapter = memoryAdapter()
    const actorId = uuidV7()
    await adapter.putGrant({
      id: uuidV7(),
      actorId,
      roleId: 'platform.superadmin',
      scopeKind: 'global',
      scopeId: null,
      createdAt: isoNow(),
    })
    const rows = await adapter.getGrants(actorId)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.scopeId).toBeNull()
    expect(rows[0]?.scopeKind).toBe('global')
    await adapter.close()
  })

  it('returns empty for an actor with no grants', async () => {
    const adapter = memoryAdapter()
    const rows = await adapter.getGrants(uuidV7())
    expect(rows).toHaveLength(0)
    await adapter.close()
  })
})

describe('SqliteAdapter — audit_events', () => {
  it('appends audit events with JSON payload serialization', async () => {
    const adapter = memoryAdapter()
    const subject = uuidV7()
    const event: AuditEventRow = {
      id: uuidV7(),
      kind: 'workspace.created',
      actor: uuidV7(),
      subject,
      scopeKind: 'workspace',
      scopeId: subject,
      timestampMs: Date.now(),
      correlationId: 'corr-123',
      payload: { name: 'Alpha', tier: 'pro' },
    }
    await adapter.appendAuditEvent(event)

    const events = await adapter.listAuditEvents({ subject })
    expect(events).toHaveLength(1)
    expect(events[0]?.kind).toBe('workspace.created')
    expect(events[0]?.correlationId).toBe('corr-123')
    expect(events[0]?.payload).toEqual({ name: 'Alpha', tier: 'pro' })

    await adapter.close()
  })

  it('orders events by timestamp ascending', async () => {
    const adapter = memoryAdapter()
    const subject = uuidV7()
    const t0 = Date.now()
    const base = {
      actor: uuidV7(),
      subject,
      scopeKind: 'global' as const,
      scopeId: null,
      correlationId: null,
      payload: {},
    }
    await adapter.appendAuditEvent({ ...base, id: uuidV7(), kind: 'first', timestampMs: t0 + 100 })
    await adapter.appendAuditEvent({ ...base, id: uuidV7(), kind: 'zeroth', timestampMs: t0 })

    const events = await adapter.listAuditEvents({ subject })
    expect(events).toHaveLength(2)
    expect(events[0]?.kind).toBe('zeroth')
    expect(events[1]?.kind).toBe('first')

    await adapter.close()
  })

  it('filters by scope_kind', async () => {
    const adapter = memoryAdapter()
    const base = {
      actor: uuidV7(),
      subject: uuidV7(),
      scopeId: uuidV7(),
      timestampMs: Date.now(),
      correlationId: null,
      payload: {},
    }
    await adapter.appendAuditEvent({ ...base, id: uuidV7(), kind: 'k1', scopeKind: 'workspace' })
    await adapter.appendAuditEvent({ ...base, id: uuidV7(), kind: 'k2', scopeKind: 'team' })

    const events = await adapter.listAuditEvents({ scopeKind: 'workspace' })
    expect(events).toHaveLength(1)
    expect(events[0]?.kind).toBe('k1')

    await adapter.close()
  })
})

describe('SqliteAdapter — close hygiene', () => {
  it('throws when used after close()', async () => {
    const adapter = memoryAdapter()
    await adapter.close()
    await expect(adapter.getAccount(uuidV7())).rejects.toThrow(/closed/)
  })

  it('close() is idempotent', async () => {
    const adapter = memoryAdapter()
    await adapter.close()
    await expect(adapter.close()).resolves.toBeUndefined()
  })

  it('open() applies all migrations by default', () => {
    const adapter = memoryAdapter()
    expect(adapter.appliedMigrations.head).toBe(1)
    expect(adapter.appliedMigrations.applied[0]?.name).toBe('0001-initial')
    void adapter.close()
  })

  it('open() with runMigrationsOnOpen=false leaves the schema empty', () => {
    const adapter = SqliteAdapter.open({
      path: ':memory:',
      disableWal: true,
      runMigrationsOnOpen: false,
    })
    expect(adapter.appliedMigrations.head).toBe(0)
    const tables = adapter.db
      .query("SELECT name FROM sqlite_master WHERE type = 'table';")
      .all() as Array<{ name: string }>
    const names = tables.map((t) => t.name)
    expect(names).not.toContain('accounts')
    void adapter.close()
  })
})

describe('uuidV7', () => {
  it('produces a v7 UUID with extractable timestamp', () => {
    const ms = 1_700_000_000_123
    const id = uuidV7(ms)
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('is monotonic for ascending timestamps (sorts lexically)', () => {
    const ids = [uuidV7(1_000), uuidV7(2_000), uuidV7(3_000)]
    const sorted = [...ids].sort()
    expect(sorted).toEqual(ids)
  })
})
