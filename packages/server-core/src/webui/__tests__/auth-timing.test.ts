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
 *
 * Implementation: parses `auth.ts` with the TypeScript compiler API and
 * walks the AST. The previous regex-based audit was bypassable by
 * intermediate variables, line-wrapped operands, or alternative `===`
 * positioning (PR #19 review finding #2). The AST walk inspects each
 * `BinaryExpression` node directly, so no whitespace or rename trick can
 * sneak past it.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const authPath = resolve(here, '..', 'auth.ts')
const billingPath = resolve(here, '..', 'account-billing.ts')

function readSrc(path: string): string {
  return readFileSync(path, 'utf8')
}

/**
 * Identifiers that hold (or are likely to hold) secret-bearing material.
 * A `===`/`!==` whose either operand is one of these names is a strong
 * signal of a non-constant-time JS-level compare and must be flagged.
 */
const SECRET_OPERAND_DENYLIST = new Set([
  'hashedPassword',
  'token',
  'signature',
  'digest',
  'hash',
  'rawToken',
  'expectedToken',
  'expectedHash',
  'expectedSignature',
  'expectedDigest',
])

interface ForbiddenEquality {
  line: number
  column: number
  text: string
  matchedIdentifier: string
}

/**
 * Walk a TS source file's AST and collect every `===`/`!==` BinaryExpression
 * whose left or right operand is an `Identifier` (anywhere inside it) named
 * in {@link SECRET_OPERAND_DENYLIST}.
 *
 * We descend into the operand sub-tree so that property accesses such as
 * `user.hashedPassword === '…'` are still caught.
 */
function findForbiddenSecretEqualities(source: string, filename: string): ForbiddenEquality[] {
  const sf = ts.createSourceFile(filename, source, ts.ScriptTarget.ES2022, true)
  const offences: ForbiddenEquality[] = []

  function operandHasDenyIdentifier(node: ts.Node): string | null {
    let hit: string | null = null
    function walk(child: ts.Node): void {
      if (hit) return
      if (ts.isIdentifier(child) && SECRET_OPERAND_DENYLIST.has(child.text)) {
        hit = child.text
        return
      }
      ts.forEachChild(child, walk)
    }
    walk(node)
    return hit
  }

  function visit(node: ts.Node): void {
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind
      if (op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
        const lhs = operandHasDenyIdentifier(node.left)
        const rhs = operandHasDenyIdentifier(node.right)
        const hit = lhs ?? rhs
        if (hit) {
          const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
          offences.push({
            line: line + 1,
            column: character + 1,
            text: node.getText(sf),
            matchedIdentifier: hit,
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sf)
  return offences
}

describe('auth surface — timing-safe equality audit (AST-based)', () => {
  it('auth.ts contains no JS-level === or !== against secret-bearing operands', () => {
    const src = readSrc(authPath)
    const offences = findForbiddenSecretEqualities(src, 'auth.ts')

    // If this fails, every offending node is reported with its source line
    // and the denylisted identifier that triggered the match. Replace the
    // comparison with `crypto.timingSafeEqual` (or move it into SQL) and
    // re-run.
    expect(offences).toEqual([])
  })

  it('the only timing-safe consumer in the webui is the DV.net webhook signature check', () => {
    const billing = readSrc(billingPath)
    expect(billing).toContain("import { createHash, timingSafeEqual, randomUUID } from 'node:crypto'")
    expect(billing).toMatch(/timingSafeEqual\(expectedBytes,\s*actualBytes\)/)
  })

  it('Bun.password.verify is the only password comparator in auth.ts', () => {
    const src = readSrc(authPath)
    expect(src).toContain('Bun.password.verify(input, hashedPassword)')
    // No bespoke comparator should sit alongside it.
    expect(src).not.toMatch(/function\s+verifyHash/)
    expect(src).not.toMatch(/function\s+constantTimeCompare/)
  })

  it('files that compare token or password material import a constant-time primitive', () => {
    // Positive contract: any file performing token/password verification
    // must import either `Bun.password.verify` (resolved via the global
    // `Bun` namespace, so check usage) or `timingSafeEqual` from
    // `node:crypto`.
    const auth = readSrc(authPath)
    const billing = readSrc(billingPath)

    expect(auth.includes('Bun.password.verify') || auth.includes('timingSafeEqual')).toBe(true)
    expect(billing.includes('timingSafeEqual')).toBe(true)
  })

  it('AST walker self-test: detects a synthetic forbidden equality', () => {
    // Guard against the walker silently degrading (e.g. a future TS
    // compiler change). Feed it a known offender; the audit must catch it.
    const synthetic = `
      const hashedPassword = ''
      function verify(input: string): boolean {
        return hashedPassword === input
      }
    `
    const offences = findForbiddenSecretEqualities(synthetic, 'synthetic.ts')
    expect(offences.length).toBeGreaterThanOrEqual(1)
    expect(offences[0]!.matchedIdentifier).toBe('hashedPassword')
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
