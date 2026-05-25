import { describe, expect, it } from 'bun:test'

import {
  computeContractAuditEventHash,
  generateAuditEventId,
  INITIAL_AUDIT_PREV_HASH,
  type AuditEventCanonicalInput,
  type AuditEventContract,
} from '../../../packages/shared/src/audit/index.ts'
import {
  InMemoryContractAuditStore,
  __auditStoreTestHelpers,
  verifyContractAuditChain,
} from '../../../packages/server-core/src/audit/append-only-store.ts'

const TENANT = '11111111-1111-1111-1111-111111111111'
const WORKSPACE = '22222222-2222-2222-2222-222222222222'

function makeEvent(
  prevHash: string,
  overrides: Partial<AuditEventCanonicalInput> = {},
): AuditEventContract {
  const canonical: AuditEventCanonicalInput = {
    event_id: generateAuditEventId(),
    ts: new Date().toISOString(),
    actor: 'system',
    tenant_id: TENANT,
    workspace_id: WORKSPACE,
    request_id: 'req-1',
    event_type: 'audit.chain_test',
    severity: 'info',
    payload_json: '{"ok":true}',
    prev_hash: prevHash,
    ...overrides,
  }
  return { ...canonical, hash: computeContractAuditEventHash(canonical) }
}

describe('InMemoryContractAuditStore — append-only contract (AC-9)', () => {
  it('exposes only append / getAll / getByEventId / verifyChain — no update/delete', () => {
    const store = new InMemoryContractAuditStore()
    const surface = store as unknown as Record<string, unknown>
    expect(typeof surface.append).toBe('function')
    expect(typeof surface.getAll).toBe('function')
    expect(typeof surface.getByEventId).toBe('function')
    expect(typeof surface.verifyChain).toBe('function')
    expect(surface.update).toBeUndefined()
    expect(surface.delete).toBeUndefined()
    expect(surface.clear).toBeUndefined()
    expect(surface.remove).toBeUndefined()
  })

  it('validates schema before insert; invalid → throws + nothing inserted (AC-8)', () => {
    const store = new InMemoryContractAuditStore()
    const bad = { not: 'an event' } as unknown as AuditEventContract
    expect(() => store.append(bad)).toThrow()
    expect(store.getAll()).toHaveLength(0)
  })

  it('rejects events with mismatched prev_hash', () => {
    const store = new InMemoryContractAuditStore()
    const wrong = makeEvent('f'.repeat(64))
    expect(() => store.append(wrong)).toThrow(/prev_hash mismatch/)
  })

  it('rejects duplicate event_id', () => {
    const store = new InMemoryContractAuditStore()
    const first = makeEvent(INITIAL_AUDIT_PREV_HASH)
    store.append(first)
    const duplicate = makeEvent(first.hash, { event_id: first.event_id })
    expect(() => store.append(duplicate)).toThrow(/duplicate audit event_id/)
  })

  it('getByEventId returns a defensive copy', () => {
    const store = new InMemoryContractAuditStore()
    const first = makeEvent(INITIAL_AUDIT_PREV_HASH)
    store.append(first)
    const found = store.getByEventId(first.event_id)!
    found.event_type = 'tampered.value' as never
    const refetched = store.getByEventId(first.event_id)!
    expect(refetched.event_type).toBe(first.event_type)
  })
})

describe('verifyChain (AC-2, AC-3)', () => {
  it('returns ok for a valid 3-event chain (AC-2)', () => {
    const store = new InMemoryContractAuditStore()
    const a = makeEvent(INITIAL_AUDIT_PREV_HASH)
    store.append(a)
    const b = makeEvent(a.hash)
    store.append(b)
    const c = makeEvent(b.hash)
    store.append(c)
    expect(store.verifyChain()).toEqual({ ok: true })
  })

  it('returns { ok: false, brokenAt } for tampered middle event (AC-3)', () => {
    const store = new InMemoryContractAuditStore()
    const a = makeEvent(INITIAL_AUDIT_PREV_HASH)
    store.append(a)
    const b = makeEvent(a.hash)
    store.append(b)
    const c = makeEvent(b.hash)
    store.append(c)
    __auditStoreTestHelpers.tamper(store, b.event_id, event => ({
      ...event,
      payload_json: '{"tampered":true}',
    }))
    const result = store.verifyChain()
    expect(result.ok).toBe(false)
    expect(result.brokenAt).toBe(b.event_id)
    expect(result.reason).toBe('hash_mismatch')
  })

  it('verifyContractAuditChain works on bare arrays', () => {
    const a = makeEvent(INITIAL_AUDIT_PREV_HASH)
    const b = makeEvent(a.hash)
    expect(verifyContractAuditChain([a, b])).toEqual({ ok: true })
  })
})

describe('test helper namespace', () => {
  it('clear() empties the store (test-only)', () => {
    const store = new InMemoryContractAuditStore()
    store.append(makeEvent(INITIAL_AUDIT_PREV_HASH))
    __auditStoreTestHelpers.clear(store)
    expect(store.getAll()).toHaveLength(0)
  })
})
