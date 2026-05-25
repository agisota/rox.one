// Existing exports — preserved as-is (audit-event-writer + legacy store).
export * from './audit-event-store.ts'
export * from './audit-event-writer.ts'

// WT-08 — Contract-level schemas + sanitizer + logger fanout.
// Re-exported under explicit names to avoid collisions with the legacy store's
// `INITIAL_AUDIT_EVENT_HASH` / `verifyAuditHashChain` symbols.
export {
  AUDIT_SEVERITY_VALUES,
  AuditSeveritySchema,
  AuditEventSchema,
  AUDIT_EVENT_TYPE_REGEX,
  AUDIT_ACTOR_REGEX,
  INITIAL_AUDIT_PREV_HASH,
  EVENT_DOMAIN_REGISTRY,
  generateAuditEventId,
  verifyEventTypeDomain,
  canonicalizeAuditEvent,
  computeAuditEventHash as computeContractAuditEventHash,
} from './audit-event.ts'
export type {
  AuditEventContract,
  AuditEventCanonicalInput,
  AuditSeverityValue,
  EventTypeVerification,
} from './audit-event.ts'

export {
  REDACTED_PLACEHOLDER,
  DEFAULT_SANITIZER_PATTERNS,
  sanitizePayload,
} from './sanitizer.ts'
export type { SanitizerOptions } from './sanitizer.ts'

export {
  TelemetryEventSchema,
  TelemetryAttributeValueSchema,
  TelemetrySourceRegex,
  TelemetryEventNameRegex,
  redactTelemetryAttributes,
  recordDroppedTelemetryAttributes,
  getDroppedTelemetryAttributesCount,
  __resetTelemetryCountersForTests,
} from './telemetry-event.ts'
export type {
  TelemetryEvent,
  TelemetryAttributeValue,
  TelemetryRedactionResult,
} from './telemetry-event.ts'

export {
  emitAuditEvent,
  emitTelemetryEvent,
  setAuditSink,
  setTelemetrySink,
  setAuditLoggerWarn,
  contractLogger,
  __resetContractLoggerForTests,
} from './logger.ts'
export type {
  AuditEmitContext,
  AuditEmitResult,
  AuditSink,
  TelemetrySink,
  AuditLoggerWarn,
  TelemetryEmitResult,
} from './logger.ts'
