import { describe, expect, it } from 'bun:test'

import { asCorrelationId } from '../correlation.ts'
import {
  AUDIT_EVENT_KINDS,
  type AuditEvent,
  type LoginFailedEvent,
  type MissionCompletedEvent,
  type RoleGrantedEvent,
  isAuditEvent,
} from '../audit-event.ts'

const TS = '2026-05-13T12:00:00.000Z'

function roleGranted(): RoleGrantedEvent {
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

function loginFailed(): LoginFailedEvent {
  return {
    kind: 'LoginFailed',
    ts: TS,
    correlationId: asCorrelationId('cid-2'),
    actor: { type: 'user', id: 'alice' },
    subject: { type: 'user', id: 'alice' },
    scope: { kind: 'global' },
    reason: 'bad-password',
  }
}

function missionCompleted(): MissionCompletedEvent {
  return {
    kind: 'MissionCompleted',
    ts: TS,
    correlationId: asCorrelationId('cid-3'),
    actor: { type: 'system' },
    subject: { type: 'mission', id: 'm-1' },
    scope: { kind: 'workspace', workspaceId: 'ws-1' },
    missionId: 'm-1',
    durationMs: 1234,
  }
}

describe('AUDIT_EVENT_KINDS registry', () => {
  it('lists exactly the nine canonical kinds', () => {
    expect(AUDIT_EVENT_KINDS).toEqual([
      'RoleGranted',
      'RoleRevoked',
      'LoginSucceeded',
      'LoginFailed',
      'WorkspaceCreated',
      'WorkspaceDeleted',
      'MissionStarted',
      'MissionCompleted',
      'MissionFailed',
    ])
  })

  it('has no duplicate kinds', () => {
    expect(new Set(AUDIT_EVENT_KINDS).size).toBe(AUDIT_EVENT_KINDS.length)
  })
})

describe('AuditEvent shapes', () => {
  it('RoleGranted carries a roleName and subject', () => {
    const e = roleGranted()
    expect(e.kind).toBe('RoleGranted')
    expect(e.roleName).toBe('editor')
    expect(e.subject.id).toBe('user-2')
  })

  it('LoginFailed carries a reason', () => {
    const e = loginFailed()
    expect(e.kind).toBe('LoginFailed')
    expect(e.reason).toBe('bad-password')
  })

  it('MissionCompleted carries missionId and durationMs', () => {
    const e = missionCompleted()
    expect(e.kind).toBe('MissionCompleted')
    expect(e.missionId).toBe('m-1')
    expect(e.durationMs).toBe(1234)
  })

  it('every event has actor + subject + scope + ts + correlationId', () => {
    const events: AuditEvent[] = [roleGranted(), loginFailed(), missionCompleted()]
    for (const e of events) {
      expect(e.actor).toBeDefined()
      expect(e.subject).toBeDefined()
      expect(e.scope).toBeDefined()
      expect(typeof e.ts).toBe('string')
      expect(typeof e.correlationId).toBe('string')
    }
  })
})

describe('isAuditEvent guard', () => {
  it('accepts well-formed events of every kind', () => {
    expect(isAuditEvent(roleGranted())).toBe(true)
    expect(isAuditEvent(loginFailed())).toBe(true)
    expect(isAuditEvent(missionCompleted())).toBe(true)
  })

  it('rejects unknown kinds', () => {
    expect(isAuditEvent({ ...roleGranted(), kind: 'NotAKind' })).toBe(false)
  })

  it('rejects events missing required core fields', () => {
    const base = roleGranted() as unknown as Record<string, unknown>
    for (const required of ['kind', 'ts', 'actor', 'subject', 'scope', 'correlationId']) {
      const broken = { ...base }
      delete broken[required]
      expect(isAuditEvent(broken)).toBe(false)
    }
  })

  it('rejects non-object inputs', () => {
    expect(isAuditEvent(null)).toBe(false)
    expect(isAuditEvent(undefined)).toBe(false)
    expect(isAuditEvent('RoleGranted')).toBe(false)
    expect(isAuditEvent(42)).toBe(false)
    expect(isAuditEvent([])).toBe(false)
  })

  it('round-trips through JSON without information loss', () => {
    const event = roleGranted()
    const serialised = JSON.parse(JSON.stringify(event)) as unknown
    expect(isAuditEvent(serialised)).toBe(true)
    expect(serialised).toEqual(event)
  })
})
