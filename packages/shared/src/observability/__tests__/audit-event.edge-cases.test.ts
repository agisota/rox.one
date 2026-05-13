/**
 * T255 — payload-validation edge cases for the audit-event taxonomy.
 *
 * Companion to `audit-event.test.ts`. The base suite proves canonical events
 * round-trip through `isAuditEvent`; this file pins the boundary conditions:
 *
 *  - actor shape lattice (system never carries id; user/service require id)
 *  - subject + scope rejection when ids are empty strings
 *  - kind whitelist enforced strictly (case-sensitive, no prefix matches)
 *  - JSON-revival pathways with subtle structural drift
 *
 * Pure-function tests against the runtime guard — no source edits.
 */
import { describe, expect, it } from 'bun:test'

import { asCorrelationId } from '../correlation.ts'
import {
  AUDIT_EVENT_KINDS,
  type RoleGrantedEvent,
  isAuditEvent,
} from '../audit-event.ts'

const TS = '2026-05-13T12:00:00.000Z'

function baseRoleGranted(): RoleGrantedEvent {
  return {
    kind: 'RoleGranted',
    ts: TS,
    correlationId: asCorrelationId('cid-1'),
    actor: { type: 'user', id: 'admin-1' },
    subject: { type: 'user', id: 'user-2' },
    scope: { kind: 'workspace', workspaceId: 'ws-9' },
    roleName: 'editor',
  }
}

describe('T255 isAuditEvent — actor lattice', () => {
  it('accepts a system actor with no id field', () => {
    const event = { ...baseRoleGranted(), actor: { type: 'system' } }
    expect(isAuditEvent(event)).toBe(true)
  })

  it('accepts service actors with a non-empty id', () => {
    const event = { ...baseRoleGranted(), actor: { type: 'service', id: 'svc-mailer' } }
    expect(isAuditEvent(event)).toBe(true)
  })

  it('rejects user actors with an empty id', () => {
    const event = { ...baseRoleGranted(), actor: { type: 'user', id: '' } }
    expect(isAuditEvent(event)).toBe(false)
  })

  it('rejects service actors missing the id field', () => {
    const event = { ...baseRoleGranted(), actor: { type: 'service' } }
    expect(isAuditEvent(event)).toBe(false)
  })

  it('rejects actors with an unknown type discriminator', () => {
    const event = { ...baseRoleGranted(), actor: { type: 'bot', id: 'b-1' } }
    expect(isAuditEvent(event)).toBe(false)
  })

  it('rejects actors that are arrays or primitives', () => {
    for (const bad of [[], null, 'system', 42, true]) {
      const event = { ...baseRoleGranted(), actor: bad }
      expect(isAuditEvent(event)).toBe(false)
    }
  })
})

describe('T255 isAuditEvent — subject lattice', () => {
  it('accepts each canonical subject type with a non-empty id', () => {
    for (const type of ['user', 'workspace', 'mission', 'role'] as const) {
      const event = { ...baseRoleGranted(), subject: { type, id: 'X-1' } }
      expect(isAuditEvent(event)).toBe(true)
    }
  })

  it('rejects subjects whose id is the empty string', () => {
    const event = { ...baseRoleGranted(), subject: { type: 'user', id: '' } }
    expect(isAuditEvent(event)).toBe(false)
  })

  it('rejects subjects whose id is a non-string value', () => {
    for (const badId of [42, null, undefined, {}, []]) {
      const event = { ...baseRoleGranted(), subject: { type: 'user', id: badId } }
      expect(isAuditEvent(event)).toBe(false)
    }
  })

  it('rejects subjects with an unknown type discriminator', () => {
    const event = { ...baseRoleGranted(), subject: { type: 'team', id: 'T-1' } }
    expect(isAuditEvent(event)).toBe(false)
  })
})

describe('T255 isAuditEvent — scope lattice', () => {
  it('accepts a workspace scope with a non-empty workspaceId', () => {
    const event = { ...baseRoleGranted(), scope: { kind: 'workspace', workspaceId: 'ws-1' } }
    expect(isAuditEvent(event)).toBe(true)
  })

  it('rejects a workspace scope whose workspaceId is the empty string', () => {
    const event = { ...baseRoleGranted(), scope: { kind: 'workspace', workspaceId: '' } }
    expect(isAuditEvent(event)).toBe(false)
  })

  it('accepts a mission scope with both ids present', () => {
    const event = {
      ...baseRoleGranted(),
      scope: { kind: 'mission', workspaceId: 'ws-1', missionId: 'm-1' },
    }
    expect(isAuditEvent(event)).toBe(true)
  })

  it('rejects a mission scope missing either id', () => {
    const e1 = { ...baseRoleGranted(), scope: { kind: 'mission', workspaceId: 'ws-1', missionId: '' } }
    const e2 = { ...baseRoleGranted(), scope: { kind: 'mission', workspaceId: '', missionId: 'm-1' } }
    expect(isAuditEvent(e1)).toBe(false)
    expect(isAuditEvent(e2)).toBe(false)
  })

  it('rejects scope objects with an unknown kind', () => {
    const event = { ...baseRoleGranted(), scope: { kind: 'org', workspaceId: 'ws-1' } }
    expect(isAuditEvent(event)).toBe(false)
  })
})

describe('T255 isAuditEvent — kind whitelist strictness', () => {
  it('rejects kinds with leading/trailing whitespace', () => {
    for (const k of [' RoleGranted', 'RoleGranted ', '\tRoleGranted']) {
      const event = { ...baseRoleGranted(), kind: k }
      expect(isAuditEvent(event)).toBe(false)
    }
  })

  it('rejects kinds that differ only by case', () => {
    for (const k of ['rolegranted', 'ROLEGRANTED', 'roleGranted']) {
      const event = { ...baseRoleGranted(), kind: k }
      expect(isAuditEvent(event)).toBe(false)
    }
  })

  it('accepts every canonical kind from AUDIT_EVENT_KINDS as the kind field', () => {
    // We only need to assert that the kind whitelist (the runtime gate)
    // accepts each canonical entry, regardless of kind-specific extras.
    for (const k of AUDIT_EVENT_KINDS) {
      const event = { ...baseRoleGranted(), kind: k }
      expect(isAuditEvent(event)).toBe(true)
    }
  })
})

describe('T255 isAuditEvent — payload validation around ts and correlationId', () => {
  it('rejects events whose ts is the empty string', () => {
    const event = { ...baseRoleGranted(), ts: '' }
    expect(isAuditEvent(event)).toBe(false)
  })

  it('rejects events whose ts is not a string', () => {
    for (const bad of [0, null, undefined, new Date()]) {
      const event = { ...baseRoleGranted(), ts: bad }
      expect(isAuditEvent(event)).toBe(false)
    }
  })

  it('rejects events whose correlationId is the empty string', () => {
    const event = { ...baseRoleGranted(), correlationId: '' as unknown as RoleGrantedEvent['correlationId'] }
    expect(isAuditEvent(event)).toBe(false)
  })

  it('rejects events whose correlationId is not a string', () => {
    for (const bad of [123, null, undefined, {}]) {
      const event = { ...baseRoleGranted(), correlationId: bad as unknown as RoleGrantedEvent['correlationId'] }
      expect(isAuditEvent(event)).toBe(false)
    }
  })
})

describe('T255 isAuditEvent — JSON revival drift', () => {
  it('rejects a deserialised event where actor was flattened to a string', () => {
    const raw = { ...baseRoleGranted(), actor: 'user:admin-1' as unknown as RoleGrantedEvent['actor'] }
    const serialised = JSON.parse(JSON.stringify(raw)) as unknown
    expect(isAuditEvent(serialised)).toBe(false)
  })

  it('rejects an event with a nested-array scope (defensive: arrays are not objects)', () => {
    const raw = { ...baseRoleGranted(), scope: [{ kind: 'global' }] as unknown as RoleGrantedEvent['scope'] }
    expect(isAuditEvent(raw)).toBe(false)
  })

  it('accepts a defensively-cloned valid event (round-trip through JSON)', () => {
    const event = baseRoleGranted()
    const clone = JSON.parse(JSON.stringify(event)) as unknown
    expect(isAuditEvent(clone)).toBe(true)
  })
})
