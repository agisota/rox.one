/**
 * WT-08 — TelemetryEvent zod schema + PII drop + redaction.
 *
 * Telemetry is a SEPARATE channel from audit (A08-03):
 *   - no hash-chain, no append-only guarantee
 *   - may be sampled / dropped / batched
 *   - MUST NOT carry PII (email/phone/name/address keys dropped at emit time)
 *
 * Shares the `sanitizePayload` redaction rules for token/secret material via
 * `redactTelemetryAttributes`, plus a strict PII-key blocklist that drops the
 * attribute entirely (no `[REDACTED]` retention) and logs a warning.
 */
import { z } from 'zod'

import { sanitizePayload } from './sanitizer.ts'

export const TelemetrySourceRegex = /^[a-z][a-z0-9_-]*$/
export const TelemetryEventNameRegex = /^[a-z][a-z0-9_.]*$/

export const TelemetryAttributeValueSchema = z.union([z.string(), z.number(), z.boolean()])
export type TelemetryAttributeValue = z.infer<typeof TelemetryAttributeValueSchema>

export const TelemetryEventSchema = z.object({
  ts: z.string().datetime({ offset: false }),
  source: z.string().regex(TelemetrySourceRegex, 'source must be lower-snake/dash'),
  event: z.string().regex(TelemetryEventNameRegex, 'event must be lower-dot-snake'),
  attributes: z.record(z.string(), TelemetryAttributeValueSchema),
})
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>

const PII_KEY_PATTERNS: ReadonlyArray<RegExp> = [
  /^email$/i,
  /^e[-_]?mail$/i,
  /^phone$/i,
  /^phone[_-]?number$/i,
  /^mobile$/i,
  /^msisdn$/i,
  /^name$/i,
  /^full[_-]?name$/i,
  /^first[_-]?name$/i,
  /^last[_-]?name$/i,
  /^address$/i,
  /^street[_-]?address$/i,
  /^postal[_-]?code$/i,
  /^zip$/i,
  /^ip$/i,
  /^ip[_-]?address$/i,
  /^ssn$/i,
  /^dob$/i,
  /^date[_-]?of[_-]?birth$/i,
]

export interface TelemetryRedactionResult {
  attributes: Record<string, TelemetryAttributeValue>
  droppedKeys: string[]
}

/**
 * Apply PII-drop + token/secret redaction to telemetry attributes.
 * PII keys are DROPPED entirely (returned in `droppedKeys`), unlike audit
 * where they would be replaced with `[REDACTED]`.
 */
export function redactTelemetryAttributes(
  attributes: Record<string, unknown>,
): TelemetryRedactionResult {
  const droppedKeys: string[] = []
  const filtered: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attributes)) {
    if (PII_KEY_PATTERNS.some(p => p.test(key))) {
      droppedKeys.push(key)
      continue
    }
    filtered[key] = value
  }

  const sanitized = sanitizePayload(filtered)
  const normalized: Record<string, TelemetryAttributeValue> = {}
  for (const [key, value] of Object.entries(sanitized as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      normalized[key] = value
      continue
    }
    // Drop non-scalar redacted values (objects/arrays not allowed in telemetry).
    droppedKeys.push(key)
  }
  return { attributes: normalized, droppedKeys }
}

/** Test-only counter for dropped telemetry attributes (per process). */
const TELEMETRY_DROPPED_COUNTER = Symbol.for('rox.audit.telemetryDroppedCounter')

interface TelemetryDroppedCounter {
  count: number
}

function getCounter(): TelemetryDroppedCounter {
  const root = globalThis as typeof globalThis & {
    [TELEMETRY_DROPPED_COUNTER]?: TelemetryDroppedCounter
  }
  if (!root[TELEMETRY_DROPPED_COUNTER]) {
    root[TELEMETRY_DROPPED_COUNTER] = { count: 0 }
  }
  return root[TELEMETRY_DROPPED_COUNTER]
}

export function recordDroppedTelemetryAttributes(count: number): void {
  getCounter().count += count
}

export function getDroppedTelemetryAttributesCount(): number {
  return getCounter().count
}

export function __resetTelemetryCountersForTests(): void {
  getCounter().count = 0
}
