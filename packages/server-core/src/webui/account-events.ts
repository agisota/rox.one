import { randomUUID } from 'node:crypto'
import type { AccountCabinetEvent } from './account-cabinet'

export interface AccountEventRecord {
  id: string
  userId: string
  type: string
  title: string
  details: Record<string, unknown>
  createdAt: string
}

export interface AccountEventInput {
  userId: string
  type: string
  title: string
  details?: Record<string, unknown>
}

export interface AccountEventHistory {
  append(input: AccountEventInput): Promise<AccountEventRecord>
  listForUser(userId: string, options?: { limit?: number }): Promise<AccountEventRecord[]>
}

const SENSITIVE_DETAIL_KEY = /(?:token|secret|password|api[-_]?key|authorization|cookie)/i

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_DETAIL_KEY.test(key)) return '[redacted]'
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

function copyEvent(event: AccountEventRecord): AccountEventRecord {
  return {
    ...event,
    details: sanitizeDetails(event.details),
  }
}

export class InMemoryAccountEventHistory implements AccountEventHistory {
  private readonly entries: AccountEventRecord[] = []

  async append(input: AccountEventInput): Promise<AccountEventRecord> {
    const event: AccountEventRecord = {
      id: randomUUID(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      details: sanitizeDetails(input.details),
      createdAt: new Date().toISOString(),
    }

    this.entries.push(event)
    return copyEvent(event)
  }

  async listForUser(userId: string, options: { limit?: number } = {}): Promise<AccountEventRecord[]> {
    const limit = Number.isSafeInteger(options.limit) && options.limit! > 0 ? options.limit! : 50
    return this.entries
      .filter(event => event.userId === userId)
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
      title: record.title,
      details: sanitizeDetails(record.details),
      createdAt: record.createdAt,
    })),
  }
}
