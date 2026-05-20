/**
 * T537 PR #5b: CSP audit tests.
 *
 * TDD cycles 1-4: parse CSP from HTML assets, reject unsafe-* directives.
 */
import { describe, expect, it } from 'bun:test'
import { parseMetaCsp, auditCspValue, auditHtmlAsset } from '../validate-csp'

describe('parseMetaCsp', () => {
  it('extracts Content-Security-Policy from <meta http-equiv> tags', () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'">
</head>
<body></body>
</html>`
    const policies = parseMetaCsp(html)
    expect(policies).toHaveLength(1)
    expect(policies[0]).toBe("default-src 'self'")
  })

  it('returns empty array when no CSP meta tag present', () => {
    const html = '<html><head><title>No CSP</title></head><body></body></html>'
    expect(parseMetaCsp(html)).toHaveLength(0)
  })

  it('extracts multiple CSP meta tags', () => {
    const html = `<html><head>
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'">
      <meta http-equiv="Content-Security-Policy" content="script-src 'nonce-abc123'">
    </head></html>`
    const policies = parseMetaCsp(html)
    expect(policies).toHaveLength(2)
  })
})

describe('auditCspValue – fails on unsafe-*', () => {
  it('fails when CSP contains unsafe-inline', () => {
    const result = auditCspValue("default-src 'self'; script-src 'unsafe-inline'")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.violations).toContain("unsafe-inline")
    }
  })

  it('fails when CSP contains unsafe-eval', () => {
    const result = auditCspValue("default-src 'self'; script-src 'unsafe-eval'")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.violations).toContain("unsafe-eval")
    }
  })

  it('fails when CSP contains unsafe-hashes', () => {
    const result = auditCspValue("default-src 'self'; style-src 'unsafe-hashes'")
    expect(result.ok).toBe(false)
  })

  it('passes when CSP uses only nonces and safe origins', () => {
    const result = auditCspValue("default-src 'self'; script-src 'nonce-abc123'; style-src 'nonce-def456'")
    expect(result.ok).toBe(true)
  })

  it('passes when CSP uses sha256 hashes', () => {
    const result = auditCspValue("default-src 'self'; script-src 'sha256-abc123=='")
    expect(result.ok).toBe(true)
  })

  it('passes for strict-dynamic with nonce', () => {
    const result = auditCspValue("script-src 'nonce-xyz' 'strict-dynamic'")
    expect(result.ok).toBe(true)
  })
})

describe('auditHtmlAsset', () => {
  it('fails on HTML asset containing unsafe-inline in CSP meta tag', () => {
    const html = `<html><head>
      <meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-inline'">
    </head><body></body></html>`
    const result = auditHtmlAsset('index.html', html)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.file).toBe('index.html')
      expect(result.violations.length).toBeGreaterThan(0)
    }
  })

  it('passes on HTML asset with CSP using only nonces', () => {
    const html = `<html><head>
      <meta http-equiv="Content-Security-Policy" content="script-src 'nonce-abc' 'strict-dynamic'; default-src 'self'">
    </head><body></body></html>`
    const result = auditHtmlAsset('index.html', html)
    expect(result.ok).toBe(true)
  })

  it('passes when HTML has no CSP meta tag (no CSP to audit)', () => {
    const html = '<html><head><title>No CSP</title></head><body></body></html>'
    const result = auditHtmlAsset('no-csp.html', html)
    expect(result.ok).toBe(true)
  })

  it('fails on unsafe-eval in CSP meta', () => {
    const html = `<html><head>
      <meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-eval'">
    </head></html>`
    const result = auditHtmlAsset('eval.html', html)
    expect(result.ok).toBe(false)
  })
})
