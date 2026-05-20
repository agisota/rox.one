#!/usr/bin/env bun
/**
 * T537 PR #5b: CSP audit script.
 *
 * Parses all CSP headers/meta from packaged HTML assets and fails on
 * any `unsafe-inline`, `unsafe-eval`, or `unsafe-hashes` directive.
 *
 * Usage: bun run scripts/validate-csp.ts [--dir=<dist-dir>]
 *
 * Exit 0 on success, exit 1 on any violation.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** CSP source keywords that are explicitly forbidden. */
const UNSAFE_KEYWORDS = ['unsafe-inline', 'unsafe-eval', 'unsafe-hashes'] as const

export interface CspAuditPass {
  ok: true
}

export interface CspAuditFail {
  ok: false
  violations: string[]
}

export type CspAuditResult = CspAuditPass | CspAuditFail

export interface HtmlAuditPass {
  ok: true
}

export interface HtmlAuditFail {
  ok: false
  file: string
  violations: string[]
}

export type HtmlAuditResult = HtmlAuditPass | HtmlAuditFail

/**
 * Extract Content-Security-Policy values from meta http-equiv tags in raw HTML.
 * Returns an array of policy strings (one per tag found).
 */
export function parseMetaCsp(html: string): string[] {
  const results: string[] = []
  const metaTagRe = /<meta\b[^>]+>/gi
  let match: RegExpExecArray | null
  while ((match = metaTagRe.exec(html)) !== null) {
    const tag = match[0]
    if (!/http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(tag)) continue
    // Match content="..." (double-quoted) or content='...' (single-quoted).
    // CSP values contain single-quoted keywords like 'self', so we must match
    // by the *outer* quote character rather than rejecting any quote inside.
    const dqMatch = /\bcontent\s*=\s*"([^"]*)"/i.exec(tag)
    const sqMatch = /\bcontent\s*=\s*'([^']*)'/i.exec(tag)
    const contentValue = (dqMatch ?? sqMatch)?.[1]
    if (contentValue !== undefined) {
      results.push(contentValue)
    }
  }
  return results
}

/**
 * Audit a single CSP policy string. Returns ok:true if no unsafe-* keywords
 * are present, ok:false with violation list otherwise.
 */
export function auditCspValue(cspValue: string): CspAuditResult {
  const violations: string[] = []
  const lower = cspValue.toLowerCase()
  for (const keyword of UNSAFE_KEYWORDS) {
    if (lower.includes("'" + keyword + "'")) {
      violations.push(keyword)
    }
  }
  if (violations.length > 0) {
    return { ok: false, violations }
  }
  return { ok: true }
}

/**
 * Audit all CSP meta tags in a single HTML asset.
 */
export function auditHtmlAsset(file: string, html: string): HtmlAuditResult {
  const policies = parseMetaCsp(html)
  const allViolations: string[] = []
  for (const policy of policies) {
    const result = auditCspValue(policy)
    if (!result.ok) {
      allViolations.push(...result.violations)
    }
  }
  if (allViolations.length > 0) {
    return { ok: false, file, violations: allViolations }
  }
  return { ok: true }
}

// CLI entry point
if (import.meta.main) {
  const args = process.argv.slice(2)
  const dirArg = args.find((a) => a.startsWith('--dir='))
  const distDir = dirArg ? dirArg.slice('--dir='.length) : join(process.cwd(), 'apps/electron/dist')

  if (!existsSync(distDir)) {
    console.error('[validate-csp] ERROR: dist dir not found: ' + distDir)
    process.exit(1)
  }

  function collectHtmlFiles(dir: string): string[] {
    const files: string[] = []
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const full = join(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) {
        files.push(...collectHtmlFiles(full))
      } else if (entry.endsWith('.html')) {
        files.push(full)
      }
    }
    return files
  }

  const htmlFiles = collectHtmlFiles(distDir)

  if (htmlFiles.length === 0) {
    console.log('[validate-csp] WARN: no HTML files found in ' + distDir + ' — nothing to audit')
    process.exit(0)
  }

  let anyFail = false
  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf-8')
    const result = auditHtmlAsset(file, html)
    if (!result.ok) {
      console.error('[validate-csp] FAIL ' + file + ': unsafe CSP keywords: ' + result.violations.join(', '))
      anyFail = true
    } else {
      console.log('[validate-csp] OK   ' + file)
    }
  }

  if (anyFail) {
    console.error('[validate-csp] FAIL: one or more assets contain unsafe CSP directives')
    process.exit(1)
  }

  console.log('[validate-csp] PASS: all ' + htmlFiles.length + ' HTML asset(s) clean')
}
