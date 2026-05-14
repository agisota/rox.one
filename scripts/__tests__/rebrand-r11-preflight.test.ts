import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

import {
  collectR11PreflightSnapshot,
  evaluateR11Preflight,
  formatR11PreflightReport,
  type R11PreflightSnapshot,
} from '../rebrand-r11-preflight'

const repoRoot = join(import.meta.dir, '..', '..')

function passingSnapshot(
  overrides: Partial<R11PreflightSnapshot> = {},
): R11PreflightSnapshot {
  return {
    noActiveGoalAcknowledged: true,
    openPullRequests: [],
    forkCount: 0,
    expectedForkCount: 0,
    rebrandPhaseCloseoutIssues: [],
    masterPhase1CloseoutDone: true,
    masterPhase2CloseoutDone: true,
    rebrandTagPresent: true,
    rebrandTagLocalMatchesRemote: true,
    rebrandTagOnMain: true,
    mainCommit: '1111111111111111111111111111111111111111',
    backupTagPresent: true,
    backupTagCommit: '1111111111111111111111111111111111111111',
    backupTagMatchesMain: true,
    backupBranchPresent: true,
    backupBranchCommit: '1111111111111111111111111111111111111111',
    backupBranchMatchesMain: true,
    offlineMirrorPresent: true,
    offlineMirrorMainCommit: '1111111111111111111111111111111111111111',
    offlineMirrorMatchesMain: true,
    staleRemoteBranches: [],
    currentBranch: 'main',
    currentBranchIsMain: true,
    gitFilterRepoPresent: true,
    r11CloseoutTicketPresent: true,
    r11CloseoutWorklogPresent: true,
    mainSyncedWithOrigin: true,
    worktreeClean: true,
    ...overrides,
  }
}

describe('evaluateR11Preflight', () => {
  test('pre-backup stage does not require backup artifacts before they can be created', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      backupTagPresent: false,
      backupTagMatchesMain: false,
      backupBranchPresent: false,
      backupBranchMatchesMain: false,
      offlineMirrorPresent: false,
      offlineMirrorMatchesMain: false,
    }))

    expect(report.allPassed).toBe(true)
    expect(report.results.some((result) => result.id === 'backup-tag')).toBe(false)
    expect(report.results.some((result) => result.id === 'backup-tag-target')).toBe(false)
    expect(report.results.some((result) => result.id === 'backup-branch')).toBe(false)
    expect(report.results.some((result) => result.id === 'backup-branch-target')).toBe(false)
    expect(report.results.some((result) => result.id === 'offline-mirror')).toBe(false)
    expect(report.results.some((result) => result.id === 'offline-mirror-target')).toBe(false)
  })

  test('pre-rewrite stage requires backup artifacts before filter-repo', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      backupTagPresent: false,
      backupBranchPresent: false,
      offlineMirrorPresent: false,
    }), { stage: 'pre-rewrite' })

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'backup-tag'))
      .toMatchObject({ passed: false })
    expect(report.results.find((result) => result.id === 'backup-branch'))
      .toMatchObject({ passed: false })
    expect(report.results.find((result) => result.id === 'offline-mirror'))
      .toMatchObject({ passed: false })
    expect(report.results.some((result) => result.id === 'backup-tag-target')).toBe(false)
    expect(report.results.some((result) => result.id === 'backup-branch-target')).toBe(false)
    expect(report.results.some((result) => result.id === 'offline-mirror-target')).toBe(false)
  })

  test('pre-rewrite stage requires the backup branch before filter-repo', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      backupBranchPresent: false,
    }), { stage: 'pre-rewrite' })

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'backup-branch'))
      .toMatchObject({ passed: false })
  })

  test('pre-rewrite stage fails when the backup tag target differs from main', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      mainCommit: '1111111111111111111111111111111111111111',
      backupTagCommit: '2222222222222222222222222222222222222222',
      backupTagMatchesMain: false,
    }), { stage: 'pre-rewrite' })
    const target = report.results.find((result) => result.id === 'backup-tag-target')
    const targetDetail = String(target?.detail ?? '')

    expect(report.allPassed).toBe(false)
    expect(target)
      .toMatchObject({
        passed: false,
        detail: expect.stringContaining('2222222222222222222222222222222222222222'),
      })
    expect(targetDetail.includes('1111111111111111111111111111111111111111'))
      .toBe(true)
  })

  test('pre-rewrite stage fails when the backup branch target differs from main', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      mainCommit: '1111111111111111111111111111111111111111',
      backupBranchCommit: '3333333333333333333333333333333333333333',
      backupBranchMatchesMain: false,
    }), { stage: 'pre-rewrite' })
    const target = report.results.find((result) => result.id === 'backup-branch-target')
    const targetDetail = String(target?.detail ?? '')

    expect(report.allPassed).toBe(false)
    expect(target)
      .toMatchObject({
        passed: false,
        detail: expect.stringContaining('3333333333333333333333333333333333333333'),
      })
    expect(targetDetail.includes('1111111111111111111111111111111111111111'))
      .toBe(true)
  })

  test('pre-rewrite stage fails when the offline mirror main target differs from main', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      mainCommit: '1111111111111111111111111111111111111111',
      offlineMirrorMainCommit: '4444444444444444444444444444444444444444',
      offlineMirrorMatchesMain: false,
    }), { stage: 'pre-rewrite' })
    const target = report.results.find((result) => result.id === 'offline-mirror-target')
    const targetDetail = String(target?.detail ?? '')

    expect(report.allPassed).toBe(false)
    expect(target)
      .toMatchObject({
        passed: false,
        detail: expect.stringContaining('4444444444444444444444444444444444444444'),
      })
    expect(targetDetail.includes('1111111111111111111111111111111111111111'))
      .toBe(true)
  })

  test('pre-backup stage does not require stale remote branch cleanup before backups exist', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      staleRemoteBranches: ['chore/rebrand-R10-final-sweep-and-gate'],
    }))

    expect(report.allPassed).toBe(true)
    expect(report.results.some((result) => result.id === 'remote-branch-review')).toBe(false)
  })

  test('pre-rewrite stage fails closed while stale origin branches remain', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      staleRemoteBranches: [
        'chore/rebrand-R10-final-sweep-and-gate',
        'feat/M2-rbac-foundation',
      ],
    }), { stage: 'pre-rewrite' })

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'remote-branch-review'))
      .toMatchObject({
        passed: false,
        detail: expect.stringContaining('chore/rebrand-R10-final-sweep-and-gate'),
      })
  })

  test('pre-rewrite stage passes only when every destructive R.11 prerequisite is true', () => {
    const report = evaluateR11Preflight(passingSnapshot(), { stage: 'pre-rewrite' })

    expect(report.allPassed).toBe(true)
    expect(report.results.every((result) => result.passed)).toBe(true)
  })

  test('fails closed when the no-active-goal acknowledgement is missing', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      noActiveGoalAcknowledged: false,
    }))

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'no-active-goal'))
      .toMatchObject({ passed: false })
  })

  test('fails closed when the current checkout is not main', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      currentBranch: 'chore/rebrand-R10-final-sweep-and-gate',
      currentBranchIsMain: false,
    }))

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'current-branch'))
      .toMatchObject({
        passed: false,
        detail: expect.stringContaining('chore/rebrand-R10-final-sweep-and-gate'),
      })
  })

  test('fails closed when the exact R.11 closeout worklog is missing', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      r11CloseoutWorklogPresent: false,
    }))

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'r11-closeout-worklog'))
      .toMatchObject({ passed: false })
  })

  test('fails closed when the fork count does not match the expected count', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      forkCount: 2,
    }))

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'fork-review'))
      .toMatchObject({ passed: false })
  })

  test('fails closed when the rebrand-v1 tag target is not on origin main', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      rebrandTagOnMain: false,
    }))

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'rebrand-tag-on-main'))
      .toMatchObject({ passed: false })
  })

  test('fails closed when the local rebrand-v1 tag target differs from origin', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      rebrandTagLocalMatchesRemote: false,
      rebrandTagRemoteCommit: 'b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99',
      rebrandTagLocalCommit: '906896e145156d92cf98457c4dc1893c53323bac',
    }))
    const localSync = report.results.find((result) => result.id === 'rebrand-tag-local-sync')
    const localSyncDetail = String(localSync?.detail ?? '')

    expect(report.allPassed).toBe(false)
    expect(localSync)
      .toMatchObject({
        passed: false,
        detail: expect.stringContaining('local 906896e145156d92cf98457c4dc1893c53323bac'),
      })
    expect(localSyncDetail.includes(
      'origin b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99',
    )).toBe(true)
  })

  test('reports the origin rebrand-v1 target when it is missing from origin main ancestry', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      rebrandTagOnMain: false,
      rebrandTagRemoteCommit: 'b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99',
    }))

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'rebrand-tag-on-main'))
      .toMatchObject({
        passed: false,
        detail: expect.stringContaining('b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99'),
      })
  })

  test('keeps tag target evidence visible in the formatted preflight report', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      rebrandTagLocalMatchesRemote: false,
      rebrandTagOnMain: false,
      rebrandTagRemoteCommit: 'b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99',
      rebrandTagLocalCommit: '906896e145156d92cf98457c4dc1893c53323bac',
    }))
    const formatted = formatR11PreflightReport(report)

    expect(formatted).toContain('906896e145156d92cf98457c4dc1893c53323bac')
    expect(formatted).toContain('b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99')
  })

  test('fails closed when rebrand and roadmap closeout prerequisites are incomplete', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      rebrandPhaseCloseoutIssues: [
        'docs/tickets/T263-rebrand-surface-text-completion.md is not Status: DONE',
      ],
      masterPhase1CloseoutDone: false,
      masterPhase2CloseoutDone: false,
    }))

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'rebrand-closeouts'))
      .toMatchObject({ passed: false })
    expect(report.results.find((result) => result.id === 'phase1-closeout'))
      .toMatchObject({ passed: false })
    expect(report.results.find((result) => result.id === 'phase2-rbac-closeout'))
      .toMatchObject({ passed: false })
  })

  test('reports every blocker instead of stopping after the first red check', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      noActiveGoalAcknowledged: false,
      openPullRequests: [
        { number: 189, title: 'route boundary', headRefName: 'feature-a' },
        { number: 171, title: 'csp cleanup', headRefName: 'feature-b' },
      ],
      forkCount: 2,
      expectedForkCount: 0,
      rebrandPhaseCloseoutIssues: [
        'docs/tickets/T260-rebrand-canonical-decision-adr.md is missing',
      ],
      masterPhase1CloseoutDone: false,
      masterPhase2CloseoutDone: false,
      rebrandTagPresent: false,
      rebrandTagLocalMatchesRemote: false,
      rebrandTagOnMain: false,
      backupTagPresent: false,
      backupBranchPresent: false,
      offlineMirrorPresent: false,
      currentBranch: 'feature/not-main',
      currentBranchIsMain: false,
      gitFilterRepoPresent: false,
      r11CloseoutTicketPresent: false,
      r11CloseoutWorklogPresent: false,
      mainSyncedWithOrigin: false,
      worktreeClean: false,
    }))

    expect(report.allPassed).toBe(false)
    expect(report.results.filter((result) => !result.passed)).toHaveLength(15)
    expect(formatR11PreflightReport(report)).toContain('#189')
    expect(formatR11PreflightReport(report)).toContain('current-branch')
    expect(formatR11PreflightReport(report)).toContain('fork-review')
    expect(formatR11PreflightReport(report)).toContain('rebrand-closeouts')
    expect(formatR11PreflightReport(report)).toContain('rebrand-tag-local-sync')
    expect(formatR11PreflightReport(report)).toContain('rebrand-tag-on-main')
    expect(formatR11PreflightReport(report)).toContain('phase2-rbac-closeout')
    expect(formatR11PreflightReport(report)).toContain('r11-closeout-worklog')
    expect(formatR11PreflightReport(report)).toContain('red')
  })
})

describe('collectR11PreflightSnapshot', () => {
  test('collects backup branch commit evidence without crashing', () => {
    const snapshot = collectR11PreflightSnapshot(repoRoot)

    expect(typeof snapshot.backupBranchPresent).toBe('boolean')
    expect(
      snapshot.backupBranchCommit === undefined
      || typeof snapshot.backupBranchCommit === 'string',
    ).toBe(true)
  }, 15_000)
})

describe('R.11 goal documentation', () => {
  test('points operators at the executable report-only preflight runner', () => {
    const goal = readFileSync(
      join(
        repoRoot,
        'docs',
        'superpowers',
        'goals',
        '2026-05-13-rox-one-rebrand-sweep-goal.md',
      ),
      'utf8',
    )

    expect(goal).toContain('bun run rebrand:r11-preflight')
    expect(goal).toContain('bun run rebrand:r11-preflight --stage pre-rewrite')
    expect(goal).toContain('report-only')
  })

  test('uses the current checkout path in R.11 mirror and rollback snippets', () => {
    const goal = readFileSync(
      join(
        repoRoot,
        'docs',
        'superpowers',
        'goals',
        '2026-05-13-rox-one-rebrand-sweep-goal.md',
      ),
      'utf8',
    )

    expect(goal).toContain('file:///home/dev/craft/rox-one-terminal')
    expect(goal).toContain('cd /home/dev/craft/rox-one-terminal')
    expect(goal).not.toContain('/home/dev/rox/rox-one-terminal')
  })

  test('documents the tag-target prerequisites enforced by the preflight runner', () => {
    const goal = readFileSync(
      join(
        repoRoot,
        'docs',
        'superpowers',
        'goals',
        '2026-05-13-rox-one-rebrand-sweep-goal.md',
      ),
      'utf8',
    )
    const spine = readFileSync(
      join(
        repoRoot,
        'docs',
        'superpowers',
        'goals',
        '2026-05-13-rox-one-v1-end-to-end-spine-goal.md',
      ),
      'utf8',
    )

    expect(goal).toContain('origin `rebrand-v1` target is on `origin/main` ancestry')
    expect(goal).toContain("local `rebrand-v1` tag target matches origin's `rebrand-v1` target")
    expect(spine).not.toContain('R.11 has nine hard prerequisites')
    expect(spine).toContain('R.11 has hard prerequisites')
  })

  test('documents every backup artifact enforced by the pre-rewrite gate', () => {
    const goal = readFileSync(
      join(
        repoRoot,
        'docs',
        'superpowers',
        'goals',
        '2026-05-13-rox-one-rebrand-sweep-goal.md',
      ),
      'utf8',
    )

    expect(goal).toContain(
      'The backup tag, backup branch, and offline mirror must **all** exist before any filter-repo invocation.',
    )
    expect(goal).toContain('backup/pre-rebrand-history-rewrite-2026-05-13')
    expect(goal).toContain('bun run rebrand:r11-preflight --stage pre-rewrite')
  })

  test('documents backup target checks enforced by the pre-rewrite gate', () => {
    const goal = readFileSync(
      join(
        repoRoot,
        'docs',
        'superpowers',
        'goals',
        '2026-05-13-rox-one-rebrand-sweep-goal.md',
      ),
      'utf8',
    )

    expect(goal).toContain('backup tag and backup branch targets must match `main`')
    expect(goal).toContain('backup-tag-target')
    expect(goal).toContain('backup-branch-target')
  })

  test('documents offline mirror target checks enforced by the pre-rewrite gate', () => {
    const goal = readFileSync(
      join(
        repoRoot,
        'docs',
        'superpowers',
        'goals',
        '2026-05-13-rox-one-rebrand-sweep-goal.md',
      ),
      'utf8',
    )

    expect(goal).toContain('offline mirror `main` target must match `main`')
    expect(goal).toContain('offline-mirror-target')
  })

  test('includes the backup branch in R.11 stopping conditions', () => {
    const goal = readFileSync(
      join(
        repoRoot,
        'docs',
        'superpowers',
        'goals',
        '2026-05-13-rox-one-rebrand-sweep-goal.md',
      ),
      'utf8',
    )

    expect(goal).toContain('- Backup tag, backup branch, and backup mirror all exist;')
    expect(goal).toContain(
      '`pre-rebrand-history-rewrite-backup` tag and `backup/pre-rebrand-history-rewrite-2026-05-13` branch exist on `origin`',
    )
  })
})

describe('R.11 closeout worklog documentation', () => {
  test('includes the R.9.5 suffixed tickets in closeout preflight coverage', () => {
    const preflightSource = readFileSync(
      join(repoRoot, 'scripts', 'rebrand-r11-preflight.ts'),
      'utf8',
    )

    expect(preflightSource).toContain('docs/tickets/T298a-rebrand-allowlist-expansion.md')
    expect(preflightSource).toContain('docs/tickets/T300a-rebrand-agents-md-and-misc.md')
    expect(preflightSource).not.toContain('docs/tickets/T299a')
  })

  test('keeps R.9.5 suffixed tickets in the standard ticket and worklog shape', () => {
    for (const slug of [
      'T298a-rebrand-allowlist-expansion',
      'T300a-rebrand-agents-md-and-misc',
    ]) {
      const ticketPath = join(repoRoot, 'docs', 'tickets', `${slug}.md`)
      const worklogPath = join(repoRoot, 'docs', 'worklog', `${slug}.md`)

      expect(existsSync(ticketPath)).toBe(true)
      expect(existsSync(worklogPath)).toBe(true)

      const ticket = readFileSync(ticketPath, 'utf8')
      const worklog = readFileSync(worklogPath, 'utf8')

      expect(ticket).toMatch(/^Status:\s*DONE\b/m)
      for (let section = 1; section <= 11; section += 1) {
        expect(worklog).toContain(`## ${section}.`)
      }
      expect(worklog).toContain('Acceptance criteria matrix')
    }
  })

  test('keeps the R.9.5 roadmap ledger aligned with actual suffixed tickets', () => {
    const roadmap = readFileSync(
      join(repoRoot, '.swarm', 'master-roadmap-log.md'),
      'utf8',
    )
    const r95Line = roadmap
      .split('\n')
      .find((line) => line.startsWith('rebrand-R.9.5-allowlist-and-final-text |'))

    expect(r95Line).toBe(
      'rebrand-R.9.5-allowlist-and-final-text | b8d6abd | T298a,T300a | 2026-05-13T18:09:00Z',
    )
    expect(r95Line).not.toContain('T299a')
  })

  test('points current evidence at the durable completion audit instead of drifting ticket ranges', () => {
    const worklog = readFileSync(
      join(repoRoot, 'docs', 'worklog', 'T298-rebrand-git-history-rewrite.md'),
      'utf8',
    )

    expect(worklog).toContain('docs/release/r11-completion-audit-2026-05-14.md')
    expect(worklog).toContain('docs/release/r11-current-main-validation-2026-05-14.md')
    expect(worklog).toContain('T429 full-matrix snapshot')
    expect(worklog).toContain('later audit-hygiene tickets carry their own fresh targeted validation evidence')
    expect(worklog).toContain('6753 pass, 13 skip, 0 fail')
    expect(worklog).toContain('GitHub reports 1 fork(s); expected 0')
    expect(worklog).toContain('T409 and later audit-hygiene tickets')
    expect(worklog).not.toContain('after T402')
    expect(worklog).not.toContain('T375 through T408')
    expect(worklog).not.toContain('T409-T412')
    expect(worklog).not.toContain('GitHub fork count is `0`')
  })

  test('points current evidence at the latest report-only audit chain', () => {
    const worklog = readFileSync(
      join(repoRoot, 'docs', 'worklog', 'T298-rebrand-git-history-rewrite.md'),
      'utf8',
    )
    const worklogHeader = worklog.split('## 1. Task summary')[0] ?? ''

    expect(worklog).toContain('T439')
    expect(worklog).toContain('T441')
    expect(worklog).toContain('T442')
    expect(worklog).toContain('docs/release/r11-completion-audit-2026-05-14.md')
    expect(worklog).toContain('docs/release/rebrand-mapping-2026-05-13.md')
    expect(worklog).toContain(
      'validate:roadmap OK — 46 phases, 110 tickets across detail files, 14 rebrand master-roadmap log rows',
    )
    expect(worklog).toContain('BLOCKED - pending destructive rewrite closeout SHA')
    expect(worklogHeader).toContain('Status: BLOCKED')
    expect(worklogHeader).not.toContain('Status: DONE')
  })

  test('keeps T298 backup artifact instructions aligned with target guard rows', () => {
    const ticket = readFileSync(
      join(repoRoot, 'docs', 'tickets', 'T298-rebrand-git-history-rewrite.md'),
      'utf8',
    )
    const worklog = readFileSync(
      join(repoRoot, 'docs', 'worklog', 'T298-rebrand-git-history-rewrite.md'),
      'utf8',
    )
    const worklogHeader = worklog.split('## 1. Task summary')[0] ?? ''

    for (const targetGuard of [
      'backup-tag-target',
      'backup-branch-target',
      'offline-mirror-target',
    ]) {
      expect(ticket).toContain(targetGuard)
      expect(worklog).toContain(targetGuard)
    }

    expect(ticket).toContain('current `main`')
    expect(worklog).toContain('not emitted while the corresponding artifact is missing')
    expect(worklogHeader).toContain('Status: BLOCKED')
    expect(worklogHeader).not.toContain('Status: DONE')
  })
})
