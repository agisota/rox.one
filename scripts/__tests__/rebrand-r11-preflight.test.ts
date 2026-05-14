import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

import {
  evaluateR11Preflight,
  formatR11PreflightReport,
} from '../rebrand-r11-preflight'

const repoRoot = join(import.meta.dir, '..', '..')

describe('evaluateR11Preflight', () => {
  test('pre-backup stage does not require backup artifacts before they can be created', () => {
    const report = evaluateR11Preflight({
      noActiveGoalAcknowledged: true,
      openPullRequests: [],
      rebrandTagPresent: true,
      backupTagPresent: false,
      offlineMirrorPresent: false,
      gitFilterRepoPresent: true,
      r11CloseoutTicketPresent: true,
      r11CloseoutWorklogPresent: true,
      mainSyncedWithOrigin: true,
      worktreeClean: true,
    })

    expect(report.allPassed).toBe(true)
    expect(report.results.some((result) => result.id === 'backup-tag')).toBe(false)
    expect(report.results.some((result) => result.id === 'offline-mirror')).toBe(false)
  })

  test('pre-rewrite stage requires backup artifacts before filter-repo', () => {
    const report = evaluateR11Preflight({
      noActiveGoalAcknowledged: true,
      openPullRequests: [],
      rebrandTagPresent: true,
      backupTagPresent: false,
      offlineMirrorPresent: false,
      gitFilterRepoPresent: true,
      r11CloseoutTicketPresent: true,
      r11CloseoutWorklogPresent: true,
      mainSyncedWithOrigin: true,
      worktreeClean: true,
    }, { stage: 'pre-rewrite' })

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'backup-tag'))
      .toMatchObject({ passed: false })
    expect(report.results.find((result) => result.id === 'offline-mirror'))
      .toMatchObject({ passed: false })
  })

  test('pre-rewrite stage passes only when every destructive R.11 prerequisite is true', () => {
    const report = evaluateR11Preflight({
      noActiveGoalAcknowledged: true,
      openPullRequests: [],
      rebrandTagPresent: true,
      backupTagPresent: true,
      offlineMirrorPresent: true,
      gitFilterRepoPresent: true,
      r11CloseoutTicketPresent: true,
      r11CloseoutWorklogPresent: true,
      mainSyncedWithOrigin: true,
      worktreeClean: true,
    }, { stage: 'pre-rewrite' })

    expect(report.allPassed).toBe(true)
    expect(report.results.every((result) => result.passed)).toBe(true)
  })

  test('fails closed when the no-active-goal acknowledgement is missing', () => {
    const report = evaluateR11Preflight({
      noActiveGoalAcknowledged: false,
      openPullRequests: [],
      rebrandTagPresent: true,
      backupTagPresent: true,
      offlineMirrorPresent: true,
      gitFilterRepoPresent: true,
      r11CloseoutTicketPresent: true,
      r11CloseoutWorklogPresent: true,
      mainSyncedWithOrigin: true,
      worktreeClean: true,
    })

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'no-active-goal'))
      .toMatchObject({ passed: false })
  })

  test('fails closed when the exact R.11 closeout worklog is missing', () => {
    const report = evaluateR11Preflight({
      noActiveGoalAcknowledged: true,
      openPullRequests: [],
      rebrandTagPresent: true,
      backupTagPresent: true,
      offlineMirrorPresent: true,
      gitFilterRepoPresent: true,
      r11CloseoutTicketPresent: true,
      r11CloseoutWorklogPresent: false,
      mainSyncedWithOrigin: true,
      worktreeClean: true,
    })

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'r11-closeout-worklog'))
      .toMatchObject({ passed: false })
  })

  test('reports every blocker instead of stopping after the first red check', () => {
    const report = evaluateR11Preflight({
      noActiveGoalAcknowledged: false,
      openPullRequests: [
        { number: 189, title: 'route boundary', headRefName: 'feature-a' },
        { number: 171, title: 'csp cleanup', headRefName: 'feature-b' },
      ],
      rebrandTagPresent: false,
      backupTagPresent: false,
      offlineMirrorPresent: false,
      gitFilterRepoPresent: false,
      r11CloseoutTicketPresent: false,
      r11CloseoutWorklogPresent: false,
      mainSyncedWithOrigin: false,
      worktreeClean: false,
    })

    expect(report.allPassed).toBe(false)
    expect(report.results.filter((result) => !result.passed)).toHaveLength(8)
    expect(formatR11PreflightReport(report)).toContain('#189')
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
})
