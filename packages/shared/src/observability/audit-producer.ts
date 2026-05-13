/**
 * AuditProducer — fan-out of audit-worthy events to the audit sink AND the
 * structured logger.
 *
 * The producer is the only public entry point a call site needs to know
 * about. It:
 *   1. Validates the input against the canonical audit-event taxonomy.
 *   2. Stamps `ts` (clock-injected) and `correlationId`
 *      (`currentCorrelationId()` with a synthesised fallback).
 *   3. Emits the canonical `AuditEvent` to the injected `AuditSink`.
 *   4. Fans out a structured log line at a level appropriate to the kind
 *      (info for normal lifecycle, warn for `LoginFailed`, error for
 *      `MissionFailed`).
 *
 * Sink failures are isolated: a thrown audit sink does NOT prevent the log
 * fan-out, and conversely no caller is ever crashed by a misbehaving sink.
 */
import { type CorrelationId, asCorrelationId, currentCorrelationId } from './correlation.ts'
import {
  AUDIT_EVENT_KINDS,
  type AuditEvent,
  type AuditEventInput,
  type AuditEventKind,
} from './audit-event.ts'
import { type Clock, type StructuredLogger } from './structured-logger.ts'
import { type LogLevel } from './log-level.ts'

export type AuditSink = (event: AuditEvent) => void

export interface AuditProducer {
  emit(input: AuditEventInput): AuditEvent
}

export interface CreateAuditProducerOptions {
  sink: AuditSink
  logger: StructuredLogger
  clock: Clock
}

const KIND_LOG_LEVEL: Readonly<Record<AuditEventKind, LogLevel>> = {
  RoleGranted: 'info',
  RoleRevoked: 'info',
  LoginSucceeded: 'info',
  LoginFailed: 'warn',
  WorkspaceCreated: 'info',
  WorkspaceDeleted: 'info',
  MissionStarted: 'info',
  MissionCompleted: 'info',
  MissionFailed: 'error',
}

export function createAuditProducer(options: CreateAuditProducerOptions): AuditProducer {
  return {
    emit(input) {
      const event = normalise(input, options.clock)
      validate(event)
      try {
        options.sink(event)
      } catch (err) {
        options.logger.error('audit.sinkError', { kind: event.kind, err })
      }
      options.logger.log(KIND_LOG_LEVEL[event.kind], `audit.${event.kind}`, {
        kind: event.kind,
        actor: event.actor,
        subject: event.subject,
        scope: event.scope,
        correlationId: event.correlationId,
      })
      return event
    },
  }
}

function normalise(input: AuditEventInput, clock: Clock): AuditEvent {
  const ts = input.ts ?? clock().toISOString()
  const correlationId = input.correlationId ?? currentCorrelationId() ?? synthesiseCorrelationId()
  // `input` may be any concrete member of the union; we strip `ts`/`correlationId`
  // overrides off the input shape and reattach our normalised values. This keeps
  // the discriminated union's per-kind extra fields intact.
  return { ...(input as object), ts, correlationId } as AuditEvent
}

function synthesiseCorrelationId(): CorrelationId {
  // globalThis.crypto.randomUUID() is available in browsers (Web Crypto API)
  // and in Node >= 14.17 / Bun — avoids a node:crypto import that breaks the
  // Vite renderer build (renderer is browser-targeted, not Node).
  return asCorrelationId(`auto-${globalThis.crypto.randomUUID()}`)
}

function validate(event: AuditEvent): void {
  if (!(AUDIT_EVENT_KINDS as readonly string[]).includes(event.kind)) {
    throw new Error(`audit-producer: unknown audit event kind: ${event.kind as string}`)
  }
  if (!isValidActor(event)) {
    throw new Error('audit-producer: invalid actor on audit event')
  }
  if (!isValidSubject(event)) {
    throw new Error('audit-producer: invalid subject on audit event')
  }
  if (!isValidScope(event)) {
    throw new Error('audit-producer: invalid scope on audit event')
  }
}

function isValidActor(event: AuditEvent): boolean {
  const actor = event.actor
  if (actor.type === 'system') return true
  if (actor.type === 'user' || actor.type === 'service') {
    return typeof actor.id === 'string' && actor.id.length > 0
  }
  return false
}

function isValidSubject(event: AuditEvent): boolean {
  return typeof event.subject.id === 'string' && event.subject.id.length > 0
}

function isValidScope(event: AuditEvent): boolean {
  const scope = event.scope
  if (scope.kind === 'global') return true
  if (scope.kind === 'workspace') return scope.workspaceId.length > 0
  if (scope.kind === 'mission') {
    return scope.workspaceId.length > 0 && scope.missionId.length > 0
  }
  return false
}
