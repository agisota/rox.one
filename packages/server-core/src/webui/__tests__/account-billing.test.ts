import { describe, expect, it } from 'bun:test'
import {
  createDvnetTopUpIntent,
  createDvnetWebhookSignature,
  DvnetWebhookSignatureError,
  InMemoryDvnetBillingIntentStore,
  processDvnetWebhook,
} from '../account-billing'
import { InMemoryAccountUsageLedger } from '../account-ledger'

function paymentReceivedPayload(overrides: Record<string, unknown> = {}) {
  return {
    amount: '2.395',
    status: 'completed',
    type: 'PaymentReceived',
    transactions: {
      amount_usd: '2.395',
      bc_uniq_key: '0',
      tx_hash: 'tx-hash-1',
    },
    wallet: {
      store_external_id: 'intent-a',
    },
    ...overrides,
  }
}

describe('account billing and DV.net integration', () => {
  it('uses USDT for ledger balances', async () => {
    const ledger = new InMemoryAccountUsageLedger()

    await ledger.recordCredit({
      userId: 'user-a',
      amountUnits: 1_000_000,
      reason: 'dvnet_top_up',
      idempotencyKey: 'tx-1:0',
    })

    expect((await ledger.getBalance('user-a')).currency).toBe('USDT')
  })

  it('creates a DV.net payment form intent with a unique client id and no secrets', () => {
    const intent = createDvnetTopUpIntent({
      userId: 'user-a',
      storeUuid: '0cbffe2b-d2a5-433d-94f5-77ce93a7c0eb',
      paymentBaseUrl: 'https://checkout.dv.net',
      clientId: 'intent-a',
    })

    expect(intent).toEqual({
      status: 'ready',
      provider: 'dv.net',
      redirectUrl: 'https://checkout.dv.net/pay/store/0cbffe2b-d2a5-433d-94f5-77ce93a7c0eb/intent-a',
      clientId: 'intent-a',
      billing: null,
    })
    expect(JSON.stringify(intent)).not.toContain('secret')
  })

  it('credits only confirmed DV.net PaymentReceived webhooks once by tx_hash and bc_uniq_key', async () => {
    const ledger = new InMemoryAccountUsageLedger()
    const intents = new InMemoryDvnetBillingIntentStore()
    await intents.createIntent({ id: 'intent-a', userId: 'user-a' })
    const rawBody = JSON.stringify(paymentReceivedPayload())
    const signature = createDvnetWebhookSignature(rawBody, 'webhook-secret')

    const first = await processDvnetWebhook({
      rawBody,
      signature,
      webhookSecret: 'webhook-secret',
      ledger,
      intents,
    })
    const duplicate = await processDvnetWebhook({
      rawBody,
      signature,
      webhookSecret: 'webhook-secret',
      ledger,
      intents,
    })

    expect(first).toMatchObject({ success: true, credited: true, idempotencyKey: 'tx-hash-1:0' })
    expect(duplicate).toMatchObject({ success: true, credited: false, duplicate: true, idempotencyKey: 'tx-hash-1:0' })
    const balance = await ledger.getBalance('user-a')
    expect(balance.balanceUnits).toBe(2_395_000)
    expect(balance.entries).toHaveLength(1)
  })

  it('rejects invalid signatures and ignores unconfirmed DV.net events', async () => {
    const ledger = new InMemoryAccountUsageLedger()
    const intents = new InMemoryDvnetBillingIntentStore()
    await intents.createIntent({ id: 'intent-a', userId: 'user-a' })
    const unconfirmedBody = JSON.stringify(paymentReceivedPayload({ type: 'PaymentNotConfirmed' }))

    await expect(processDvnetWebhook({
      rawBody: unconfirmedBody,
      signature: 'invalid',
      webhookSecret: 'webhook-secret',
      ledger,
      intents,
    })).rejects.toBeInstanceOf(DvnetWebhookSignatureError)

    const signature = createDvnetWebhookSignature(unconfirmedBody, 'webhook-secret')
    const ignored = await processDvnetWebhook({
      rawBody: unconfirmedBody,
      signature,
      webhookSecret: 'webhook-secret',
      ledger,
      intents,
    })

    expect(ignored).toMatchObject({ success: true, credited: false, duplicate: false })
    expect((await ledger.getBalance('user-a')).balanceUnits).toBe(0)
  })
})
