import { describe, expect, it } from 'bun:test'
import type { SessionIdentity } from '../../accounts'
import {
  createAccountCabinetBilling,
  createAccountCabinetBillingFromLedger,
  createAccountCabinetEvents,
  createAccountCabinetOrganizations,
  createDisabledTopUpIntent,
} from '../account-cabinet'

describe('account cabinet defaults', () => {
  const identity: SessionIdentity = {
    userId: 'user-1',
    sessionId: 'session-1',
    email: 'user@example.com',
    displayName: 'User',
    role: 'user',
  }

  it('exposes zero-balance billing without enabling top-up by default', () => {
    expect(createAccountCabinetBilling(identity)).toEqual({
      balance: {
        userId: 'user-1',
        balanceUnits: 0,
        currency: 'USDT',
        updatedAt: null,
      },
      topUp: {
        enabled: false,
        provider: 'manual',
        url: null,
      },
    })
  })

  it('keeps future ledger and team surfaces empty until backed by stores', () => {
    expect(createAccountCabinetEvents()).toEqual({ events: [] })
    expect(createAccountCabinetOrganizations()).toEqual({ organizations: [] })
  })

  it('returns an explicit disabled top-up intent instead of fake payment state', () => {
    expect(createDisabledTopUpIntent(identity)).toEqual({
      status: 'disabled',
      redirectUrl: null,
      message: 'Billing top-up is not configured for this workspace.',
      billing: createAccountCabinetBilling(identity),
    })
  })

  it('redacts secret-like ledger metadata before exposing billing payloads', () => {
    const billing = createAccountCabinetBillingFromLedger({
      userId: 'user-1',
      balanceUnits: 875,
      currency: 'USDT',
      updatedAt: '2026-05-06T00:00:00.000Z',
      entries: [
        {
          id: 'entry-1',
          userId: 'user-1',
          type: 'debit',
          amountUnits: 125,
          currency: 'USDT',
          reason: 'agent_usage',
          idempotencyKey: 'usage-1',
          balanceAfterUnits: 875,
          metadata: {
            sessionId: 'session-1',
            authorization: 'Bearer ledger-secret-value',
            providerResponse: 'OPENAI_API_KEY=sk-ledgerleak123456',
            nested: {
              cookie: 'rox_session=session-cookie-secret',
              note: 'safe metadata note',
            },
          },
          createdAt: '2026-05-06T00:00:00.000Z',
        },
      ],
    })

    const payload = JSON.stringify(billing)

    expect(payload).toContain('session-1')
    expect(payload).toContain('safe metadata note')
    expect(payload).toContain('OPENAI_API_KEY=[redacted]')
    expect(payload).toContain('"authorization":"[redacted]"')
    expect(payload).toContain('"cookie":"[redacted]"')
    expect(payload).not.toContain('ledger-secret-value')
    expect(payload).not.toContain('sk-ledgerleak123456')
    expect(payload).not.toContain('session-cookie-secret')
  })
})
