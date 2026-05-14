/**
 * RC pre-flight runner — M.20 T298b.
 *
 * Walks the validator subset of
 * `docs/release/v1-rc-preflight-checklist.md`, runs each `bun run validate:*`
 * script in sequence, and emits a green/red table per gate.
 *
 * Source of truth for which gates to run: section §1 of the checklist doc.
 * The doc is READ-ONLY for this script — T298 froze it.
 *
 * CLI:
 *   bun run scripts/rc-preflight-runner.ts                 # short-circuit on red
 *   bun run scripts/rc-preflight-runner.ts --continue-on-failure
 *
 * Exit code is 0 iff every gate exited 0.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DEFAULT_REPO_ROOT = join(import.meta.dir, '..')
const DEFAULT_CHECKLIST = join(
  'docs',
  'release',
  'v1-rc-preflight-checklist.md',
)
const STDERR_TAIL_BYTES = 400

export interface RunnerOptions {
  repoRoot?: string
  checklistRelativePath?: string
  continueOnFailure?: boolean
  bunExecutable?: string
  /**
   * Override the working directory for the spawned child. Defaults to
   * `repoRoot` so the real `package.json` scripts resolve.
   */
  cwd?: string
}

export interface GateResult {
  gate: string
  passed: boolean
  exitCode: number | null
  durationMs: number
  stdoutTail: string
  stderrTail: string
  skipped?: boolean
}

export interface RunnerReport {
  results: GateResult[]
  allPassed: boolean
  gatesParsed: number
  shortCircuited: boolean
}

/**
 * Parse the checklist markdown and return the ordered list of
 * `validate:<name>` script suffixes referenced in the §1 validator-gates
 * section. We deliberately look only at the first table of `bun run
 * validate:*` spans so §2/§3/etc. command callouts do not pollute the run
 * order.
 */
export function parseValidatorGates(markdown: string): string[] {
  // Anchor on section §1 heading. The doc frozen by T298 uses
  // `## 1. Validator gates (CI)` as the heading text.
  const sectionStart = markdown.search(/^##\s+1\.\s+Validator gates/m)
  if (sectionStart === -1) {
    throw new Error(
      'rc-preflight-runner: could not find "## 1. Validator gates" section',
    )
  }
  // Stop scanning at the next top-level section heading.
  const tail = markdown.slice(sectionStart)
  const nextHeadingIndex = tail.slice(2).search(/^##\s+\d+\./m)
  const section =
    nextHeadingIndex === -1 ? tail : tail.slice(0, nextHeadingIndex + 2)

  const seen = new Set<string>()
  const ordered: string[] = []
  // Match `bun run validate:<name>` inside backticks. The name is
  // letters/digits plus `-` plus `:` (some validators are namespaced).
  const pattern = /`bun run validate:([a-z0-9][a-z0-9:_-]*)`/gi
  for (const match of section.matchAll(pattern)) {
    const name = match[1]
    if (!name) continue
    // Skip aggregate gates — those are higher-level orchestrators and
    // running them inside the runner would double-count individual gates.
    if (name === 'ci' || name === 'release' || name === 'dev') {
      continue
    }
    if (seen.has(name)) continue
    seen.add(name)
    ordered.push(name)
  }
  return ordered
}

function decodeTail(bytes: Uint8Array, maxBytes: number): string {
  if (bytes.byteLength === 0) return ''
  const sliceStart = Math.max(0, bytes.byteLength - maxBytes)
  return new TextDecoder().decode(bytes.subarray(sliceStart))
}

async function readStreamFully(
  stream: ReadableStream<Uint8Array> | null,
): Promise<Uint8Array> {
  if (!stream) return new Uint8Array(0)
  const chunks: Uint8Array[] = []
  const reader = stream.getReader()
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      total += value.byteLength
    }
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

export async function runGate(
  gate: string,
  options: RunnerOptions,
): Promise<GateResult> {
  const start = Date.now()
  const bunExec = options.bunExecutable ?? 'bun'
  const proc = Bun.spawn({
    cmd: [bunExec, 'run', `validate:${gate}`],
    cwd: options.cwd ?? options.repoRoot ?? DEFAULT_REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env },
  })
  const [stdoutBytes, stderrBytes, exitCode] = await Promise.all([
    readStreamFully(proc.stdout as ReadableStream<Uint8Array> | null),
    readStreamFully(proc.stderr as ReadableStream<Uint8Array> | null),
    proc.exited,
  ])
  const durationMs = Date.now() - start
  return {
    gate,
    exitCode,
    passed: exitCode === 0,
    durationMs,
    stdoutTail: decodeTail(stdoutBytes, STDERR_TAIL_BYTES),
    stderrTail: decodeTail(stderrBytes, STDERR_TAIL_BYTES),
  }
}

export async function runPreflight(
  options: RunnerOptions = {},
): Promise<RunnerReport> {
  const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT
  const checklistPath = join(
    repoRoot,
    options.checklistRelativePath ?? DEFAULT_CHECKLIST,
  )
  if (!existsSync(checklistPath)) {
    throw new Error(
      `rc-preflight-runner: checklist missing at ${checklistPath}`,
    )
  }
  const markdown = readFileSync(checklistPath, 'utf8')
  const gates = parseValidatorGates(markdown)
  if (gates.length === 0) {
    throw new Error(
      'rc-preflight-runner: parsed zero validator gates from §1',
    )
  }
  const results: GateResult[] = []
  let shortCircuited = false
  for (const gate of gates) {
    const result = await runGate(gate, { ...options, repoRoot })
    results.push(result)
    if (!result.passed && !options.continueOnFailure) {
      shortCircuited = true
      // Record the skipped gates so the printed table makes the gap obvious.
      for (const remaining of gates.slice(results.length)) {
        results.push({
          gate: remaining,
          exitCode: null,
          passed: false,
          durationMs: 0,
          stdoutTail: '',
          stderrTail: '',
          skipped: true,
        })
      }
      break
    }
  }
  return {
    results,
    gatesParsed: gates.length,
    allPassed: results.every((entry) => entry.passed),
    shortCircuited,
  }
}

function padRight(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length)
}

export function formatReport(report: RunnerReport): string {
  const headers = ['gate', 'status', 'duration', 'stderr-tail'] as const
  const rows = report.results.map((entry) => {
    const status = entry.skipped
      ? 'skip'
      : entry.passed
        ? 'pass'
        : 'fail'
    const duration = entry.skipped ? '-' : `${entry.durationMs}ms`
    const tail = entry.stderrTail.replace(/\s+/g, ' ').trim().slice(0, 80)
    return [entry.gate, status, duration, tail]
  })
  const widths = headers.map((header, idx) => {
    const cells = [header, ...rows.map((row) => row[idx] ?? '')]
    return Math.max(...cells.map((cell) => cell.length))
  })
  const formatRow = (cells: readonly string[]): string =>
    cells.map((cell, idx) => padRight(cell, widths[idx] ?? 0)).join('  ').trimEnd()
  const separator = widths.map((width) => '-'.repeat(width)).join('  ')
  const lines = [formatRow(headers), separator, ...rows.map(formatRow)]
  const summary = report.allPassed
    ? `all ${report.gatesParsed} gates green`
    : `red — ${report.results.filter((r) => !r.passed && !r.skipped).length} failed${report.shortCircuited ? ' (short-circuited)' : ''}`
  lines.push('', summary)
  return lines.join('\n')
}

async function main(): Promise<number> {
  const continueOnFailure = process.argv.includes('--continue-on-failure')
  const report = await runPreflight({ continueOnFailure })
  // eslint-disable-next-line no-console
  console.log(formatReport(report))
  return report.allPassed ? 0 : 1
}

if (import.meta.main) {
  main()
    .then((code) => {
      process.exit(code)
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('rc-preflight-runner crashed:', error)
      process.exit(2)
    })
}
