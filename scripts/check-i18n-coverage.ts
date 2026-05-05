#!/usr/bin/env bun
/**
 * check-i18n-coverage.ts — CI-safe callsite coverage check.
 *
 * Verifies literal translation keys used by runtime source files exist in
 * `en.json`. Locale parity then proves every other locale has the same key set.
 * Dynamic keys are intentionally skipped because they depend on runtime data.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir ?? new URL('.', import.meta.url).pathname, '..')
const EN_LOCALE_PATH = join(ROOT, 'packages', 'shared', 'src', 'i18n', 'locales', 'en.json')

const SOURCE_ROOTS = [
  'apps/electron/src',
  'apps/viewer/src',
  'apps/webui/src',
  'packages/server-core/src',
  'packages/shared/src',
  'packages/ui/src',
]

const IGNORED_PATH_PARTS = new Set([
  '__tests__',
  '__fixtures__',
  'locales',
  'node_modules',
  'release',
])

const RUNTIME_EXTENSIONS = new Set(['.ts', '.tsx'])

type Finding = {
  file: string
  line: number
  key: string
}

const en = JSON.parse(readFileSync(EN_LOCALE_PATH, 'utf-8')) as Record<string, string>
const enKeys = new Set(Object.keys(en))
const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other']

function hasRuntimeExtension(path: string): boolean {
  for (const extension of RUNTIME_EXTENSIONS) {
    if (path.endsWith(extension)) return true
  }
  return false
}

function shouldSkip(path: string): boolean {
  const parts = path.split('/')
  if (parts.some((part) => IGNORED_PATH_PARTS.has(part))) return true
  if (path.endsWith('.test.ts') || path.endsWith('.test.tsx')) return true
  if (path.endsWith('.spec.ts') || path.endsWith('.spec.tsx')) return true
  if (path.endsWith('.d.ts')) return true
  return false
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const rel = relative(ROOT, path)
    if (shouldSkip(rel)) continue

    const stat = statSync(path)
    if (stat.isDirectory()) {
      yield* walk(path)
    } else if (stat.isFile() && hasRuntimeExtension(path)) {
      yield path
    }
  }
}

function countLine(content: string, index: number): number {
  let line = 1
  for (let i = 0; i < index; i++) {
    if (content.charCodeAt(i) === 10) line += 1
  }
  return line
}

function collectKeys(content: string): Array<{ key: string; index: number }> {
  const hits: Array<{ key: string; index: number }> = []
  const callsitePattern = /\b(?:t|i18n\.t)\(\s*(['"`])([^'"`$]+)\1/g
  const transStringPattern = /<Trans\b[^>]*\bi18nKey=(['"])([^'"`$]+)\1/g
  const transExpressionPattern = /<Trans\b[^>]*\bi18nKey=\{\s*(['"`])([^'"`$]+)\1\s*\}/g

  for (const pattern of [callsitePattern, transStringPattern, transExpressionPattern]) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      hits.push({ key: match[2]!, index: match.index })
    }
  }
  return hits
}

function isKeyCovered(key: string): boolean {
  if (enKeys.has(key)) return true
  return PLURAL_SUFFIXES.some((suffix) => enKeys.has(`${key}_${suffix}`))
}

const findings: Finding[] = []
let scannedFiles = 0
let literalReferences = 0

for (const root of SOURCE_ROOTS) {
  const absRoot = join(ROOT, root)
  if (!existsSync(absRoot)) continue
  for (const file of walk(absRoot)) {
    scannedFiles += 1
    const content = readFileSync(file, 'utf-8')
    for (const { key, index } of collectKeys(content)) {
      literalReferences += 1
      if (isKeyCovered(key)) continue
      findings.push({
        file: relative(ROOT, file),
        line: countLine(content, index),
        key,
      })
    }
  }
}

if (findings.length) {
  console.error(`i18n coverage check failed: ${findings.length} missing literal key reference(s)`)
  for (const finding of findings.slice(0, 50)) {
    console.error(`  ${finding.file}:${finding.line} -> ${finding.key}`)
  }
  if (findings.length > 50) {
    console.error(`  ...and ${findings.length - 50} more`)
  }
  process.exit(1)
}

console.log(
  `i18n coverage OK (${literalReferences} literal references, ${scannedFiles} files scanned)`,
)
