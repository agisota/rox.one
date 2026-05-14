import { describe, expect, test } from 'bun:test'

import {
  evaluateR11Preflight,
  formatR11PreflightReport,
} from '../rebrand-r11-preflight'

describe('evaluateR11Preflight', () => {
  test('passes only when every destructive R.11 prerequisite is true', () => {
    const report = evaluateR11Preflight({
      noActiveGoalAcknowledged: true,
      openPullRequests: [],
      rebrandTagPresent: true,
      backupTagPresent: true,
      offlineMirrorPresent: true,
      gitFilterRepoPresent: true,
      r11CloseoutTicketPresent: true,
      mainSyncedWithOrigin: true,
      worktreeClean: true,
    })

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
      mainSyncedWithOrigin: true,
      worktreeClean: true,
    })

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'no-active-goal'))
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
      mainSyncedWithOrigin: false,
      worktreeClean: false,
    })

    expect(report.allPassed).toBe(false)
    expect(report.results.filter((result) => !result.passed)).toHaveLength(9)
    expect(formatR11PreflightReport(report)).toContain('#189')
    expect(formatR11PreflightReport(report)).toContain('red')
  })
})
