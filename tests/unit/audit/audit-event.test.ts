import { describe, expect, it } from 'bun:test'

import {
  AUDIT_EVENT_TYPE_REGEX,
  AuditEventSchema,
  EVENT_DOMAIN_REGISTRY,
  INITIAL_AUDIT_PREV_HASH,
  canonicalizeAuditEvent,
  computeContractAuditEventHash,
  generateAuditEventId,
  verifyEventTypeDomain,
  type AuditEventCanonicalInput,
  type AuditEventContract,
} from '../../../packages/shared/src/audit/index.ts'

const VALID_TENANT = '11111111-1111-1111-1111-111111111111'
const VALID_WORKSPACE = '22222222-2222-2222-2222-222222222222'

function makeCanonical(overrides: Partial<AuditEventCanonicalInput> = {}): AuditEventCanonicalInput {
  return {
    event_id: generateAuditEventId(),
    ts: new Date('2026-05-21T10:00:00.000Z').toISOString(),
    actor: 'system',
    tenant_id: VALID_TENANT,
    workspace_id: VALID_WORKSPACE,
    request_id: 'req-1',
    event_type: 'auth.login',
    severity: 'info',
    payload_json: '{"ok":true}',
    prev_hash: INITIAL_AUDIT_PREV_HASH,
    ...overrides,
  }
}

function makeEvent(overrides: Partial<AuditEventContract> = {}): AuditEventContract {
  const canonical = makeCanonical(overrides as Partial<AuditEventCanonicalInput>)
  return { ...canonical, hash: computeContractAuditEventHash(canonical), ...overrides }
}

describe('AuditEvent schema (AC-1)', () => {
  it('parses a valid event', () => {
    const event = makeEvent()
    expect(() => AuditEventSchema.parse(event)).not.toThrow()
  })

  it('rejects an event missing prev_hash', () => {
    const event = makeEvent()
    const { prev_hash: _omit, ...invalid } = event
    expect(() => AuditEventSchema.parse(invalid)).toThrow()
  })

  it('rejects malformed event_type', () => {
    const event = makeEvent({ event_type: 'INVALID' })
    expect(() => AuditEventSchema.parse(event)).toThrow()
  })

  it('event_id is UUID-shaped', () => {
    const id = generateAuditEventId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('event_id v7 prefix is monotonic with time', () => {
    const a = generateAuditEventId(1_700_000_000_000)
    const b = generateAuditEventId(1_700_000_001_000)
    expect(a.slice(0, 8) <= b.slice(0, 8)).toBe(true)
  })
})

describe('canonical event_type taxonomy', () => {
  it('regex matches `<domain>.<verb>[.<modifier>]`', () => {
    expect(AUDIT_EVENT_TYPE_REGEX.test('auth.login')).toBe(true)
    expect(AUDIT_EVENT_TYPE_REGEX.test('storage.write.ok')).toBe(true)
    expect(AUDIT_EVENT_TYPE_REGEX.test('NoUpperCase')).toBe(false)
    expect(AUDIT_EVENT_TYPE_REGEX.test('no_dot')).toBe(false)
  })

  it('verifyEventTypeDomain accepts registered domains', () => {
    expect(verifyEventTypeDomain('auth.login')).toEqual({ ok: true, domain: 'auth' })
  })

  it('verifyEventTypeDomain warns on unknown domain', () => {
    const result = verifyEventTypeDomain('weird.foo.bar')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unknown_domain')
    expect(result.domain).toBe('weird')
  })

  it('registry contains the foundation domains', () => {
    for (const d of ['auth', 'storage', 'credential', 'tenant', 'workspace', 'role', 'feature_flag']) {
      expect(EVENT_DOMAIN_REGISTRY.has(d)).toBe(true)
    }
  })
})

describe('canonicalize + hash determinism', () => {
  it('produces identical hash for re-ordered keys', () => {
    const a = makeCanonical()
    const b: AuditEventCanonicalInput = {
      severity: a.severity,
      hash_unused: undefined as never, // not part of canonical input
      tenant_id: a.tenant_id,
      workspace_id: a.workspace_id,
      payload_json: a.payload_json,
      ts: a.ts,
      event_id: a.event_id,
      actor: a.actor,
      request_id: a.request_id,
      event_type: a.event_type,
      prev_hash: a.prev_hash,
    } as AuditEventCanonicalInput
    delete (b as Record<string, unknown>).hash_unused
    expect(computeContractAuditEventHash(a)).toBe(computeContractAuditEventHash(b))
  })

  it('canonicalize sorts keys deterministically (same input)', () => {
    const input = makeCanonical()
    const a = canonicalizeAuditEvent(input)
    const b = canonicalizeAuditEvent({
      // Construct same fields in a different declaration order — output bytes
      // must match because canonicalize sorts keys.
      severity: input.severity,
      ts: input.ts,
      event_id: input.event_id,
      payload_json: input.payload_json,
      prev_hash: input.prev_hash,
      actor: input.actor,
      tenant_id: input.tenant_id,
      workspace_id: input.workspace_id,
      request_id: input.request_id,
      event_type: input.event_type,
    })
    expect(a).toBe(b)
  })

  it('changing payload_json changes hash', () => {
    const base = makeCanonical()
    const tampered = { ...base, payload_json: '{"ok":false}' }
    expect(computeContractAuditEventHash(base)).not.toBe(computeContractAuditEventHash(tampered))
  })
})
