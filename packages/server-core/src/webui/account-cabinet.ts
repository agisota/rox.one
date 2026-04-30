import type { SessionIdentity } from '../accounts'
import type { AccountLedgerBalance } from './account-ledger'

export interface AccountCabinetBalance {
  userId: string
  balanceUnits: number
  currency: 'ROX'
  updatedAt: string | null
}

export interface AccountCabinetBilling {
  balance: AccountCabinetBalance
  topUp: {
    enabled: boolean
    provider: 'manual'
    url: string | null
  }
  ledger?: {
    entries: AccountLedgerBalance['entries']
  }
}

export interface AccountCabinetEvent {
  id: string
  type: string
  title: string
  details: Record<string, unknown>
  createdAt: string
}

export interface AccountCabinetOrganization {
  id: string
  name: string
  slug: string
  role: string
  status: string
  createdAt: string
  updatedAt?: string
}

export function createAccountCabinetBilling(identity: SessionIdentity): AccountCabinetBilling {
  return {
    balance: {
      userId: identity.userId,
      balanceUnits: 0,
      currency: 'ROX',
      updatedAt: null,
    },
    topUp: {
      enabled: false,
      provider: 'manual',
      url: null,
    },
  }
}

export function createAccountCabinetBillingFromLedger(balance: AccountLedgerBalance): AccountCabinetBilling {
  return {
    balance: {
      userId: balance.userId,
      balanceUnits: balance.balanceUnits,
      currency: balance.currency,
      updatedAt: balance.updatedAt,
    },
    topUp: {
      enabled: false,
      provider: 'manual',
      url: null,
    },
    ledger: {
      entries: balance.entries,
    },
  }
}

export function createAccountCabinetEvents(): { events: AccountCabinetEvent[] } {
  return { events: [] }
}

export function createAccountCabinetOrganizations(): { organizations: AccountCabinetOrganization[] } {
  return { organizations: [] }
}

export function createDisabledTopUpIntent(identity: SessionIdentity) {
  return {
    status: 'disabled' as const,
    redirectUrl: null,
    message: 'Billing top-up is not configured for this workspace.',
    billing: createAccountCabinetBilling(identity),
  }
}
