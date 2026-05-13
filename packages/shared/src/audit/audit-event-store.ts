import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

import { getConfigDir } from '../config/paths.ts'

export type AuditEventSeverity = 'trace' | 'info' | 'warn' | 'error' | 'security'

export interface AuditEventActor {
  type: 'user' | 'system' | 'service'
  id?: string
  teamId?: string
  role?: string
}

export interface AuditEventInput {
  actor: AuditEventActor
  tenantId?: string
  eventType: string
  severity?: AuditEventSeverity
  payload?: Record<string, unknown>
  requestId?: string
  ts?: Date | string
}

export interface AuditEventRecord {
  eventId: string
  ts: string
  actor: AuditEventActor
  tenantId?: string
  eventType: string
  severity: AuditEventSeverity
  payloadJson: string
  requestId?: string
  previousEventHash: string
  eventHash: string
}

export interface AuditEventStorageBackend {
  append(input: AuditEventInput): Promise<AuditEventRecord>
  listRecords(): Promise<AuditEventRecord[]>
}

export const INITIAL_AUDIT_EVENT_HASH = '0'.repeat(64)

const SENSITIVE_PAYLOAD_KEY = /(?:token|secret|password|api[-_]?key|authorization|cookie)/i
const SECRET_STRING_PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+[-A-Za-z0-9._~+/=]+/gi, 'Bearer [redacted]'],
  [/\bsk-[-A-Za-z0-9_]{8,}\b/g, '[redacted-api-key]'],
  [/\b(token|api[_-]?key|authorization|cookie|password)=([^&\s]+)/gi, '$1=[redacted]'],
]

export class InMemoryAuditEventStore implements AuditEventStorageBackend {
  private readonly records: AuditEventRecord[] = []

  async append(input: AuditEventInput): Promise<AuditEventRecord> {
    const previousEventHash = this.records.at(-1)?.eventHash ?? INITIAL_AUDIT_EVENT_HASH
    const record = createAuditEventRecord(input, previousEventHash)
    this.records.push(copyRecord(record))
    return copyRecord(record)
  }

  async listRecords(): Promise<AuditEventRecord[]> {
    return this.records.map(copyRecord)
  }
}

export class FileAuditEventStore implements AuditEventStorageBackend {
  constructor(private readonly filePath = join(getConfigDir(), 'audit', 'events.jsonl')) {}

  async append(input: AuditEventInput): Promise<AuditEventRecord> {
    const previousEventHash = this.readRecords().at(-1)?.eventHash ?? INITIAL_AUDIT_EVENT_HASH
    const record = createAuditEventRecord(input, previousEventHash)
    const dir = dirname(this.filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 })
    }
    appendFileSync(this.filePath, `${JSON.stringify(record)}\n`, { mode: 0o600 })
    return copyRecord(record)
  }

  async listRecords(): Promise<AuditEventRecord[]> {
    return this.readRecords()
  }

  private readRecords(): AuditEventRecord[] {
    if (!existsSync(this.filePath)) return []
    return readFileSync(this.filePath, 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => copyRecord(JSON.parse(line) as AuditEventRecord))
  }
}

export function verifyAuditHashChain(
  records: readonly AuditEventRecord[],
  initialHash = INITIAL_AUDIT_EVENT_HASH,
): boolean {
  let previousEventHash = initialHash

  for (const record of records) {
    if (record.previousEventHash !== previousEventHash) return false
    if (computeAuditEventHash(record) !== record.eventHash) return false
    previousEventHash = record.eventHash
  }

  return true
}

export function serializeAuditPayload(payload: Record<string, unknown> = {}): string {
  return JSON.stringify(sanitizeValue('', payload))
}

function createAuditEventRecord(input: AuditEventInput, previousEventHash: string): AuditEventRecord {
  const record: AuditEventRecord = {
    eventId: randomUUID(),
    ts: toIsoTimestamp(input.ts ?? new Date()),
    actor: copyActor(input.actor),
    eventType: input.eventType,
    severity: input.severity ?? 'info',
    payloadJson: serializeAuditPayload(input.payload),
    previousEventHash,
    eventHash: '',
  }

  if (input.tenantId) record.tenantId = input.tenantId
  if (input.requestId) record.requestId = input.requestId
  record.eventHash = computeAuditEventHash(record)
  return record
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

function toIsoTimestamp(value: Date | string): string {
  return new Date(value).toISOString()
}

function copyRecord(record: AuditEventRecord): AuditEventRecord {
  return {
    eventId: record.eventId,
    ts: record.ts,
    actor: copyActor(record.actor),
    ...(record.tenantId ? { tenantId: record.tenantId } : {}),
    eventType: record.eventType,
    severity: record.severity,
    payloadJson: record.payloadJson,
    ...(record.requestId ? { requestId: record.requestId } : {}),
    previousEventHash: record.previousEventHash,
    eventHash: record.eventHash,
  }
}

function copyActor(actor: AuditEventActor): AuditEventActor {
  return {
    type: actor.type,
    ...(actor.id ? { id: actor.id } : {}),
    ...(actor.teamId ? { teamId: actor.teamId } : {}),
    ...(actor.role ? { role: actor.role } : {}),
  }
}

function sanitizeString(value: string): string {
  return SECRET_STRING_PATTERNS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  )
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_PAYLOAD_KEY.test(key)) return '[redacted]'
  if (typeof value === 'string') return sanitizeString(value)
  if (value == null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(item => sanitizeValue('', item))

  const result: Record<string, unknown> = {}
  for (const [childKey, childValue] of Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) {
    result[childKey] = sanitizeValue(childKey, childValue)
  }
  return result
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
