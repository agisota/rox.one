export * from '@craft-agent/shared/audit'

import type {
  AuditEventActor,
  AuditEventRecord,
  AuditEventStorageBackend,
} from '@craft-agent/shared/audit'

export interface AuditEventQuery {
  tenantId?: string
  actorType?: AuditEventActor['type']
  actorId?: string
  eventType?: string
  from?: Date | string
  to?: Date | string
  limit?: number
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
