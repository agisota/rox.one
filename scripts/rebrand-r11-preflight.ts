/**
 * Report-only R.11 preflight runner.
 *
 * This script checks the hard prerequisites for the destructive rebrand
 * history rewrite. It never creates refs, runs filter-repo, or pushes.
 */

import { existsSync, readFileSync } from 'node:fs'
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
  rebrandPhaseCloseoutIssues: string[]
  masterPhase1CloseoutDone: boolean
  masterPhase2CloseoutDone: boolean
  rebrandTagPresent: boolean
  rebrandTagRemoteCommit?: string
  rebrandTagLocalCommit?: string
  rebrandTagLocalMatchesRemote: boolean
  rebrandTagOnMain: boolean
  mainCommit?: string
  backupTagPresent: boolean
  backupTagCommit?: string
  backupTagMatchesMain: boolean
  backupBranchPresent: boolean
  backupBranchCommit?: string
  backupBranchMatchesMain: boolean
  offlineMirrorPresent: boolean
  staleRemoteBranches: string[]
  currentBranch?: string
  currentBranchIsMain: boolean
  gitFilterRepoPresent: boolean
  r11CloseoutTicketPresent: boolean
  r11CloseoutWorklogPresent: boolean
  mainSyncedWithOrigin: boolean
  worktreeClean: boolean
  openPullRequestsError?: string
  forkReviewError?: string
  staleRemoteBranchesError?: string
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
const REBRAND_R0_R10_TICKET_PATHS = [
  'docs/tickets/T260-rebrand-canonical-decision-adr.md',
  'docs/tickets/T261-rebrand-mapping-report.md',
  'docs/tickets/T262-rebrand-lint-script.md',
  'docs/tickets/T263-rebrand-surface-text-completion.md',
  'docs/tickets/T264-rebrand-component-renames.md',
  'docs/tickets/T265-rebrand-class-renames.md',
  'docs/tickets/T266-rebrand-test-file-renames.md',
  'docs/tickets/T267-rebrand-logo-asset-renames.md',
  'docs/tickets/T268-rebrand-binary-and-doc-renames.md',
  'docs/tickets/T269-rebrand-readme-and-contributing.md',
  'docs/tickets/T270-rebrand-security-and-coc.md',
  'docs/tickets/T271-rebrand-plan-and-snapshot-rewrite.md',
  'docs/tickets/T272-rebrand-electron-readme-and-paths.md',
  'docs/tickets/T273-rebrand-pkg-scope-test-fixtures.md',
  'docs/tickets/T274-rebrand-pkg-scope-ui.md',
  'docs/tickets/T275-rebrand-pkg-scope-core.md',
  'docs/tickets/T276-rebrand-pkg-scope-audit.md',
  'docs/tickets/T277-rebrand-pkg-scope-session-tools-core.md',
  'docs/tickets/T278-rebrand-pkg-scope-session-mcp-server.md',
  'docs/tickets/T279-rebrand-pkg-scope-messaging.md',
  'docs/tickets/T280-rebrand-pkg-scope-pi-agent-server.md',
  'docs/tickets/T281-rebrand-pkg-scope-server.md',
  'docs/tickets/T282-rebrand-pkg-scope-shared.md',
  'docs/tickets/T283-rebrand-pkg-scope-apps.md',
  'docs/tickets/T284-rebrand-pkg-scope-closeout.md',
  'docs/tickets/T285-rebrand-env-var-shim-impl.md',
  'docs/tickets/T286-rebrand-env-var-call-site-migration.md',
  'docs/tickets/T287-rebrand-env-var-docs-update.md',
  'docs/tickets/T288-rebrand-env-var-deprecation-warning-coverage.md',
  'docs/tickets/T289-rebrand-dockerfile.md',
  'docs/tickets/T290-rebrand-ci-workflows.md',
  'docs/tickets/T291-rebrand-electron-builder-config.md',
  'docs/tickets/T292-user-data-migration-design.md',
  'docs/tickets/T293-user-data-migration-impl.md',
  'docs/tickets/T294-user-data-migration-electron-startup-wire.md',
  'docs/tickets/T295-community-link-audit-and-fix.md',
  'docs/tickets/T296-rebrand-sweep-closeout.md',
  'docs/tickets/T297-rebrand-prepush-hook-and-ci-gate.md',
  'docs/tickets/T298a-rebrand-allowlist-expansion.md',
  'docs/tickets/T300a-rebrand-agents-md-and-misc.md',
]
const MASTER_PHASE_1_CLOSEOUT_TICKET = 'docs/tickets/T223-c4-followups-closeout.md'
const MASTER_PHASE_2_CLOSEOUT_TICKET = 'docs/tickets/T229-rbac-integration-tests.md'
const R11_BACKUP_BRANCH = 'backup/pre-rebrand-history-rewrite-2026-05-13'

function pass(id: string, label: string, detail: string): R11PreflightResult {
  return { id, label, passed: true, detail }
}

function fail(id: string, label: string, detail: string): R11PreflightResult {
  return { id, label, passed: false, detail }
}

function describeCommit(value: string | undefined): string {
  return value && value.length > 0 ? value : 'missing'
}

function summarizeList(values: string[], limit = 8): string {
  const visible = values.slice(0, limit).join('; ')
  const remaining = values.length - limit
  return remaining > 0 ? `${visible}; ... +${remaining} more` : visible
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

  if (snapshot.rebrandPhaseCloseoutIssues.length === 0) {
    results.push(
      pass(
        'rebrand-closeouts',
        'R.0-R.10 closeouts done',
        'R.0-R.10 tickets, including R.9.5 suffixed tickets, are Status: DONE and matching worklogs exist.',
      ),
    )
  } else {
    results.push(
      fail(
        'rebrand-closeouts',
        'R.0-R.10 closeouts done',
        snapshot.rebrandPhaseCloseoutIssues.join('; '),
      ),
    )
  }

  results.push(
    snapshot.masterPhase1CloseoutDone
      ? pass(
          'phase1-closeout',
          'C4 Phase 1 closeout done',
          'docs/tickets/T223-c4-followups-closeout.md is Status: DONE.',
        )
      : fail(
          'phase1-closeout',
          'C4 Phase 1 closeout done',
          'docs/tickets/T223-c4-followups-closeout.md is missing or not Status: DONE.',
        ),
  )
  results.push(
    snapshot.masterPhase2CloseoutDone
      ? pass(
          'phase2-rbac-closeout',
          'RBAC Phase 2 closeout done',
          'docs/tickets/T229-rbac-integration-tests.md is Status: DONE.',
        )
      : fail(
          'phase2-rbac-closeout',
          'RBAC Phase 2 closeout done',
          'docs/tickets/T229-rbac-integration-tests.md is missing or not Status: DONE.',
        ),
  )

  results.push(
    snapshot.rebrandTagPresent
      ? pass('rebrand-tag', 'rebrand-v1 tag exists', 'rebrand-v1 is visible on origin.')
      : fail('rebrand-tag', 'rebrand-v1 tag exists', 'rebrand-v1 is missing.'),
  )
  results.push(
    snapshot.rebrandTagLocalMatchesRemote
      ? pass(
          'rebrand-tag-local-sync',
          'Local rebrand-v1 matches origin',
          `Local rebrand-v1 and origin rebrand-v1 peel to ${describeCommit(snapshot.rebrandTagRemoteCommit)}.`,
        )
      : fail(
          'rebrand-tag-local-sync',
          'Local rebrand-v1 matches origin',
          `Local rebrand-v1 target differs from origin: local ${describeCommit(snapshot.rebrandTagLocalCommit)}, origin ${describeCommit(snapshot.rebrandTagRemoteCommit)}.`,
        ),
  )
  results.push(
    snapshot.rebrandTagOnMain
      ? pass(
          'rebrand-tag-on-main',
          'rebrand-v1 tag is on main',
          `origin rebrand-v1 target ${describeCommit(snapshot.rebrandTagRemoteCommit)} is on origin/main ancestry.`,
        )
      : fail(
          'rebrand-tag-on-main',
          'rebrand-v1 tag is on main',
          `origin rebrand-v1 target ${describeCommit(snapshot.rebrandTagRemoteCommit)} is missing from origin/main ancestry.`,
        ),
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
    if (snapshot.backupTagPresent) {
      results.push(
        snapshot.backupTagMatchesMain
          ? pass(
              'backup-tag-target',
              'Backup tag matches main',
              `pre-rebrand-history-rewrite-backup and main both point to ${describeCommit(snapshot.mainCommit)}.`,
            )
          : fail(
              'backup-tag-target',
              'Backup tag matches main',
              `pre-rebrand-history-rewrite-backup target ${describeCommit(snapshot.backupTagCommit)} differs from main ${describeCommit(snapshot.mainCommit)}.`,
            ),
      )
    }
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
    if (snapshot.backupBranchPresent) {
      results.push(
        snapshot.backupBranchMatchesMain
          ? pass(
              'backup-branch-target',
              'Backup branch matches main',
              `backup/pre-rebrand-history-rewrite-2026-05-13 and main both point to ${describeCommit(snapshot.mainCommit)}.`,
            )
          : fail(
              'backup-branch-target',
              'Backup branch matches main',
              `backup/pre-rebrand-history-rewrite-2026-05-13 target ${describeCommit(snapshot.backupBranchCommit)} differs from main ${describeCommit(snapshot.mainCommit)}.`,
            ),
      )
    }
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
    if (snapshot.staleRemoteBranchesError) {
      results.push(
        fail(
          'remote-branch-review',
          'Remote branches reviewed',
          `Could not query origin branches: ${snapshot.staleRemoteBranchesError}`,
        ),
      )
    } else if (snapshot.staleRemoteBranches.length === 0) {
      results.push(
        pass(
          'remote-branch-review',
          'Remote branches reviewed',
          `origin only exposes main and ${R11_BACKUP_BRANCH}.`,
        ),
      )
    } else {
      results.push(
        fail(
          'remote-branch-review',
          'Remote branches reviewed',
          `origin has ${snapshot.staleRemoteBranches.length} non-main/non-R.11-backup branch(es): ${summarizeList(snapshot.staleRemoteBranches)}.`,
        ),
      )
    }
  }
  results.push(
    snapshot.currentBranchIsMain
      ? pass(
          'current-branch',
          'Current checkout is main',
          'Current checkout is main.',
        )
      : fail(
          'current-branch',
          'Current checkout is main',
          `Current checkout is ${describeCommit(snapshot.currentBranch)}; switch to main before R.11.`,
        ),
  )
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

function parseRemoteBranchNames(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[1] ?? '')
    .filter((ref) => ref.startsWith('refs/heads/'))
    .map((ref) => ref.slice('refs/heads/'.length))
    .filter((name) => name.length > 0)
    .sort()
}

function parseFirstLsRemoteCommit(stdout: string): string | undefined {
  return stdout
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0] ?? '')
    .find((value) => value.length > 0)
}

function isDoneTicket(repoRoot: string, ticketPath: string): boolean {
  const absolutePath = join(repoRoot, ticketPath)
  if (!existsSync(absolutePath)) return false
  const contents = readFileSync(absolutePath, 'utf8')
  return /^Status:\s*DONE\b/im.test(contents)
}

function worklogPathFor(ticketPath: string): string {
  return ticketPath.replace('docs/tickets/', 'docs/worklog/')
}

function collectRebrandPhaseCloseoutIssues(repoRoot: string): string[] {
  const issues: string[] = []
  for (const ticketPath of REBRAND_R0_R10_TICKET_PATHS) {
    const ticketAbsolutePath = join(repoRoot, ticketPath)
    const worklogPath = worklogPathFor(ticketPath)
    const worklogAbsolutePath = join(repoRoot, worklogPath)
    if (!existsSync(ticketAbsolutePath)) {
      issues.push(`${ticketPath} is missing`)
      continue
    }
    if (!isDoneTicket(repoRoot, ticketPath)) {
      issues.push(`${ticketPath} is not Status: DONE`)
    }
    if (!existsSync(worklogAbsolutePath)) {
      issues.push(`${worklogPath} is missing`)
    }
  }
  return issues
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
  const remoteHeads = run(['git', 'ls-remote', '--heads', 'origin'], repoRoot)
  const allowedRemoteBranches = new Set(['main', R11_BACKUP_BRANCH])
  const staleRemoteBranches = remoteHeads.exitCode === 0
    ? parseRemoteBranchNames(remoteHeads.stdout)
      .filter((branchName) => !allowedRemoteBranches.has(branchName))
    : []
  const staleRemoteBranchesError = remoteHeads.exitCode === 0
    ? undefined
    : remoteHeads.stderr || remoteHeads.stdout || `exit ${remoteHeads.exitCode}`
  const rebrandTagRemoteCommit = run(
    [
      'bash',
      '-lc',
      [
        "remote_tag_commit=$(git ls-remote --tags origin 'refs/tags/rebrand-v1^{}' | awk '{print $1}')",
        "if [ -z \"$remote_tag_commit\" ]; then remote_tag_commit=$(git ls-remote --tags origin 'refs/tags/rebrand-v1' | awk '{print $1}'); fi",
        'printf "%s" "$remote_tag_commit"',
      ].join(' && '),
    ],
    repoRoot,
  )
  const rebrandTagLocalCommit = run(
    ['git', 'rev-parse', '--verify', 'rebrand-v1^{commit}'],
    repoRoot,
  )
  const backupTagRemoteCommit = run(
    [
      'bash',
      '-lc',
      [
        "remote_tag_commit=$(git ls-remote --tags origin 'refs/tags/pre-rebrand-history-rewrite-backup^{}' | awk '{print $1}')",
        "if [ -z \"$remote_tag_commit\" ]; then remote_tag_commit=$(git ls-remote --tags origin 'refs/tags/pre-rebrand-history-rewrite-backup' | awk '{print $1}'); fi",
        'printf "%s" "$remote_tag_commit"',
      ].join(' && '),
    ],
    repoRoot,
  )
  const mainCommitResult = run(
    ['git', 'rev-parse', '--verify', 'main^{commit}'],
    repoRoot,
  )
  const remoteCommit = rebrandTagRemoteCommit.stdout || undefined
  const localCommit = rebrandTagLocalCommit.exitCode === 0
    ? rebrandTagLocalCommit.stdout || undefined
    : undefined
  const mainCommit = mainCommitResult.exitCode === 0
    ? mainCommitResult.stdout || undefined
    : undefined
  const backupTagCommit = backupTagRemoteCommit.stdout || undefined
  const backupBranchCommit = parseFirstLsRemoteCommit(remoteBackupBranch.stdout)
  const rebrandTagOnMain = remoteCommit
    ? run(['git', 'merge-base', '--is-ancestor', remoteCommit, 'origin/main'], repoRoot)
    : { exitCode: 1 }
  const rebrandTagLocalMatchesRemote = Boolean(
    remoteCommit && localCommit && remoteCommit === localCommit,
  )
  const backupTagMatchesMain = Boolean(
    mainCommit && backupTagCommit && mainCommit === backupTagCommit,
  )
  const backupBranchMatchesMain = Boolean(
    mainCommit && backupBranchCommit && mainCommit === backupBranchCommit,
  )
  const sync = run(
    ['git', 'rev-list', '--left-right', '--count', 'origin/main...main'],
    repoRoot,
  ).stdout
  const status = run(['git', 'status', '--porcelain'], repoRoot).stdout
  const currentBranchResult = run(['git', 'branch', '--show-current'], repoRoot)
  const currentBranch = currentBranchResult.exitCode === 0 && currentBranchResult.stdout.length > 0
    ? currentBranchResult.stdout
    : undefined
  const filterRepo = run(['bash', '-lc', 'command -v git-filter-repo'], repoRoot)

  return {
    noActiveGoalAcknowledged: process.env.ROX_R11_NO_ACTIVE_GOAL === '1',
    openPullRequests,
    openPullRequestsError,
    forkCount,
    expectedForkCount: expectedForkCount.count,
    forkReviewError,
    rebrandPhaseCloseoutIssues: collectRebrandPhaseCloseoutIssues(repoRoot),
    masterPhase1CloseoutDone: isDoneTicket(repoRoot, MASTER_PHASE_1_CLOSEOUT_TICKET),
    masterPhase2CloseoutDone: isDoneTicket(repoRoot, MASTER_PHASE_2_CLOSEOUT_TICKET),
    rebrandTagPresent: remoteTags.includes('refs/tags/rebrand-v1'),
    rebrandTagRemoteCommit: remoteCommit,
    rebrandTagLocalCommit: localCommit,
    rebrandTagLocalMatchesRemote,
    rebrandTagOnMain: rebrandTagOnMain.exitCode === 0,
    mainCommit,
    backupTagPresent: remoteTags.includes('refs/tags/pre-rebrand-history-rewrite-backup'),
    backupTagCommit,
    backupTagMatchesMain,
    backupBranchPresent: remoteBackupBranch.includes(
      `refs/heads/${R11_BACKUP_BRANCH}`,
    ),
    backupBranchCommit,
    backupBranchMatchesMain,
    offlineMirrorPresent: existsSync(DEFAULT_OFFLINE_MIRROR),
    staleRemoteBranches,
    staleRemoteBranchesError,
    currentBranch,
    currentBranchIsMain: currentBranch === 'main',
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
  const maxWidths = [36, 8, 160]
  const widths = headers.map((header, idx) => {
    const cells = [header, ...rows.map((row) => row[idx] ?? '')]
    return Math.min(maxWidths[idx] ?? 36, Math.max(...cells.map((cell) => cell.length)))
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
