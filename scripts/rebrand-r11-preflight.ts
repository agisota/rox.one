/**
 * Report-only R.11 preflight runner.
 *
 * This script checks the hard prerequisites for the destructive rebrand
 * history rewrite. It never creates refs, runs filter-repo, or pushes.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface R11PullRequest {
  number: number
  title: string
  headRefName?: string
  baseRefName?: string
}

export interface R11PreflightSnapshot {
  noActiveGoalAcknowledged: boolean
  openPullRequests: R11PullRequest[]
  forkCount: number
  expectedForkCount: number
  rebrandTagPresent: boolean
  backupTagPresent: boolean
  backupBranchPresent: boolean
  offlineMirrorPresent: boolean
  gitFilterRepoPresent: boolean
  r11CloseoutTicketPresent: boolean
  r11CloseoutWorklogPresent: boolean
  mainSyncedWithOrigin: boolean
  worktreeClean: boolean
  openPullRequestsError?: string
  forkReviewError?: string
}

export interface R11PreflightResult {
  id: string
  label: string
  passed: boolean
  detail: string
}

export type R11PreflightStage = 'pre-backup' | 'pre-rewrite'

export interface R11PreflightOptions {
  stage?: R11PreflightStage
}

export interface R11PreflightReport {
  stage: R11PreflightStage
  results: R11PreflightResult[]
  allPassed: boolean
}

const DEFAULT_REPO_ROOT = join(import.meta.dir, '..')
const DEFAULT_OFFLINE_MIRROR = '/tmp/rox-one-terminal-backup-2026-05-13.git'

function pass(id: string, label: string, detail: string): R11PreflightResult {
  return { id, label, passed: true, detail }
}

function fail(id: string, label: string, detail: string): R11PreflightResult {
  return { id, label, passed: false, detail }
}

export function evaluateR11Preflight(
  snapshot: R11PreflightSnapshot,
  options: R11PreflightOptions = {},
): R11PreflightReport {
  const stage = options.stage ?? 'pre-backup'
  const results: R11PreflightResult[] = []

  results.push(
    snapshot.noActiveGoalAcknowledged
      ? pass(
          'no-active-goal',
          'No active Codex goal',
          'Operator acknowledged no active /goal run.',
        )
      : fail(
          'no-active-goal',
          'No active Codex goal',
          'Missing ROX_R11_NO_ACTIVE_GOAL=1 acknowledgement.',
        ),
  )

  if (snapshot.openPullRequestsError) {
    results.push(
      fail(
        'no-open-prs',
        'No open PRs',
        `Could not query open PRs: ${snapshot.openPullRequestsError}`,
      ),
    )
  } else if (snapshot.openPullRequests.length === 0) {
    results.push(pass('no-open-prs', 'No open PRs', 'GitHub reports no open PRs.'))
  } else {
    const prs = snapshot.openPullRequests
      .map((pr) => `#${pr.number} ${pr.headRefName ?? '?'} -> ${pr.baseRefName ?? '?'} (${pr.title})`)
      .join('; ')
    results.push(fail('no-open-prs', 'No open PRs', prs))
  }

  if (snapshot.forkReviewError) {
    results.push(
      fail(
        'fork-review',
        'Fork count reviewed',
        `Could not review forks: ${snapshot.forkReviewError}`,
      ),
    )
  } else if (snapshot.forkCount === snapshot.expectedForkCount) {
    results.push(
      pass(
        'fork-review',
        'Fork count reviewed',
        `GitHub reports expected fork count ${snapshot.expectedForkCount}.`,
      ),
    )
  } else {
    results.push(
      fail(
        'fork-review',
        'Fork count reviewed',
        `GitHub reports ${snapshot.forkCount} fork(s); expected ${snapshot.expectedForkCount}.`,
      ),
    )
  }

  results.push(
    snapshot.rebrandTagPresent
      ? pass('rebrand-tag', 'rebrand-v1 tag exists', 'rebrand-v1 is visible on origin.')
      : fail('rebrand-tag', 'rebrand-v1 tag exists', 'rebrand-v1 is missing.'),
  )
  if (stage === 'pre-rewrite') {
    results.push(
      snapshot.backupTagPresent
        ? pass(
            'backup-tag',
            'Backup tag exists',
            'pre-rebrand-history-rewrite-backup is visible on origin.',
          )
        : fail(
            'backup-tag',
            'Backup tag exists',
            'pre-rebrand-history-rewrite-backup is missing on origin.',
          ),
    )
    results.push(
      snapshot.backupBranchPresent
        ? pass(
            'backup-branch',
            'Backup branch exists',
            'backup/pre-rebrand-history-rewrite-2026-05-13 is visible on origin.',
          )
        : fail(
            'backup-branch',
            'Backup branch exists',
            'backup/pre-rebrand-history-rewrite-2026-05-13 is missing on origin.',
          ),
    )
    results.push(
      snapshot.offlineMirrorPresent
        ? pass(
            'offline-mirror',
            'Offline mirror exists',
            `${DEFAULT_OFFLINE_MIRROR} exists.`,
          )
        : fail(
            'offline-mirror',
            'Offline mirror exists',
            `${DEFAULT_OFFLINE_MIRROR} is missing.`,
          ),
    )
  }
  results.push(
    snapshot.gitFilterRepoPresent
      ? pass('git-filter-repo', 'git-filter-repo available', 'git-filter-repo is on PATH.')
      : fail('git-filter-repo', 'git-filter-repo available', 'git-filter-repo is missing from PATH.'),
  )
  results.push(
    snapshot.r11CloseoutTicketPresent
      ? pass(
          'r11-closeout-ticket',
          'R.11 closeout ticket exists',
          'docs/tickets/T298-rebrand-git-history-rewrite.md exists.',
        )
      : fail(
          'r11-closeout-ticket',
          'R.11 closeout ticket exists',
          'docs/tickets/T298-rebrand-git-history-rewrite.md is missing.',
        ),
  )
  results.push(
    snapshot.r11CloseoutWorklogPresent
      ? pass(
          'r11-closeout-worklog',
          'R.11 closeout worklog exists',
          'docs/worklog/T298-rebrand-git-history-rewrite.md exists.',
        )
      : fail(
          'r11-closeout-worklog',
          'R.11 closeout worklog exists',
          'docs/worklog/T298-rebrand-git-history-rewrite.md is missing.',
        ),
  )
  results.push(
    snapshot.mainSyncedWithOrigin
      ? pass('main-sync', 'main synced with origin/main', 'origin/main...main is 0 0.')
      : fail('main-sync', 'main synced with origin/main', 'origin/main...main is not 0 0.'),
  )
  results.push(
    snapshot.worktreeClean
      ? pass('worktree-clean', 'Worktree clean', 'git status --porcelain is empty.')
      : fail('worktree-clean', 'Worktree clean', 'git status --porcelain is not empty.'),
  )

  return {
    stage,
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
    stdout: new TextDecoder().decode(proc.stdout).trim(),
    stderr: new TextDecoder().decode(proc.stderr).trim(),
  }
}

function parseOpenPullRequests(stdout: string): R11PullRequest[] {
  const parsed = JSON.parse(stdout || '[]')
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      number: Number(item.number),
      title: String(item.title ?? ''),
      headRefName: item.headRefName ? String(item.headRefName) : undefined,
      baseRefName: item.baseRefName ? String(item.baseRefName) : undefined,
    }))
    .filter((item) => Number.isFinite(item.number) && item.number > 0)
}

function parseExpectedForkCount(value: string | undefined): { count: number; error?: string } {
  if (value === undefined || value === '') return { count: 0 }
  const count = Number(value)
  if (!Number.isInteger(count) || count < 0) {
    return { count: 0, error: `invalid ROX_R11_EXPECTED_FORKS=${value}` }
  }
  return { count }
}

export function collectR11PreflightSnapshot(
  repoRoot = DEFAULT_REPO_ROOT,
): R11PreflightSnapshot {
  const prQuery = run(
    [
      'gh',
      'pr',
      'list',
      '--state',
      'open',
      '--limit',
      '200',
      '--json',
      'number,title,headRefName,baseRefName',
    ],
    repoRoot,
  )
  let openPullRequests: R11PullRequest[] = []
  let openPullRequestsError: string | undefined
  if (prQuery.exitCode === 0) {
    try {
      openPullRequests = parseOpenPullRequests(prQuery.stdout)
    } catch (error) {
      openPullRequestsError = error instanceof Error ? error.message : String(error)
    }
  } else {
    openPullRequestsError = prQuery.stderr || prQuery.stdout || `exit ${prQuery.exitCode}`
  }

  const expectedForkCount = parseExpectedForkCount(process.env.ROX_R11_EXPECTED_FORKS)
  const forksQuery = run(
    ['gh', 'api', 'repos/agisota/rox-one-terminal/forks', '--jq', 'length'],
    repoRoot,
  )
  let forkCount = 0
  let forkReviewError = expectedForkCount.error
  if (forksQuery.exitCode === 0) {
    const parsedForkCount = Number(forksQuery.stdout)
    if (Number.isInteger(parsedForkCount) && parsedForkCount >= 0) {
      forkCount = parsedForkCount
    } else {
      forkReviewError = `invalid fork count response: ${forksQuery.stdout}`
    }
  } else {
    forkReviewError = forksQuery.stderr || forksQuery.stdout || `exit ${forksQuery.exitCode}`
  }

  const remoteTags = run(
    [
      'git',
      'ls-remote',
      '--tags',
      'origin',
      'rebrand-v1',
      'pre-rebrand-history-rewrite-backup',
    ],
    repoRoot,
  ).stdout
  const remoteBackupBranch = run(
    [
      'git',
      'ls-remote',
      '--heads',
      'origin',
      'backup/pre-rebrand-history-rewrite-2026-05-13',
    ],
    repoRoot,
  ).stdout
  const sync = run(
    ['git', 'rev-list', '--left-right', '--count', 'origin/main...main'],
    repoRoot,
  ).stdout
  const status = run(['git', 'status', '--porcelain'], repoRoot).stdout
  const filterRepo = run(['bash', '-lc', 'command -v git-filter-repo'], repoRoot)

  return {
    noActiveGoalAcknowledged: process.env.ROX_R11_NO_ACTIVE_GOAL === '1',
    openPullRequests,
    openPullRequestsError,
    forkCount,
    expectedForkCount: expectedForkCount.count,
    forkReviewError,
    rebrandTagPresent: remoteTags.includes('refs/tags/rebrand-v1'),
    backupTagPresent: remoteTags.includes('refs/tags/pre-rebrand-history-rewrite-backup'),
    backupBranchPresent: remoteBackupBranch.includes(
      'refs/heads/backup/pre-rebrand-history-rewrite-2026-05-13',
    ),
    offlineMirrorPresent: existsSync(DEFAULT_OFFLINE_MIRROR),
    gitFilterRepoPresent: filterRepo.exitCode === 0 && filterRepo.stdout.length > 0,
    r11CloseoutTicketPresent: existsSync(
      join(repoRoot, 'docs', 'tickets', 'T298-rebrand-git-history-rewrite.md'),
    ),
    r11CloseoutWorklogPresent: existsSync(
      join(repoRoot, 'docs', 'worklog', 'T298-rebrand-git-history-rewrite.md'),
    ),
    mainSyncedWithOrigin: /^0\s+0$/.test(sync),
    worktreeClean: status.length === 0,
  }
}

function padRight(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length)
}

export function formatR11PreflightReport(report: R11PreflightReport): string {
  const stageLabel = report.stage === 'pre-rewrite' ? 'pre-rewrite' : 'pre-backup'
  const headers = ['id', 'status', 'detail'] as const
  const rows = report.results.map((result) => [
    result.id,
    result.passed ? 'pass' : 'fail',
    result.detail,
  ])
  const widths = headers.map((header, idx) => {
    const cells = [header, ...rows.map((row) => row[idx] ?? '')]
    return Math.min(36, Math.max(...cells.map((cell) => cell.length)))
  })
  const renderRow = (cells: readonly string[]): string =>
    cells
      .map((cell, idx) => {
        const width = widths[idx] ?? 0
        const clipped = cell.length > width ? `${cell.slice(0, width - 1)}…` : cell
        return padRight(clipped, width)
      })
      .join('  ')
      .trimEnd()
  const lines = [
    renderRow(headers),
    widths.map((width) => '-'.repeat(width)).join('  '),
    ...rows.map(renderRow),
    '',
    report.allPassed
      ? `green — every R.11 ${stageLabel} prerequisite is satisfied`
      : `red — ${report.results.filter((result) => !result.passed).length} R.11 ${stageLabel} prerequisite(s) failing`,
  ]
  return lines.join('\n')
}

function parseStageArg(args: string[]): R11PreflightStage {
  const stageFlagIndex = args.indexOf('--stage')
  const rawStage = stageFlagIndex >= 0
    ? args[stageFlagIndex + 1]
    : args.find((arg) => arg.startsWith('--stage='))?.slice('--stage='.length)
  if (rawStage === undefined || rawStage === '') return 'pre-backup'
  if (rawStage === 'pre-backup' || rawStage === 'pre-rewrite') return rawStage
  throw new Error(`invalid --stage value: ${rawStage}`)
}

async function main(): Promise<number> {
  const stage = parseStageArg(Bun.argv.slice(2))
  const snapshot = collectR11PreflightSnapshot()
  const report = evaluateR11Preflight(snapshot, { stage })
  // eslint-disable-next-line no-console
  console.log(formatR11PreflightReport(report))
  return report.allPassed ? 0 : 1
}

if (import.meta.main) {
  main()
    .then((code) => {
      process.exit(code)
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('rebrand-r11-preflight crashed:', error)
      process.exit(2)
    })
}
