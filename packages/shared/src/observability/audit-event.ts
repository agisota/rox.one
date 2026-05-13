/**
 * Canonical audit-event taxonomy for the M.14 producer surface.
 *
 * Each event union member carries the same five core fields — kind, ts,
 * correlationId, actor, subject, scope — plus a small set of kind-specific
 * extras (e.g. `roleName` on `RoleGranted`, `reason` on `LoginFailed`,
 * `durationMs` on `MissionCompleted`). The union is exhaustive: adding a new
 * audit kind requires extending both `AUDIT_EVENT_KINDS` and the
 * discriminated union below, and `isAuditEvent` keeps validation honest.
 */
import { type CorrelationId } from './correlation-id.ts'

export const AUDIT_EVENT_KINDS = [
  'RoleGranted',
  'RoleRevoked',
  'LoginSucceeded',
  'LoginFailed',
  'WorkspaceCreated',
  'WorkspaceDeleted',
  'MissionStarted',
  'MissionCompleted',
  'MissionFailed',
] as const

export type AuditEventKind = (typeof AUDIT_EVENT_KINDS)[number]

/** Origin of the audit-worthy action (the "who is doing this"). */
export type AuditActor =
  | { type: 'user'; id: string }
  | { type: 'system' }
  | { type: 'service'; id: string }

/** Entity the action is performed upon (the "to whom" or "to what"). */
export type AuditSubject =
  | { type: 'user'; id: string }
  | { type: 'workspace'; id: string }
  | { type: 'mission'; id: string }
  | { type: 'role'; id: string }

/** Authorisation envelope under which the action is recorded. */
export type AuditScope =
  | { kind: 'global' }
  | { kind: 'workspace'; workspaceId: string }
  | { kind: 'mission'; workspaceId: string; missionId: string }

interface AuditEventBase<K extends AuditEventKind> {
  kind: K
  ts: string
  correlationId: CorrelationId
  actor: AuditActor
  subject: AuditSubject
  scope: AuditScope
}

export interface RoleGrantedEvent extends AuditEventBase<'RoleGranted'> {
  roleName: string
}

export interface RoleRevokedEvent extends AuditEventBase<'RoleRevoked'> {
  roleName: string
}

export interface LoginSucceededEvent extends AuditEventBase<'LoginSucceeded'> {
  method?: string
}

export interface LoginFailedEvent extends AuditEventBase<'LoginFailed'> {
  reason: string
}

export interface WorkspaceCreatedEvent extends AuditEventBase<'WorkspaceCreated'> {
  workspaceId: string
}

export interface WorkspaceDeletedEvent extends AuditEventBase<'WorkspaceDeleted'> {
  workspaceId: string
}

export interface MissionStartedEvent extends AuditEventBase<'MissionStarted'> {
  missionId: string
}

export interface MissionCompletedEvent extends AuditEventBase<'MissionCompleted'> {
  missionId: string
  durationMs: number
}

export interface MissionFailedEvent extends AuditEventBase<'MissionFailed'> {
  missionId: string
  errorMessage: string
}

/**
 * Exhaustive union of every concrete audit-event shape. Switch over `kind`
 * to fan out; TypeScript ensures the switch is exhaustive at compile time.
 */
export type AuditEvent =
  | RoleGrantedEvent
  | RoleRevokedEvent
  | LoginSucceededEvent
  | LoginFailedEvent
  | WorkspaceCreatedEvent
  | WorkspaceDeletedEvent
  | MissionStartedEvent
  | MissionCompletedEvent
  | MissionFailedEvent

/**
 * Input shape accepted by `AuditProducer.emit`. The producer fills in `ts`
 * and `correlationId` automatically when absent, so callers normally pass
 * only the semantically-meaningful fields.
 */
export type AuditEventInput = DistributiveOmit<AuditEvent, 'ts' | 'correlationId'> & {
  ts?: string
  correlationId?: CorrelationId
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/**
 * Runtime guard: does `value` quack like an `AuditEvent`? Defensive against
 * cross-process boundaries (JSON over IPC, dehydrated state) where the
 * compile-time union has been erased.
 */
export function isAuditEvent(value: unknown): value is AuditEvent {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const v = value as Record<string, unknown>
  if (typeof v.kind !== 'string') return false
  if (!(AUDIT_EVENT_KINDS as readonly string[]).includes(v.kind)) return false
  if (typeof v.ts !== 'string' || v.ts.length === 0) return false
  if (typeof v.correlationId !== 'string' || v.correlationId.length === 0) return false
  if (!isAuditActor(v.actor)) return false
  if (!isAuditSubject(v.subject)) return false
  if (!isAuditScope(v.scope)) return false
  return true
}

function isAuditActor(value: unknown): value is AuditActor {
  if (value === null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (v.type === 'system') return true
  if (v.type === 'user' || v.type === 'service') {
    return typeof v.id === 'string' && v.id.length > 0
  }
  return false
}

function isAuditSubject(value: unknown): value is AuditSubject {
  if (value === null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (v.type === 'user' || v.type === 'workspace' || v.type === 'mission' || v.type === 'role') {
    return typeof v.id === 'string' && v.id.length > 0
  }
  return false
}

function isAuditScope(value: unknown): value is AuditScope {
  if (value === null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (v.kind === 'global') return true
  if (v.kind === 'workspace') {
    return typeof v.workspaceId === 'string' && v.workspaceId.length > 0
  }
  if (v.kind === 'mission') {
    return (
      typeof v.workspaceId === 'string' &&
      v.workspaceId.length > 0 &&
      typeof v.missionId === 'string' &&
      v.missionId.length > 0
    )
  }
  return false
}
