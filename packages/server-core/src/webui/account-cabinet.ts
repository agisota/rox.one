import type { SessionIdentity } from '../accounts'
import type { AccountLedgerBalance } from './account-ledger'
import type { AccountAuditActor, AccountAuditSeverity, AccountAuditTarget, AccountEventRecord } from './account-events'

export interface AccountCabinetBalance {
  userId: string
  balanceUnits: number
  currency: 'USDT'
  updatedAt: string | null
}

export interface AccountCabinetBilling {
  balance: AccountCabinetBalance
  topUp: {
    enabled: boolean
    provider: 'manual' | 'dv.net'
    url: string | null
  }
  ledger?: {
    entries: AccountLedgerBalance['entries']
  }
}

export interface AccountCabinetEvent {
  id: string
  type: string
  action?: string
  actor?: AccountAuditActor
  target?: AccountAuditTarget
  teamId?: string
  severity?: AccountAuditSeverity
  source?: string
  title: string
  details: Record<string, unknown>
  metadata?: Record<string, unknown>
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
      currency: 'USDT',
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

export function createAccountCabinetEventsFromHistory(records: AccountEventRecord[]): { events: AccountCabinetEvent[] } {
  return {
    events: records.map(record => ({
      id: record.id,
      type: record.type,
      action: record.action,
      actor: { ...record.actor },
      target: { ...record.target },
      ...(record.teamId ? { teamId: record.teamId } : {}),
      ...(record.severity ? { severity: record.severity } : {}),
      ...(record.source ? { source: record.source } : {}),
      title: record.title,
      details: { ...record.details },
      ...(record.metadata ? { metadata: { ...record.metadata } } : {}),
      createdAt: record.createdAt,
    })),
  }
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
