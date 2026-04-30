import { describe, expect, it } from 'bun:test'
import {
  AccountLedgerInsufficientBalanceError,
  InMemoryAccountUsageLedger,
} from '../account-ledger'

describe('account usage balance ledger', () => {
  it('records credits and debits in order with a running balance', async () => {
    const ledger = new InMemoryAccountUsageLedger()

    await ledger.recordCredit({
      userId: 'user-a',
      amountUnits: 1000,
      reason: 'manual_top_up',
      idempotencyKey: 'credit-1',
    })
    await ledger.recordDebit({
      userId: 'user-a',
      amountUnits: 125,
      reason: 'agent_usage',
      idempotencyKey: 'debit-1',
      metadata: { sessionId: 'session-1', totalTokens: 2500 },
    })

    const snapshot = await ledger.getBalance('user-a')
    expect(snapshot.balanceUnits).toBe(875)
    expect(snapshot.currency).toBe('ROX')
    expect(snapshot.entries.map(entry => entry.balanceAfterUnits)).toEqual([1000, 875])
    expect(snapshot.entries[1]).toMatchObject({
      type: 'debit',
      reason: 'agent_usage',
      metadata: { sessionId: 'session-1', totalTokens: 2500 },
    })
  })

  it('is idempotent per user and idempotency key', async () => {
    const ledger = new InMemoryAccountUsageLedger()

    const first = await ledger.recordCredit({
      userId: 'user-a',
      amountUnits: 500,
      reason: 'manual_top_up',
      idempotencyKey: 'same-key',
    })
    const second = await ledger.recordCredit({
      userId: 'user-a',
      amountUnits: 500,
      reason: 'manual_top_up',
      idempotencyKey: 'same-key',
    })
    await ledger.recordCredit({
      userId: 'user-b',
      amountUnits: 700,
      reason: 'manual_top_up',
      idempotencyKey: 'same-key',
    })

    expect(second).toEqual(first)
    expect((await ledger.getBalance('user-a')).balanceUnits).toBe(500)
    expect((await ledger.getBalance('user-a')).entries).toHaveLength(1)
    expect((await ledger.getBalance('user-b')).balanceUnits).toBe(700)
  })

  it('rejects negative or zero amounts and prevents overdrafts', async () => {
    const ledger = new InMemoryAccountUsageLedger()

    await expect(ledger.recordCredit({
      userId: 'user-a',
      amountUnits: 0,
      reason: 'manual_top_up',
      idempotencyKey: 'zero',
    })).rejects.toThrow('Ledger amount must be positive')

    await expect(ledger.recordDebit({
      userId: 'user-a',
      amountUnits: 1,
      reason: 'agent_usage',
      idempotencyKey: 'debit-1',
    })).rejects.toBeInstanceOf(AccountLedgerInsufficientBalanceError)
  })

  it('returns defensive copies so callers cannot mutate ledger history', async () => {
    const ledger = new InMemoryAccountUsageLedger()
    await ledger.recordCredit({
      userId: 'user-a',
      amountUnits: 100,
      reason: 'manual_top_up',
      idempotencyKey: 'credit-1',
    })

    const snapshot = await ledger.getBalance('user-a')
    snapshot.entries[0]!.amountUnits = 9999

    expect((await ledger.getBalance('user-a')).entries[0]!.amountUnits).toBe(100)
  })
})
