/**
 * Report-only R.11 legal-preserve checker.
 *
 * Compares legal attribution files between the mandatory backup ref and HEAD,
 * and verifies the Dockerfile source-label attribution. It never mutates refs
 * or history.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DEFAULT_REPO_ROOT = join(import.meta.dir, '..')
const DEFAULT_BACKUP_REF = 'pre-rebrand-history-rewrite-backup'
const LEGAL_FILES = ['LICENSE', 'NOTICE', 'TRADEMARK.md'] as const
const SOURCE_REPO = 'rox' + '-agents-oss'
const SOURCE_LABEL = 'org.opencontainers.image.source'
const SOURCE_URL = `github.com/lukilabs/${SOURCE_REPO}`

export type LegalPreserveFile = typeof LEGAL_FILES[number]

export interface LegalFileSnapshot {
  before?: string
  after?: string
  beforeError?: string
  afterError?: string
}

export interface LegalPreserveSnapshot {
  files: Record<LegalPreserveFile, LegalFileSnapshot>
  dockerfile?: string
  dockerfileError?: string
}

export interface LegalPreserveResult {
  id: string
  passed: boolean
  detail: string
}

export interface LegalPreserveReport {
  results: LegalPreserveResult[]
  allPassed: boolean
}

function pass(id: string, detail: string): LegalPreserveResult {
  return { id, passed: true, detail }
}

function fail(id: string, detail: string): LegalPreserveResult {
  return { id, passed: false, detail }
}

export function evaluateLegalPreserveSnapshot(
  snapshot: LegalPreserveSnapshot,
): LegalPreserveReport {
  const results: LegalPreserveResult[] = []

  for (const file of LEGAL_FILES) {
    const state = snapshot.files[file]
    const id = `legal-file-${file}`
    if (state.beforeError) {
      results.push(fail(id, `Could not read ${DEFAULT_BACKUP_REF}:${file}: ${state.beforeError}`))
      continue
    }
    if (state.afterError) {
      results.push(fail(id, `Could not read HEAD:${file}: ${state.afterError}`))
      continue
    }
    if (state.before === undefined || state.after === undefined) {
      results.push(fail(id, `${file} content is incomplete.`))
      continue
    }
    results.push(
      state.before === state.after
        ? pass(id, `${file} matches ${DEFAULT_BACKUP_REF}.`)
        : fail(id, `${file} differs from ${DEFAULT_BACKUP_REF}.`),
    )
  }

  if (snapshot.dockerfileError) {
    results.push(
      fail(
        'dockerfile-source-attribution',
        `Could not read Dockerfile.server: ${snapshot.dockerfileError}`,
      ),
    )
  } else if (
    snapshot.dockerfile?.includes(SOURCE_LABEL)
    && snapshot.dockerfile.includes(SOURCE_URL)
  ) {
    results.push(
      pass('dockerfile-source-attribution', 'Dockerfile.server source attribution is intact.'),
    )
  } else {
    results.push(
      fail(
        'dockerfile-source-attribution',
        'Dockerfile.server source attribution label is missing or rewritten.',
      ),
    )
  }

  return {
    results,
    allPassed: results.every((result) => result.passed),
  }
}

function run(
  cmd: string[],
  cwd: string,
): { exitCode: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync({
    cmd,
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env },
  })
  return {
    exitCode: proc.exitCode,
    stdout: new TextDecoder().decode(proc.stdout),
    stderr: new TextDecoder().decode(proc.stderr).trim(),
  }
}

function readGitObject(repoRoot: string, spec: string): { content?: string; error?: string } {
  const result = run(['git', 'show', spec], repoRoot)
  if (result.exitCode === 0) return { content: result.stdout }
  return { error: result.stderr || result.stdout || `exit ${result.exitCode}` }
}

export function collectLegalPreserveSnapshot(
  repoRoot = DEFAULT_REPO_ROOT,
  backupRef = DEFAULT_BACKUP_REF,
): LegalPreserveSnapshot {
  const files = {} as Record<LegalPreserveFile, LegalFileSnapshot>
  for (const file of LEGAL_FILES) {
    const before = readGitObject(repoRoot, `${backupRef}:${file}`)
    const after = readGitObject(repoRoot, `HEAD:${file}`)
    files[file] = {
      before: before.content,
      after: after.content,
      beforeError: before.error,
      afterError: after.error,
    }
  }

  try {
    return {
      files,
      dockerfile: readFileSync(join(repoRoot, 'Dockerfile.server'), 'utf8'),
    }
  } catch (error) {
    return {
      files,
      dockerfileError: error instanceof Error ? error.message : String(error),
    }
  }
}

function padRight(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length)
}

export function formatLegalPreserveReport(report: LegalPreserveReport): string {
  const headers = ['id', 'status', 'detail'] as const
  const rows = report.results.map((result) => [
    result.id,
    result.passed ? 'pass' : 'fail',
    result.detail,
  ])
  const widths = headers.map((header, idx) => {
    const cells = [header, ...rows.map((row) => row[idx] ?? '')]
    return Math.min(120, Math.max(...cells.map((cell) => cell.length)))
  })
  const formatRow = (cells: readonly string[]): string =>
    cells.map((cell, idx) => {
      const width = widths[idx] ?? 0
      const clipped = cell.length > width ? `${cell.slice(0, width - 1)}…` : cell
      return padRight(clipped, width)
    }).join('  ').trimEnd()
  const lines = [
    formatRow(headers),
    widths.map((width) => '-'.repeat(width)).join('  '),
    ...rows.map(formatRow),
    '',
    report.allPassed
      ? 'green - every R.11 legal-preserve check passed'
      : `red - ${report.results.filter((result) => !result.passed).length} R.11 legal-preserve check(s) failing`,
  ]
  return lines.join('\n')
}

async function main(): Promise<number> {
  const snapshot = collectLegalPreserveSnapshot()
  const report = evaluateLegalPreserveSnapshot(snapshot)
  // eslint-disable-next-line no-console
  console.log(formatLegalPreserveReport(report))
  return report.allPassed ? 0 : 1
}

if (import.meta.main) {
  main()
    .then((code) => {
      process.exit(code)
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('rebrand-r11-legal-preserve crashed:', error)
      process.exit(2)
    })
}
