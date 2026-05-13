import { createHash } from 'node:crypto'

import {
  INITIAL_AUDIT_EVENT_HASH,
  type AuditEventActor,
  type AuditEventRecord,
  type AuditEventStorageBackend,
} from '@craft-agent/shared/audit'

export * from '@craft-agent/shared/audit'

export interface AuditEventQuery {
  tenantId?: string
  actorType?: AuditEventActor['type']
  actorId?: string
  eventType?: string
  from?: Date | string
  to?: Date | string
  limit?: number
}

export interface AuditRetentionRule {
  eventType: string
  retention_days: number
}

export interface AuditRetentionPolicy {
  rules: AuditRetentionRule[]
  now?: Date | string
  retainedAt?: Date | string
}

export interface AuditRetentionMetadata {
  retainedAt: string
  originalPreviousEventHash: string
  originalEventHash: string
  reanchoredPreviousEventHash: string
}

export interface RetainedAuditEventRecord extends AuditEventRecord {
  retention: AuditRetentionMetadata
}

export interface AuditRetentionResult {
  records: RetainedAuditEventRecord[]
  removedRecords: AuditEventRecord[]
  removedCount: number
  retainedAt: string
}

const DEFAULT_AUDIT_QUERY_LIMIT = 100
const MAX_AUDIT_QUERY_LIMIT = 500

export async function queryAuditEventRecords(
  store: AuditEventStorageBackend,
  query: AuditEventQuery = {},
): Promise<AuditEventRecord[]> {
  const fromMs = query.from == null ? null : toTimestampMs(query.from, 'from')
  const toMs = query.to == null ? null : toTimestampMs(query.to, 'to')
  const limit = normalizeLimit(query.limit)

  return (await store.listRecords())
    .filter(record => matchesAuditQuery(record, query, fromMs, toMs))
    .sort(compareNewestFirst)
    .slice(0, limit)
    .map(copyAuditEventRecord)
}

export function applyAuditRetentionPolicy(
  records: readonly AuditEventRecord[],
  policy: AuditRetentionPolicy,
): AuditRetentionResult {
  const nowMs = toTimestampMs(policy.now ?? new Date(), 'from')
  const retainedAt = toIsoTimestamp(policy.retainedAt ?? new Date(nowMs))
  const rulesByEventType = new Map(policy.rules.map(rule => [rule.eventType, normalizeRetentionDays(rule)]))
  const removedRecords: AuditEventRecord[] = []
  const retainedOriginals: AuditEventRecord[] = []

  for (const record of records) {
    const retentionDays = rulesByEventType.get(record.eventType)
    if (retentionDays == null || !isExpiredForRetention(record, retentionDays, nowMs)) {
      retainedOriginals.push(record)
    } else {
      removedRecords.push(copyAuditEventRecord(record))
    }
  }

  return {
    records: reanchorRetainedRecords(retainedOriginals, retainedAt),
    removedRecords,
    removedCount: removedRecords.length,
    retainedAt,
  }
}

function matchesAuditQuery(
  record: AuditEventRecord,
  query: AuditEventQuery,
  fromMs: number | null,
  toMs: number | null,
): boolean {
  if (query.tenantId && record.tenantId !== query.tenantId) return false
  if (query.actorType && record.actor.type !== query.actorType) return false
  if (query.actorId && record.actor.id !== query.actorId) return false
  if (query.eventType && record.eventType !== query.eventType) return false

  const recordMs = Date.parse(record.ts)
  if (fromMs != null && recordMs < fromMs) return false
  if (toMs != null && recordMs > toMs) return false
  return true
}

function toTimestampMs(value: Date | string, key: 'from' | 'to'): number {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid audit query ${key} timestamp`)
  }
  return timestamp
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isSafeInteger(limit) || limit! <= 0) return DEFAULT_AUDIT_QUERY_LIMIT
  return Math.min(limit!, MAX_AUDIT_QUERY_LIMIT)
}

function compareNewestFirst(left: AuditEventRecord, right: AuditEventRecord): number {
  const byTime = Date.parse(right.ts) - Date.parse(left.ts)
  if (byTime !== 0) return byTime
  return right.eventId.localeCompare(left.eventId)
}

function normalizeRetentionDays(rule: AuditRetentionRule): number {
  if (!Number.isSafeInteger(rule.retention_days) || rule.retention_days < 0) {
    throw new Error(`Invalid audit retention_days for ${rule.eventType}`)
  }
  return rule.retention_days
}

function isExpiredForRetention(record: AuditEventRecord, retentionDays: number, nowMs: number): boolean {
  const recordMs = Date.parse(record.ts)
  if (!Number.isFinite(recordMs)) return false
  const cutoffMs = nowMs - (retentionDays * 24 * 60 * 60 * 1000)
  return recordMs < cutoffMs
}

function reanchorRetainedRecords(records: readonly AuditEventRecord[], retainedAt: string): RetainedAuditEventRecord[] {
  let previousEventHash = INITIAL_AUDIT_EVENT_HASH
  return records.map(record => {
    const retainedRecord: RetainedAuditEventRecord = {
      ...copyAuditEventRecord(record),
      previousEventHash,
      eventHash: '',
      retention: {
        retainedAt,
        originalPreviousEventHash: record.previousEventHash,
        originalEventHash: record.eventHash,
        reanchoredPreviousEventHash: previousEventHash,
      },
    }
    retainedRecord.eventHash = computeAuditEventHash(retainedRecord)
    previousEventHash = retainedRecord.eventHash
    return retainedRecord
  })
}

function computeAuditEventHash(record: AuditEventRecord): string {
  const hashInput = {
    eventId: record.eventId,
    ts: record.ts,
    actor: record.actor,
    ...(record.tenantId ? { tenantId: record.tenantId } : {}),
    eventType: record.eventType,
    severity: record.severity,
    payloadJson: record.payloadJson,
    ...(record.requestId ? { requestId: record.requestId } : {}),
    previousEventHash: record.previousEventHash,
  }
  return createHash('sha256').update(stableStringify(hashInput)).digest('hex')
}

function copyAuditEventRecord(record: AuditEventRecord): AuditEventRecord {
  return {
    eventId: record.eventId,
    ts: record.ts,
    actor: {
      type: record.actor.type,
      ...(record.actor.id ? { id: record.actor.id } : {}),
      ...(record.actor.teamId ? { teamId: record.actor.teamId } : {}),
      ...(record.actor.role ? { role: record.actor.role } : {}),
    },
    ...(record.tenantId ? { tenantId: record.tenantId } : {}),
    eventType: record.eventType,
    severity: record.severity,
    payloadJson: record.payloadJson,
    ...(record.requestId ? { requestId: record.requestId } : {}),
    previousEventHash: record.previousEventHash,
    eventHash: record.eventHash,
  }
}

function toIsoTimestamp(value: Date | string): string {
  return new Date(value).toISOString()
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortForStableStringify(value))
}

function sortForStableStringify(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortForStableStringify)

  const result: Record<string, unknown> = {}
  for (const [key, childValue] of Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) {
    result[key] = sortForStableStringify(childValue)
  }
  return result
}
