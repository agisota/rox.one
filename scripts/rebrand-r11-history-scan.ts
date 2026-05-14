/**
 * Report-only R.11 history scan.
 *
 * Streams `git log -p --all` and reports legacy rebrand tokens that still
 * appear in patch lines outside the legal-preserve path allowlist. It never
 * mutates refs or history.
 */

import { join } from 'node:path'

const DEFAULT_REPO_ROOT = join(import.meta.dir, '..')
const DEFAULT_MAX_FINDINGS = 80

const legacyStem = 'craft'
const legacyPackage = `${legacyStem}-agent`
const legacyPrefix = 'CRAFT' + '_'
const legacyProduct = 'Craft' + ' Agent'

const FORBIDDEN_TOKENS = [
  `.${legacyPackage}`,
  `~/.${legacyStem}`,
  legacyPackage,
  `@${legacyPackage}`,
  legacyPrefix,
  `${legacyProduct}s`,
  legacyProduct,
  'Craft' + 'AppIcon',
  'Craft' + 'AgentsLogo',
  'Craft' + 'AgentsSymbol',
  'Craft' + 'McpClient',
  'Craft' + 'OAuth',
  'Craft' + 'MetadataSchema',
  `${legacyStem}-cli`,
  `${legacyStem}-logos`,
]

export interface HistoryFinding {
  commit: string
  path: string
  token: string
  line: string
}

export interface HistoryScanOptions {
  maxFindings?: number
}

export interface HistoryFindings extends Array<HistoryFinding> {
  truncated: boolean
  totalMatchesSeen: number
}

function createHistoryFindings(): HistoryFindings {
  const findings = [] as unknown as HistoryFindings
  findings.truncated = false
  findings.totalMatchesSeen = 0
  return findings
}

export function isHistoryPathAllowlisted(path: string): boolean {
  if (['LICENSE', 'NOTICE', 'TRADEMARK.md'].includes(path)) return true
  if (path.startsWith('docs/decision-records/')) return true
  if (/^docs\/worklog\/T[0-3].*-.*\.md$/.test(path)) return true
  if (/^docs\/tickets\/T[0-3].*-.*\.md$/.test(path)) return true
  if (path.startsWith('apps/electron/resources/release-notes/')) return true
  if (path === 'scripts/rebrand-r11-history-scan.ts') return true
  if (path === 'scripts/__tests__/rebrand-r11-history-scan.test.ts') return true
  if (path.startsWith('.brv/') || path.startsWith('.swarm/') || path.startsWith('.git/')) {
    return true
  }
  return false
}

function isHistoryLineAllowlisted(path: string, line: string, token: string): boolean {
  if (isHistoryPathAllowlisted(path)) return true
  if (path === 'Dockerfile.server') {
    return (
      line.includes('org.opencontainers.image.source')
      && line.includes('github.com/lukilabs/craft-agents-oss')
    )
  }
  if (path === 'README.md') {
    return line.includes('github.com/lukilabs/craft-agents-oss') || token === legacyPrefix
  }
  return false
}

function parseDiffPath(line: string): string | undefined {
  const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/)
  if (!match) return undefined
  const [, oldPath, newPath] = match
  if (newPath && newPath !== '/dev/null') return newPath
  if (oldPath && oldPath !== '/dev/null') return oldPath
  return undefined
}

class HistoryScanCollector {
  private readonly findings: HistoryFindings
  private readonly maxFindings: number
  private currentCommit = 'unknown'
  private currentPath = 'unknown'

  constructor(options: HistoryScanOptions = {}) {
    this.findings = createHistoryFindings()
    this.maxFindings = Math.max(0, options.maxFindings ?? DEFAULT_MAX_FINDINGS)
  }

  feedLine(rawLine: string): void {
    const commitMatch = rawLine.match(/^commit\s+([0-9a-f]{7,40})\b/i)
    if (commitMatch?.[1]) {
      this.currentCommit = commitMatch[1]
      return
    }

    const diffPath = parseDiffPath(rawLine)
    if (diffPath) {
      this.currentPath = diffPath
      return
    }

    if (!rawLine.startsWith('+') && !rawLine.startsWith('-')) return
    if (rawLine.startsWith('+++ ') || rawLine.startsWith('--- ')) return

    for (const token of FORBIDDEN_TOKENS) {
      if (!rawLine.includes(token)) continue
      if (isHistoryLineAllowlisted(this.currentPath, rawLine, token)) continue
      this.findings.totalMatchesSeen += 1
      if (this.findings.length < this.maxFindings) {
        this.findings.push({
          commit: this.currentCommit,
          path: this.currentPath,
          token,
          line: rawLine.slice(0, 240),
        })
      } else {
        this.findings.truncated = true
      }
      break
    }
  }

  result(): HistoryFindings {
    return this.findings
  }
}

export function collectHistoryFindingsFromText(
  text: string,
  options: HistoryScanOptions = {},
): HistoryFindings {
  const collector = new HistoryScanCollector(options)
  for (const line of text.split(/\r?\n/)) {
    collector.feedLine(line)
  }
  return collector.result()
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

export async function runHistoryScan(
  repoRoot = DEFAULT_REPO_ROOT,
  options: HistoryScanOptions = {},
): Promise<HistoryFindings> {
  const collector = new HistoryScanCollector(options)
  const proc = Bun.spawn({
    cmd: ['git', 'log', '--all', '--no-color', '--no-ext-diff', '-p'],
    cwd: repoRoot,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env },
  })
  const stderrPromise = readStreamFully(proc.stderr as ReadableStream<Uint8Array> | null)
  const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let killedAfterLimit = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    pending += decoder.decode(value, { stream: true })
    const lines = pending.split(/\r?\n/)
    pending = lines.pop() ?? ''
    for (const line of lines) {
      collector.feedLine(line)
      if (collector.result().truncated) {
        proc.kill()
        killedAfterLimit = true
        break
      }
    }
    if (killedAfterLimit) break
  }

  pending += decoder.decode()
  if (!killedAfterLimit && pending.length > 0) {
    collector.feedLine(pending)
  }

  const [exitCode, stderrBytes] = await Promise.all([proc.exited, stderrPromise])
  const findings = collector.result()
  if (exitCode !== 0 && findings.totalMatchesSeen === 0) {
    const stderr = new TextDecoder().decode(stderrBytes).trim()
    throw new Error(`git log history scan failed: ${stderr || `exit ${exitCode}`}`)
  }
  return findings
}

export function formatHistoryScanReport(findings: HistoryFindings): string {
  if (findings.totalMatchesSeen === 0) {
    return 'green - git log -p --all history scan found zero forbidden-token patch lines outside the legal-preserve allowlist'
  }

  const lines = [
    `red - git log -p --all history scan found ${findings.totalMatchesSeen} forbidden-token patch line(s) outside the legal-preserve allowlist`,
    'commit  path  token  line',
    '------  ----  -----  ----',
  ]
  for (const finding of findings) {
    lines.push(`${finding.commit}  ${finding.path}  ${finding.token}  ${finding.line}`)
  }
  if (findings.truncated) {
    lines.push(`... output truncated after ${findings.length} finding(s)`)
  }
  return lines.join('\n')
}

function parseMaxFindings(): number {
  const raw = process.env.REBRAND_R11_HISTORY_MAX_FINDINGS
  if (!raw) return DEFAULT_MAX_FINDINGS
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0) return DEFAULT_MAX_FINDINGS
  return parsed
}

async function main(): Promise<number> {
  const findings = await runHistoryScan(DEFAULT_REPO_ROOT, { maxFindings: parseMaxFindings() })
  // eslint-disable-next-line no-console
  console.log(formatHistoryScanReport(findings))
  return findings.totalMatchesSeen === 0 ? 0 : 1
}

if (import.meta.main) {
  main()
    .then((code) => {
      process.exit(code)
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('rebrand-r11-history-scan crashed:', error)
      process.exit(2)
    })
}
