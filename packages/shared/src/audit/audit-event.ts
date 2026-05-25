/**
 * WT-08 — AuditEvent zod schema + canonical taxonomy + hash helpers.
 *
 * EXTENDS the existing `audit-event-store.ts` runtime: this module adds the
 * contract-level zod schema (`AuditEventSchema`), the `EventType` taxonomy
 * regex/registry, the `AuditSeverity` enum (info/warn/error/critical), and a
 * canonical hashing helper that uses the same sorted-keys/SHA-256 pipeline.
 *
 * Downstream WTs (WT-10..WT-39) emit through `logger.audit()` and need a
 * shareable, validatable contract. The legacy `AuditEventStorageBackend` is
 * preserved as-is; this schema is its public-facing wire format.
 */
import { createHash, randomBytes } from 'node:crypto'

import { z } from 'zod'

export const AUDIT_SEVERITY_VALUES = ['info', 'warn', 'error', 'critical'] as const
export type AuditSeverityValue = (typeof AUDIT_SEVERITY_VALUES)[number]
export const AuditSeveritySchema = z.enum(AUDIT_SEVERITY_VALUES)

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/
export const AUDIT_EVENT_TYPE_REGEX = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_.]*$/
export const AUDIT_ACTOR_REGEX = /^(?:system(?::[A-Za-z0-9_-]+)?|agent:[A-Za-z0-9_-]+|[A-Za-z0-9_:.@-]+)$/

export const INITIAL_AUDIT_PREV_HASH = '0'.repeat(64)

/**
 * Registry of allowed `<domain>` prefixes for `event_type`. Adding a domain
 * here is the canonical extension point — emit'ing an unregistered domain
 * does not throw (see A08-05) but `verifyEventTypeDomain()` will return
 * `{ ok: false, reason: 'unknown_domain' }` and callers should warn.
 */
export const EVENT_DOMAIN_REGISTRY: ReadonlySet<string> = new Set([
  'auth',
  'session',
  'scope',
  'storage',
  'credential',
  'tenant',
  'workspace',
  'team',
  'membership',
  'role',
  'entitlement',
  'feature_flag',
  'audit',
  'telemetry',
  'rbac',
  'admin',
  'system',
  'agent',
  'mail',
  'calendar',
  'crypto',
  'access',
])

export const AuditEventSchema = z.object({
  event_id: z.string().regex(UUID_REGEX, 'event_id must be a lowercase UUID'),
  ts: z.string().datetime({ offset: false }),
  actor: z.string().min(1).regex(AUDIT_ACTOR_REGEX, 'actor format invalid'),
  tenant_id: z.string().regex(UUID_REGEX).nullable(),
  workspace_id: z.string().regex(UUID_REGEX).nullable(),
  request_id: z.string().min(1).nullable(),
  event_type: z.string().regex(AUDIT_EVENT_TYPE_REGEX, 'event_type must match <domain>.<verb>[.<modifier>]'),
  severity: AuditSeveritySchema,
  payload_json: z.string(),
  prev_hash: z.string().regex(SHA256_HEX_REGEX, 'prev_hash must be 64-hex SHA-256'),
  hash: z.string().regex(SHA256_HEX_REGEX, 'hash must be 64-hex SHA-256'),
})
export type AuditEventContract = z.infer<typeof AuditEventSchema>

export type AuditEventCanonicalInput = Omit<AuditEventContract, 'hash'>

/**
 * UUID v7 generator (time-sortable). Uses native node 22+
 * `crypto.randomUUID('v7')` when available, falls back to a spec-compliant
 * manual impl otherwise.
 */
export function generateAuditEventId(now: number = Date.now()): string {
  // Manual v7 — RFC 9562 compliant; deterministic timestamp prefix for sort
  // order. We always use manual impl so behavior is identical cross-node.
  // Layout: <48-bit unix-ms-ts><4-bit ver=7><12-bit rand_a>
  //         <2-bit variant=10><62-bit rand_b>
  const tsHex = now.toString(16).padStart(12, '0')
  const rnd = randomBytes(10)

  const timeHigh = tsHex.slice(0, 8)
  const timeMid = tsHex.slice(8, 12)
  // 16-bit field: top 4 bits = version 7, bottom 12 bits = rand_a
  const verRandA = ((0x7 << 12) | ((rnd[0]! & 0x0f) << 8) | rnd[1]!)
    .toString(16)
    .padStart(4, '0')
  // 16-bit field: top 2 bits = variant 10, bottom 14 bits = rand_b high
  const varRandBHigh = (((rnd[2]! & 0x3f) | 0x80) << 8 | rnd[3]!)
    .toString(16)
    .padStart(4, '0')
  const randC = Array.from(rnd.slice(4, 10))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `${timeHigh}-${timeMid}-${verRandA}-${varRandBHigh}-${randC}`
}

export interface EventTypeVerification {
  ok: boolean
  reason?: 'invalid_format' | 'unknown_domain'
  domain?: string
}

export function verifyEventTypeDomain(eventType: string): EventTypeVerification {
  if (!AUDIT_EVENT_TYPE_REGEX.test(eventType)) {
    return { ok: false, reason: 'invalid_format' }
  }
  const domain = eventType.split('.', 1)[0]!
  if (!EVENT_DOMAIN_REGISTRY.has(domain)) {
    return { ok: false, reason: 'unknown_domain', domain }
  }
  return { ok: true, domain }
}

/**
 * Canonicalize an audit event hash input by sorting all object keys lexically
 * and stringifying without whitespace. This is the deterministic hashing
 * pre-image — DO NOT change without a chain re-anchor migration (O-1).
 */
export function canonicalizeAuditEvent(input: AuditEventCanonicalInput): string {
  return JSON.stringify(sortKeysDeep(input))
}

export function computeAuditEventHash(input: AuditEventCanonicalInput): string {
  return createHash('sha256').update(canonicalizeAuditEvent(input)).digest('hex')
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key])
  }
  return sorted
}
