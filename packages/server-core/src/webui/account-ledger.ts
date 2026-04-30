import { randomUUID } from 'node:crypto'

export type AccountLedgerEntryType = 'credit' | 'debit'
export type AccountLedgerCurrency = 'USDT'

export interface AccountLedgerEntry {
  id: string
  userId: string
  type: AccountLedgerEntryType
  amountUnits: number
  currency: AccountLedgerCurrency
  reason: string
  idempotencyKey: string
  balanceAfterUnits: number
  metadata: Record<string, unknown>
  createdAt: string
}

export interface AccountLedgerBalance {
  userId: string
  balanceUnits: number
  currency: AccountLedgerCurrency
  updatedAt: string | null
  entries: AccountLedgerEntry[]
}

export interface AccountLedgerMutationInput {
  userId: string
  amountUnits: number
  reason: string
  idempotencyKey: string
  metadata?: Record<string, unknown>
}

export interface AccountUsageLedger {
  getBalance(userId: string): Promise<AccountLedgerBalance>
  recordCredit(input: AccountLedgerMutationInput): Promise<AccountLedgerEntry>
  recordDebit(input: AccountLedgerMutationInput): Promise<AccountLedgerEntry>
}

export class AccountLedgerInsufficientBalanceError extends Error {
  constructor(message = 'Insufficient account balance') {
    super(message)
    this.name = 'AccountLedgerInsufficientBalanceError'
  }
}

function assertPositiveAmount(amountUnits: number): void {
  if (!Number.isSafeInteger(amountUnits) || amountUnits <= 0) {
    throw new Error('Ledger amount must be positive')
  }
}

function copyEntry(entry: AccountLedgerEntry): AccountLedgerEntry {
  return {
    ...entry,
    metadata: { ...entry.metadata },
  }
}

function copyBalance(userId: string, entries: AccountLedgerEntry[]): AccountLedgerBalance {
  const last = entries.at(-1)
    return {
    userId,
    balanceUnits: last?.balanceAfterUnits ?? 0,
    currency: 'USDT',
    updatedAt: last?.createdAt ?? null,
    entries: entries.map(copyEntry),
  }
}

export class InMemoryAccountUsageLedger implements AccountUsageLedger {
  private readonly entriesByUserId = new Map<string, AccountLedgerEntry[]>()
  private readonly entriesByIdempotencyKey = new Map<string, AccountLedgerEntry>()

  async getBalance(userId: string): Promise<AccountLedgerBalance> {
    return copyBalance(userId, this.entriesByUserId.get(userId) ?? [])
  }

  async recordCredit(input: AccountLedgerMutationInput): Promise<AccountLedgerEntry> {
    return this.recordEntry('credit', input)
  }

  async recordDebit(input: AccountLedgerMutationInput): Promise<AccountLedgerEntry> {
    return this.recordEntry('debit', input)
  }

  private async recordEntry(type: AccountLedgerEntryType, input: AccountLedgerMutationInput): Promise<AccountLedgerEntry> {
    assertPositiveAmount(input.amountUnits)
    const idempotencyScope = `${input.userId}:${input.idempotencyKey}`
    const existing = this.entriesByIdempotencyKey.get(idempotencyScope)
    if (existing) return copyEntry(existing)

    const entries = this.entriesByUserId.get(input.userId) ?? []
    const currentBalance = entries.at(-1)?.balanceAfterUnits ?? 0
    const balanceAfterUnits = type === 'credit'
      ? currentBalance + input.amountUnits
      : currentBalance - input.amountUnits

    if (balanceAfterUnits < 0) {
      throw new AccountLedgerInsufficientBalanceError()
    }

    const entry: AccountLedgerEntry = {
      id: randomUUID(),
      userId: input.userId,
      type,
      amountUnits: input.amountUnits,
      currency: 'USDT',
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      balanceAfterUnits,
      metadata: { ...(input.metadata ?? {}) },
      createdAt: new Date().toISOString(),
    }

    entries.push(entry)
    this.entriesByUserId.set(input.userId, entries)
    this.entriesByIdempotencyKey.set(idempotencyScope, entry)
    return copyEntry(entry)
  }
}
