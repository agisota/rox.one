import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
import type { AccountUsageLedger } from './account-ledger'

const USDT_UNIT_SCALE = 1_000_000

export class DvnetWebhookSignatureError extends Error {
  constructor(message = 'Invalid DV.net webhook signature') {
    super(message)
    this.name = 'DvnetWebhookSignatureError'
  }
}

export interface DvnetTopUpIntentInput {
  userId: string
  storeUuid: string
  paymentBaseUrl: string
  clientId?: string
}

export interface DvnetTopUpIntent {
  status: 'ready'
  provider: 'dv.net'
  redirectUrl: string
  clientId: string
  billing: null
}

export interface ProcessDvnetWebhookInput {
  rawBody: string
  signature: string | null
  webhookSecret: string
  ledger: AccountUsageLedger
}

export interface ProcessDvnetWebhookResult {
  success: true
  credited: boolean
  duplicate: boolean
  idempotencyKey: string | null
}

interface DvnetWebhookPayload {
  amount?: unknown
  status?: unknown
  type?: unknown
  transactions?: {
    amount_usd?: unknown
    bc_uniq_key?: unknown
    tx_hash?: unknown
  }
  wallet?: {
    store_external_id?: unknown
  }
}

export function createDvnetTopUpIntent(input: DvnetTopUpIntentInput): DvnetTopUpIntent {
  const base = input.paymentBaseUrl.replace(/\/+$/, '')
  const storeUuid = encodeURIComponent(input.storeUuid)
  const clientId = input.clientId ?? `${input.userId}-${randomUUID()}`

  return {
    status: 'ready',
    provider: 'dv.net',
    redirectUrl: `${base}/pay/store/${storeUuid}/${encodeURIComponent(clientId)}`,
    clientId,
    billing: null,
  }
}

export function createDvnetWebhookSignature(rawBody: string, webhookSecret: string): string {
  return createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
}

export async function processDvnetWebhook(input: ProcessDvnetWebhookInput): Promise<ProcessDvnetWebhookResult> {
  if (!isValidDvnetWebhookSignature(input.rawBody, input.webhookSecret, input.signature)) {
    throw new DvnetWebhookSignatureError()
  }

  const payload = JSON.parse(input.rawBody) as DvnetWebhookPayload
  if (payload.type !== 'PaymentReceived' || payload.status !== 'completed') {
    return { success: true, credited: false, duplicate: false, idempotencyKey: null }
  }

  const txHash = requireString(payload.transactions?.tx_hash, 'transactions.tx_hash')
  const bcUniqKey = requireString(payload.transactions?.bc_uniq_key, 'transactions.bc_uniq_key')
  const userId = requireString(payload.wallet?.store_external_id, 'wallet.store_external_id')
  const amountUnits = parseUsdtAmountUnits(payload.transactions?.amount_usd ?? payload.amount)
  const idempotencyKey = `${txHash}:${bcUniqKey}`
  const before = await input.ledger.getBalance(userId)
  await input.ledger.recordCredit({
    userId,
    amountUnits,
    reason: 'dvnet_top_up',
    idempotencyKey,
    metadata: { provider: 'dv.net', txHash, bcUniqKey },
  })
  const after = await input.ledger.getBalance(userId)

  return {
    success: true,
    credited: after.entries.length > before.entries.length,
    duplicate: after.entries.length === before.entries.length,
    idempotencyKey,
  }
}

function isValidDvnetWebhookSignature(rawBody: string, webhookSecret: string, signature: string | null): boolean {
  if (!signature) return false
  const expected = createDvnetWebhookSignature(rawBody, webhookSecret)
  const expectedBytes = Buffer.from(expected, 'utf8')
  const actualBytes = Buffer.from(signature, 'utf8')
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes)
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid DV.net webhook field: ${field}`)
  }
  return value.trim()
}

function parseUsdtAmountUnits(value: unknown): number {
  const amount = requireString(value, 'amount')
  if (!/^\d+(?:\.\d{1,6})?$/.test(amount)) {
    throw new Error('Invalid DV.net webhook amount')
  }
  const [whole, fraction = ''] = amount.split('.')
  const units = Number(whole) * USDT_UNIT_SCALE + Number(fraction.padEnd(6, '0'))
  if (!Number.isSafeInteger(units) || units <= 0) {
    throw new Error('Invalid DV.net webhook amount')
  }
  return units
}
