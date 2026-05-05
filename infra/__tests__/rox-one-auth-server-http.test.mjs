import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const testDir = dirname(fileURLToPath(import.meta.url))
let DatabaseSync
let sqliteUnavailableReason = ''
try {
  ;({ DatabaseSync } = await import('node:sqlite'))
} catch (error) {
  sqliteUnavailableReason = `node:sqlite unavailable in this runtime: ${error instanceof Error ? error.message : String(error)}`
}

async function loadHarness() {
  const root = mkdtempSync(join(tmpdir(), 'rox-auth-http-'))
  const dbPath = join(root, 'auth.sqlite')
  mkdirSync(dirname(dbPath), { recursive: true })

  Object.assign(process.env, {
    ROX_AUTH_NO_LISTEN: '1',
    ROX_AUTH_JWT_SECRET: 'test-jwt-secret-with-enough-entropy',
    ROX_AUTH_DB: dbPath,
    ROX_AUTH_ALLOW_EMAIL_LOG_FALLBACK: '1',
    ROX_DVNET_PAYMENT_BASE_URL: 'https://checkout.dv.net',
    ROX_DVNET_STORE_UUID: '0cbffe2b-d2a5-433d-94f5-77ce93a7c0eb',
    ROX_DVNET_WEBHOOK_SECRET: 'webhook-secret',
  })

  const moduleUrl = `${pathToFileURL(join(testDir, '..', 'rox-one-auth-server.mjs')).href}?test=${Date.now()}-${Math.random()}`
  const mod = await import(moduleUrl)
  return { handle: mod.handle, dbPath }
}

async function request(handle, method, url, body, headers = {}) {
  const rawBody = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)
  const req = Readable.from(rawBody ? [Buffer.from(rawBody)] : [])
  req.method = method
  req.url = url
  req.headers = {
    ...(rawBody ? { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(rawBody)) } : {}),
    ...Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])),
  }
  req.socket = { remoteAddress: '127.0.0.1' }

  return await new Promise((resolve, reject) => {
    const chunks = []
    let status = 200
    let responseHeaders = {}
    const res = {
      writeHead(nextStatus, nextHeaders = {}) {
        status = nextStatus
        responseHeaders = Object.fromEntries(Object.entries(nextHeaders).map(([key, value]) => [key.toLowerCase(), String(value)]))
      },
      end(chunk) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        resolve({ status, headers: responseHeaders, body: Buffer.concat(chunks).toString('utf8') })
      },
    }
    handle(req, res).catch(reject)
  })
}

function dvnetSignature(rawBody) {
  return createHash('sha256').update(`${rawBody}webhook-secret`).digest('hex')
}

if (sqliteUnavailableReason) {
  test.skip(
    'hosted auth handler creates a DV.net top-up intent and credits a confirmed webhook once',
    () => {},
  )
} else {
  test('hosted auth handler creates a DV.net top-up intent and credits a confirmed webhook once', async () => {
    const { handle, dbPath } = await loadHarness()

    const register = await request(handle, 'POST', '/api/auth/register', {
      email: 'billing@example.com',
      password: 'password123',
      displayName: 'Billing User',
    })
    assert.equal(register.status, 201)

    const db = new DatabaseSync(dbPath)
    const userRow = db.prepare("SELECT id FROM rox_users WHERE email = 'billing@example.com'").get()
    assert.ok(userRow.id)
    db.prepare("UPDATE rox_users SET status = 'active', verified_at = '2026-04-30T00:00:00.000Z' WHERE id = ?").run(userRow.id)

    const login = await request(handle, 'POST', '/api/auth/login', {
      email: 'billing@example.com',
      password: 'password123',
    })
    assert.equal(login.status, 200)
    const cookie = login.headers['set-cookie']
    assert.match(cookie, /__Host-rox_session=/)

    const topUp = await request(handle, 'POST', '/api/account/billing/top-up-intent', undefined, { cookie })
    assert.equal(topUp.status, 200)
    const topUpBody = JSON.parse(topUp.body)
    assert.equal(topUpBody.status, 'ready')
    assert.equal(topUpBody.provider, 'dv.net')
    assert.equal(topUpBody.redirectUrl, `https://checkout.dv.net/pay/store/0cbffe2b-d2a5-433d-94f5-77ce93a7c0eb/${topUpBody.clientId}`)
    assert.equal(topUp.body.includes('webhook-secret'), false)
    assert.equal(topUpBody.billing.balance.currency, 'USDT')

    const rawBody = JSON.stringify({
      amount: '12.50',
      status: 'completed',
      type: 'PaymentReceived',
      transactions: {
        amount_usd: '12.50',
        bc_uniq_key: '0',
        tx_hash: 'tx-hash-hosted-1',
      },
      wallet: { store_external_id: topUpBody.clientId },
    })
    const signature = dvnetSignature(rawBody)

    const webhook = await request(handle, 'POST', '/api/webhooks/dvnet', rawBody, { 'x-sign': signature })
    assert.equal(webhook.status, 200)
    assert.deepEqual(JSON.parse(webhook.body), { success: true })

    const duplicate = await request(handle, 'POST', '/api/webhooks/dvnet', rawBody, { 'x-sign': signature })
    assert.equal(duplicate.status, 200)

    const billing = await request(handle, 'GET', '/api/account/billing', undefined, { cookie })
    assert.equal(billing.status, 200)
    assert.equal(JSON.parse(billing.body).balance.balanceUnits, 12_500_000)
  })
}
