import { describe, expect, it } from 'bun:test'
import type { SessionIdentity } from '../../accounts'
import {
  createAccountCabinetBilling,
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
        currency: 'ROX',
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
})
