import { randomUUID } from 'node:crypto'
import type { AccountCabinetEvent } from './account-cabinet'

export type AccountAuditSeverity = 'info' | 'warning' | 'error' | 'security'

export interface AccountAuditActor {
  type: 'user' | 'system'
  userId?: string
  teamId?: string
  role?: string
}

export interface AccountAuditTarget {
  type: string
  id: string
  teamId?: string
  workspaceId?: string
}

export interface AccountEventRecord {
  id: string
  userId: string
  type: string
  action: string
  actor: AccountAuditActor
  target: AccountAuditTarget
  teamId?: string
  severity?: AccountAuditSeverity
  source?: string
  title: string
  details: Record<string, unknown>
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface AccountEventInput {
  userId: string
  type: string
  action?: string
  actor?: AccountAuditActor
  target?: AccountAuditTarget
  teamId?: string
  severity?: AccountAuditSeverity
  source?: string
  title: string
  details?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface AccountEventHistory {
  append(input: AccountEventInput): Promise<AccountEventRecord>
  listForUser(userId: string, options?: { limit?: number }): Promise<AccountEventRecord[]>
  listForTeam(teamId: string, options?: { limit?: number }): Promise<AccountEventRecord[]>
}

const SENSITIVE_DETAIL_KEY = /(?:token|secret|password|api[-_]?key|authorization|cookie)/i
const SECRET_STRING_PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+[-A-Za-z0-9._~+/=]+/gi, 'Bearer [redacted]'],
  [/\bsk-[-A-Za-z0-9_]{8,}\b/g, '[redacted-api-key]'],
  [/\b(token|api[_-]?key|authorization|cookie|password)=([^&\s]+)/gi, '$1=[redacted]'],
]

function sanitizeString(value: string): string {
  return SECRET_STRING_PATTERNS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  )
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_DETAIL_KEY.test(key)) return '[redacted]'
  if (typeof value === 'string') return sanitizeString(value)
  if (value == null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(item => sanitizeValue('', item))

  const result: Record<string, unknown> = {}
  for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
    result[childKey] = sanitizeValue(childKey, childValue)
  }
  return result
}

function sanitizeDetails(details: Record<string, unknown> | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(details ?? {})) {
    result[key] = sanitizeValue(key, value)
  }
  return result
}

function copyActor(actor: AccountAuditActor): AccountAuditActor {
  return { ...actor }
}

function copyTarget(target: AccountAuditTarget): AccountAuditTarget {
  return { ...target }
}

function copyEvent(event: AccountEventRecord): AccountEventRecord {
  return {
    ...event,
    actor: copyActor(event.actor),
    target: copyTarget(event.target),
    details: sanitizeDetails(event.details),
    ...(event.metadata ? { metadata: sanitizeDetails(event.metadata) } : {}),
  }
}

function getListLimit(options: { limit?: number }): number {
  return Number.isSafeInteger(options.limit) && options.limit! > 0 ? options.limit! : 50
}

function eventBelongsToTeam(event: AccountEventRecord, teamId: string): boolean {
  return event.teamId === teamId || event.actor.teamId === teamId || event.target.teamId === teamId
}

export class InMemoryAccountEventHistory implements AccountEventHistory {
  private readonly entries: AccountEventRecord[] = []

  async append(input: AccountEventInput): Promise<AccountEventRecord> {
    const event: AccountEventRecord = {
      id: randomUUID(),
      userId: input.userId,
      type: input.type,
      action: input.action ?? input.type,
      actor: input.actor ? copyActor(input.actor) : { type: 'user', userId: input.userId },
      target: input.target ? copyTarget(input.target) : { type: 'account', id: input.userId },
      ...(input.teamId ? { teamId: input.teamId } : {}),
      ...(input.severity ? { severity: input.severity } : {}),
      ...(input.source ? { source: input.source } : {}),
      title: input.title,
      details: sanitizeDetails(input.details),
      ...(input.metadata ? { metadata: sanitizeDetails(input.metadata) } : {}),
      createdAt: new Date().toISOString(),
    }

    this.entries.push(event)
    return copyEvent(event)
  }

  async listForUser(userId: string, options: { limit?: number } = {}): Promise<AccountEventRecord[]> {
    const limit = getListLimit(options)
    return this.entries
      .filter(event => event.userId === userId)
      .slice(-limit)
      .reverse()
      .map(copyEvent)
  }

  async listForTeam(teamId: string, options: { limit?: number } = {}): Promise<AccountEventRecord[]> {
    const limit = getListLimit(options)
    return this.entries
      .filter(event => eventBelongsToTeam(event, teamId))
      .slice(-limit)
      .reverse()
      .map(copyEvent)
  }
}

export function toAccountCabinetEvents(records: AccountEventRecord[]): { events: AccountCabinetEvent[] } {
  return {
    events: records.map(record => ({
      id: record.id,
      type: record.type,
      action: record.action,
      actor: copyActor(record.actor),
      target: copyTarget(record.target),
      ...(record.teamId ? { teamId: record.teamId } : {}),
      ...(record.severity ? { severity: record.severity } : {}),
      ...(record.source ? { source: record.source } : {}),
      title: record.title,
      details: sanitizeDetails(record.details),
      ...(record.metadata ? { metadata: sanitizeDetails(record.metadata) } : {}),
      createdAt: record.createdAt,
    })),
  }
}
