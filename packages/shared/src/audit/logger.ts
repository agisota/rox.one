/**
 * WT-08 — `logger.audit()` / `logger.telemetry()` single entry point.
 *
 * Composes with the existing audit-event-writer (which owns ROX_AUDIT_BACKEND
 * fanout) by providing a contract-level facade. This module is the API
 * downstream WT-10..WT-39 import from to emit events without knowing the
 * underlying store. Test-time sinks override the default fanout (console +
 * legacy writer) via `setAuditSink` / `setTelemetrySink`.
 */
import {
  AuditEventSchema,
  AUDIT_EVENT_TYPE_REGEX,
  INITIAL_AUDIT_PREV_HASH,
  computeAuditEventHash,
  generateAuditEventId,
  verifyEventTypeDomain,
  type AuditEventContract,
  type AuditSeverityValue,
} from './audit-event.ts'
import { sanitizePayload } from './sanitizer.ts'
import {
  TelemetryEventSchema,
  recordDroppedTelemetryAttributes,
  redactTelemetryAttributes,
  type TelemetryEvent,
} from './telemetry-event.ts'

export interface AuditEmitContext {
  actor?: string
  tenantId?: string | null
  workspaceId?: string | null
  requestId?: string | null
  prevHash?: string
  severity?: AuditSeverityValue
  ts?: string
  eventId?: string
}

export interface AuditEmitResult {
  event: AuditEventContract
  unknownDomain: boolean
}

export type AuditSink = (event: AuditEventContract) => void
export type TelemetrySink = (event: TelemetryEvent) => void
export type AuditLoggerWarn = (message: string, meta?: Record<string, unknown>) => void

interface LoggerState {
  auditSink: AuditSink | null
  telemetrySink: TelemetrySink | null
  warn: AuditLoggerWarn
  lastHashByChain: Map<string, string>
}

const LOGGER_STATE = Symbol.for('rox.audit.contractLoggerState')

function getState(): LoggerState {
  const root = globalThis as typeof globalThis & {
    [LOGGER_STATE]?: LoggerState
  }
  if (!root[LOGGER_STATE]) {
    root[LOGGER_STATE] = {
      auditSink: null,
      telemetrySink: null,
      warn: defaultWarn,
      lastHashByChain: new Map(),
    }
  }
  return root[LOGGER_STATE]
}

function defaultWarn(message: string, meta?: Record<string, unknown>): void {
  if (typeof process !== 'undefined' && process.stderr) {
    const suffix = meta ? ` ${JSON.stringify(meta)}` : ''
    process.stderr.write(`[audit:warn] ${message}${suffix}\n`)
  }
}

export function setAuditSink(sink: AuditSink | null): void {
  getState().auditSink = sink
}

export function setTelemetrySink(sink: TelemetrySink | null): void {
  getState().telemetrySink = sink
}

export function setAuditLoggerWarn(warn: AuditLoggerWarn | null): void {
  getState().warn = warn ?? defaultWarn
}

export function __resetContractLoggerForTests(): void {
  const state = getState()
  state.auditSink = null
  state.telemetrySink = null
  state.warn = defaultWarn
  state.lastHashByChain.clear()
}

function chainKey(tenantId: string | null, workspaceId: string | null): string {
  return `${tenantId ?? 'global'}::${workspaceId ?? 'global'}`
}

/**
 * Emit a contract-level audit event. The payload is sanitized BEFORE hashing
 * (A08-06). Unknown event-type domains do not throw; they emit with the
 * configured warn function and `unknownDomain: true`.
 */
export function emitAuditEvent(
  eventType: string,
  payload: Record<string, unknown>,
  context: AuditEmitContext = {},
): AuditEmitResult {
  const state = getState()
  const verification = verifyEventTypeDomain(eventType)
  if (verification.reason === 'invalid_format') {
    throw new Error(`Invalid audit event_type "${eventType}" — expected ${AUDIT_EVENT_TYPE_REGEX}`)
  }
  const unknownDomain = verification.reason === 'unknown_domain'
  if (unknownDomain) {
    state.warn('audit.unknown_domain', { eventType })
  }

  const tenantId = context.tenantId ?? null
  const workspaceId = context.workspaceId ?? null
  const chain = chainKey(tenantId, workspaceId)
  const prevHash = context.prevHash ?? state.lastHashByChain.get(chain) ?? INITIAL_AUDIT_PREV_HASH

  const sanitized = sanitizePayload(payload ?? {})
  const canonicalInput = {
    event_id: context.eventId ?? generateAuditEventId(),
    ts: context.ts ?? new Date().toISOString(),
    actor: context.actor ?? 'system',
    tenant_id: tenantId,
    workspace_id: workspaceId,
    request_id: context.requestId ?? null,
    event_type: eventType,
    severity: context.severity ?? 'info',
    payload_json: JSON.stringify(sanitized),
    prev_hash: prevHash,
  }
  const hash = computeAuditEventHash(canonicalInput)
  const event: AuditEventContract = { ...canonicalInput, hash }
  // Defensive parse — guards against future schema drift in callers.
  AuditEventSchema.parse(event)

  state.lastHashByChain.set(chain, hash)
  if (state.auditSink) state.auditSink(event)
  return { event, unknownDomain }
}

export interface TelemetryEmitResult {
  event: TelemetryEvent
  droppedKeys: string[]
}

export function emitTelemetryEvent(
  source: string,
  eventName: string,
  attributes: Record<string, unknown>,
  ts: string = new Date().toISOString(),
): TelemetryEmitResult {
  const state = getState()
  const { attributes: redacted, droppedKeys } = redactTelemetryAttributes(attributes ?? {})
  if (droppedKeys.length > 0) {
    state.warn('telemetry.pii_dropped', { source, event: eventName, keys: droppedKeys })
    recordDroppedTelemetryAttributes(droppedKeys.length)
  }
  const event: TelemetryEvent = TelemetryEventSchema.parse({
    ts,
    source,
    event: eventName,
    attributes: redacted,
  })
  if (state.telemetrySink) state.telemetrySink(event)
  return { event, droppedKeys }
}

/** Convenience facade matching the spec's `logger.audit()` / `logger.telemetry()` shape. */
export const contractLogger = {
  audit: emitAuditEvent,
  telemetry: emitTelemetryEvent,
}
