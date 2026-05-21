import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
  AuditEventSchema,
  __resetContractLoggerForTests,
  emitAuditEvent,
  setAuditLoggerWarn,
  setAuditSink,
  type AuditEventContract,
} from '../../../packages/shared/src/audit/index.ts'
import {
  InMemoryContractAuditStore,
} from '../../../packages/server-core/src/audit/append-only-store.ts'

const TENANT = '11111111-1111-1111-1111-111111111111'
const WORKSPACE = '22222222-2222-2222-2222-222222222222'

describe('emitAuditEvent — logger.audit fanout (AC-10)', () => {
  let store: InMemoryContractAuditStore
  let warnings: Array<{ message: string; meta?: Record<string, unknown> }>

  beforeEach(() => {
    __resetContractLoggerForTests()
    store = new InMemoryContractAuditStore()
    warnings = []
    setAuditSink(event => store.append(event))
    setAuditLoggerWarn((message, meta) => warnings.push({ message, meta }))
  })

  afterEach(() => {
    __resetContractLoggerForTests()
  })

  it('writes a valid AuditEvent with auto-filled fields', () => {
    const { event } = emitAuditEvent('auth.login', { ok: true }, {
      tenantId: TENANT,
      workspaceId: WORKSPACE,
    })
    expect(() => AuditEventSchema.parse(event)).not.toThrow()
    expect(event.event_type).toBe('auth.login')
    expect(event.severity).toBe('info')
    expect(event.actor).toBe('system')
    expect(event.tenant_id).toBe(TENANT)
    expect(event.workspace_id).toBe(WORKSPACE)
    expect(event.payload_json).toContain('"ok":true')
  })

  it('chains successive emits through prev_hash', () => {
    const first = emitAuditEvent('auth.login', { user: 'u1' }, { tenantId: TENANT })
    const second = emitAuditEvent('auth.logout', { user: 'u1' }, { tenantId: TENANT })
    expect(second.event.prev_hash).toBe(first.event.hash)
    expect(store.verifyChain()).toEqual({ ok: true })
  })

  it('sanitizes payload before hashing (A08-06)', () => {
    const { event } = emitAuditEvent('auth.login', {
      ok: true,
      password: 'real-secret',
    }, { tenantId: TENANT })
    expect(event.payload_json).not.toContain('real-secret')
    expect(event.payload_json).toContain('[REDACTED]')
  })

  it('throws on invalid event_type format', () => {
    expect(() => emitAuditEvent('NOT_VALID', {}, {})).toThrow()
  })

  it('warns (does not throw) on unknown domain', () => {
    const { event, unknownDomain } = emitAuditEvent('weirdo.thing', {}, {})
    expect(unknownDomain).toBe(true)
    expect(event.event_type).toBe('weirdo.thing')
    expect(warnings.find(w => w.message === 'audit.unknown_domain')).toBeDefined()
  })

  it('honors caller-provided actor (system:<wt-id> form from O-3)', () => {
    const { event } = emitAuditEvent('storage.write.ok', { ok: true }, {
      actor: 'system:wt-23',
      tenantId: TENANT,
    })
    expect(event.actor).toBe('system:wt-23')
  })

  it('allows distinct chains per tenant', () => {
    // Reset between sinks so cross-tenant emits aren't fed to the same
    // append-only store (the per-chain semantics are independent of the sink).
    __resetContractLoggerForTests()
    const t1 = '11111111-1111-1111-1111-111111111111'
    const t2 = '33333333-3333-3333-3333-333333333333'
    const a1 = emitAuditEvent('auth.login', { x: 1 }, { tenantId: t1 })
    const a2 = emitAuditEvent('auth.login', { x: 2 }, { tenantId: t2 })
    // Different chains — both start from initial prev_hash for their tenant
    expect(a1.event.prev_hash).toBe('0'.repeat(64))
    expect(a2.event.prev_hash).toBe('0'.repeat(64))
  })

  it('writes through to provided sink (smoke for downstream fanout)', () => {
    const captured: AuditEventContract[] = []
    setAuditSink(event => captured.push(event))
    emitAuditEvent('auth.login', { ok: true }, { tenantId: TENANT })
    expect(captured).toHaveLength(1)
  })
})
