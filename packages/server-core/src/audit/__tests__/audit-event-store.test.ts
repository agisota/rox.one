import { describe, expect, it } from 'bun:test'

import {
  InMemoryAuditEventStore,
  queryAuditEventRecords,
  verifyAuditHashChain,
} from '../audit-event-store'

describe('audit event store schema', () => {
  it('normalizes appended records to the Phase 1.5 audit schema', async () => {
    const store = new InMemoryAuditEventStore()

    const record = await store.append({
      actor: { type: 'user', id: 'user-1', role: 'owner' },
      tenantId: 'tenant-a',
      eventType: 'scope.factory.forgery_rejected',
      severity: 'warn',
      payload: { attemptedWorkspaceId: 'tenant-b' },
      requestId: 'req-1',
    })

    expect(record).toMatchObject({
      actor: { type: 'user', id: 'user-1', role: 'owner' },
      tenantId: 'tenant-a',
      eventType: 'scope.factory.forgery_rejected',
      severity: 'warn',
      payloadJson: '{"attemptedWorkspaceId":"tenant-b"}',
      requestId: 'req-1',
      previousEventHash: '0'.repeat(64),
    })
    expect(record.eventId).toMatch(/^[0-9a-f-]{36}$/)
    expect(new Date(record.ts).toISOString()).toBe(record.ts)
    expect(record.eventHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('builds a tamper-evident hash chain over canonical schema columns', async () => {
    const store = new InMemoryAuditEventStore()

    const first = await store.append({
      actor: { type: 'system' },
      tenantId: 'tenant-a',
      eventType: 'scope.runtime.workspace_downgraded',
      severity: 'warn',
      payload: { requestedWorkspaceId: 'tenant-a' },
      requestId: 'req-1',
    })
    const second = await store.append({
      actor: { type: 'system' },
      tenantId: 'tenant-a',
      eventType: 'credential.scope.write',
      severity: 'trace',
      payload: { credentialType: 'anthropic_api_key' },
      requestId: 'req-2',
    })

    expect(second.previousEventHash).toBe(first.eventHash)
    const records = await store.listRecords()
    expect(verifyAuditHashChain(records)).toBe(true)

    const tampered = records.map(record => ({ ...record }))
    tampered[0] = { ...tampered[0]!, payloadJson: '{"requestedWorkspaceId":"tenant-b"}' }

    expect(verifyAuditHashChain(tampered)).toBe(false)
    expect(verifyAuditHashChain(await store.listRecords())).toBe(true)
  })

  it('returns defensive copies instead of mutable stored records', async () => {
    const store = new InMemoryAuditEventStore()

    await store.append({
      actor: { type: 'user', id: 'user-1' },
      tenantId: 'tenant-a',
      eventType: 'account.login',
      payload: { method: 'password' },
    })

    const [firstRead] = await store.listRecords()
    firstRead!.actor.id = 'mutated'

    const [secondRead] = await store.listRecords()
    expect(secondRead!.actor.id).toBe('user-1')
  })

  it('redacts secret-looking payload material before persistence', async () => {
    const store = new InMemoryAuditEventStore()

    const record = await store.append({
      actor: { type: 'system' },
      tenantId: 'tenant-a',
      eventType: 'credential.scope.write',
      payload: {
        token: 'raw-token',
        nested: { apiKey: 'sk-live-secret0000', visible: 'safe' },
        command: 'curl -H "Authorization: Bearer raw-token" https://api.test',
      },
    })

    expect(record.payloadJson).not.toContain('raw-token')
    expect(record.payloadJson).not.toContain('sk-live-secret0000')
    expect(record.payloadJson).toContain('[redacted]')
    expect(record.payloadJson).toContain('Bearer [redacted]')
    expect(record.payloadJson).toContain('"visible":"safe"')
  })

  it('queries records by tenant, actor, event type, and inclusive time range', async () => {
    const store = new InMemoryAuditEventStore()

    await store.append({
      actor: { type: 'user', id: 'user-1', role: 'owner' },
      tenantId: 'tenant-a',
      eventType: 'scope.factory.downgraded',
      severity: 'trace',
      payload: { reason: 'multi-tenant-not-activated', token: 'raw-token' },
      requestId: 'req-1',
      ts: '2026-05-16T10:00:00.000Z',
    })
    await store.append({
      actor: { type: 'user', id: 'user-1', role: 'owner' },
      tenantId: 'tenant-b',
      eventType: 'scope.factory.downgraded',
      severity: 'trace',
      payload: { reason: 'wrong-tenant' },
      requestId: 'req-2',
      ts: '2026-05-16T10:05:00.000Z',
    })
    await store.append({
      actor: { type: 'user', id: 'user-2' },
      tenantId: 'tenant-a',
      eventType: 'credential.scope.write',
      severity: 'trace',
      payload: { credentialType: 'anthropic_api_key' },
      requestId: 'req-3',
      ts: '2026-05-16T10:10:00.000Z',
    })
    await store.append({
      actor: { type: 'system' },
      tenantId: 'tenant-a',
      eventType: 'scope.factory.downgraded',
      severity: 'warn',
      payload: { reason: 'outside-window' },
      requestId: 'req-4',
      ts: '2026-05-16T12:00:00.000Z',
    })

    const records = await queryAuditEventRecords(store, {
      tenantId: 'tenant-a',
      actorType: 'user',
      actorId: 'user-1',
      eventType: 'scope.factory.downgraded',
      from: '2026-05-16T09:00:00.000Z',
      to: '2026-05-16T11:00:00.000Z',
      limit: 10,
    })

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      tenantId: 'tenant-a',
      eventType: 'scope.factory.downgraded',
      requestId: 'req-1',
    })
    expect(records[0]!.payloadJson).not.toContain('raw-token')
    expect(records[0]!.payloadJson).toContain('[redacted]')

    records[0]!.actor.id = 'mutated'
    const reread = await queryAuditEventRecords(store, { tenantId: 'tenant-a', limit: 1 })
    expect(reread[0]!.actor.id).not.toBe('mutated')
  })
})
