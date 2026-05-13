/**
 * M.14 observability producer surface.
 *
 * This package exposes the *producer* half of ROX's observability story:
 * call sites import from here to emit structured logs and audit events.
 * Consumer wiring (transport, persistence, renderer projection) lives
 * elsewhere — see T246 (RBAC + missions call sites) and T247 (renderer
 * telemetry consumer).
 */

export {
  type CorrelationId,
  asCorrelationId,
  currentCorrelationId,
  withCorrelationId,
} from './correlation.ts'

export {
  LOG_LEVELS,
  type LogLevel,
  assertLogLevel,
  compareLogLevels,
  isLogLevel,
  logLevelRank,
  shouldLog,
} from './log-level.ts'

export {
  type Clock,
  type CreateStructuredLoggerOptions,
  type LogFields,
  type LogRecord,
  type LogSink,
  type StructuredLogger,
  createStructuredLogger,
} from './structured-logger.ts'

export {
  AUDIT_EVENT_KINDS,
  type AuditActor,
  type AuditEvent,
  type AuditEventInput,
  type AuditEventKind,
  type AuditScope,
  type AuditSubject,
  type LoginFailedEvent,
  type LoginSucceededEvent,
  type MissionCompletedEvent,
  type MissionFailedEvent,
  type MissionStartedEvent,
  type RoleGrantedEvent,
  type RoleRevokedEvent,
  type WorkspaceCreatedEvent,
  type WorkspaceDeletedEvent,
  isAuditEvent,
} from './audit-event.ts'

export {
  type AuditProducer,
  type AuditSink,
  type CreateAuditProducerOptions,
  createAuditProducer,
} from './audit-producer.ts'
