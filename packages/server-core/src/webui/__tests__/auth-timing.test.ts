/**
 * Timing-safe-equality audit for the web UI auth surface.
 *
 * The account-identity foundation deliberately does **no** byte-equality
 * comparison on tokens, hashes, or signatures inside JavaScript:
 *
 *   - Password verification: `Bun.password.verify` (constant-time argon2id).
 *   - Email / reset token verification: SQL `=` on a sha256 column index.
 *   - Session lookup: SQL `=` on the session id (an opaque random UUID).
 *   - Webhook signature: `crypto.timingSafeEqual` (see account-billing.ts).
 *
 * This test guards that property so a future refactor cannot accidentally
 * introduce a JS-level `===` against a secret value. If a comparison must be
 * added, it MUST go through `crypto.timingSafeEqual`.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const authPath = resolve(here, '..', 'auth.ts')
const billingPath = resolve(here, '..', 'account-billing.ts')

function readSrc(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('auth surface — timing-safe equality audit', () => {
  it('auth.ts performs no JS-level byte/string equality on token or hash material', () => {
    const src = readSrc(authPath)

    // Forbidden patterns — any of these would suggest a non-constant-time
    // compare on secret material. Whitespace is normalised first.
    const compact = src.replace(/\s+/g, ' ')

    // Direct equality against the password hash in memory.
    expect(compact).not.toMatch(/hashedPassword\s*===/)
    expect(compact).not.toMatch(/===\s*hashedPassword/)

    // Direct equality against a JWT or token argument.
    expect(compact).not.toMatch(/token\s*===\s*['"]/)
    expect(compact).not.toMatch(/['"]\s*===\s*token/)

    // Hash comparisons must go through SQL or timingSafeEqual.
    expect(compact).not.toMatch(/\.update\([^)]+\)\.digest\([^)]+\)\s*===/)
  })

  it('the only timing-safe consumer in the webui is the DV.net webhook signature check', () => {
    const billing = readSrc(billingPath)
    expect(billing).toContain("import { createHash, timingSafeEqual, randomUUID } from 'node:crypto'")
    expect(billing).toMatch(/timingSafeEqual\(expectedBytes,\s*actualBytes\)/)
  })

  it('Bun.password verify is the only password comparator in auth.ts', () => {
    const src = readSrc(authPath)
    expect(src).toContain('Bun.password.verify(input, hashedPassword)')
    // No bespoke comparator should sit alongside it.
    expect(src).not.toMatch(/function\s+verifyHash/)
    expect(src).not.toMatch(/function\s+constantTimeCompare/)
  })
})

describe('auth surface — constant-time primitive availability', () => {
  it('crypto.timingSafeEqual is available in the runtime', async () => {
    const { timingSafeEqual } = await import('node:crypto')
    const a = Buffer.from('abc')
    const b = Buffer.from('abc')
    const c = Buffer.from('xyz')
    expect(timingSafeEqual(a, b)).toBe(true)
    expect(timingSafeEqual(a, c)).toBe(false)
  })

  it('Bun.password.verify rejects mismatches and accepts matches', async () => {
    const hash = await Bun.password.hash('correct horse battery staple', { algorithm: 'argon2id' })
    expect(await Bun.password.verify('correct horse battery staple', hash)).toBe(true)
    expect(await Bun.password.verify('wrong password', hash)).toBe(false)
  })
})
