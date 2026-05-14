import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

import {
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
    backupTagPresent: true,
    backupBranchPresent: true,
    offlineMirrorPresent: true,
    staleRemoteBranches: [],
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
      backupBranchPresent: false,
      offlineMirrorPresent: false,
    }))

    expect(report.allPassed).toBe(true)
    expect(report.results.some((result) => result.id === 'backup-tag')).toBe(false)
    expect(report.results.some((result) => result.id === 'backup-branch')).toBe(false)
    expect(report.results.some((result) => result.id === 'offline-mirror')).toBe(false)
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
  })

  test('pre-rewrite stage requires the backup branch before filter-repo', () => {
    const report = evaluateR11Preflight(passingSnapshot({
      backupBranchPresent: false,
    }), { stage: 'pre-rewrite' })

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'backup-branch'))
      .toMatchObject({ passed: false })
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
      gitFilterRepoPresent: false,
      r11CloseoutTicketPresent: false,
      r11CloseoutWorklogPresent: false,
      mainSyncedWithOrigin: false,
      worktreeClean: false,
    }))

    expect(report.allPassed).toBe(false)
    expect(report.results.filter((result) => !result.passed)).toHaveLength(14)
    expect(formatR11PreflightReport(report)).toContain('#189')
    expect(formatR11PreflightReport(report)).toContain('fork-review')
    expect(formatR11PreflightReport(report)).toContain('rebrand-closeouts')
    expect(formatR11PreflightReport(report)).toContain('rebrand-tag-local-sync')
    expect(formatR11PreflightReport(report)).toContain('rebrand-tag-on-main')
    expect(formatR11PreflightReport(report)).toContain('phase2-rbac-closeout')
    expect(formatR11PreflightReport(report)).toContain('r11-closeout-worklog')
    expect(formatR11PreflightReport(report)).toContain('red')
  })
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

    expect(goal).toContain('- Backup tag, backup branch, and backup mirror all exist.')
    expect(goal).toContain(
      '`pre-rebrand-history-rewrite-backup` tag and `backup/pre-rebrand-history-rewrite-2026-05-13` branch exist on `origin`',
    )
  })
})

describe('R.11 closeout worklog documentation', () => {
  test('points current evidence at the durable completion audit instead of a stale ticket range', () => {
    const worklog = readFileSync(
      join(repoRoot, 'docs', 'worklog', 'T298-rebrand-git-history-rewrite.md'),
      'utf8',
    )

    expect(worklog).toContain('docs/release/r11-completion-audit-2026-05-14.md')
    expect(worklog).toContain('T409-T412')
    expect(worklog).not.toContain('after T402')
    expect(worklog).not.toContain('T375 through T408')
  })
})
