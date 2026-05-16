import { describe, expect, test } from 'bun:test'

import {
  collectHistoryFindingsFromText,
  formatHistoryScanReport,
  isHistoryPathAllowlisted,
} from '../rebrand-r11-history-scan'

const legacyStem = 'cr' + 'aft'
const legacyPackage = `${legacyStem}-agent`
const legacyHome = `~/.${legacyStem}`
const legacyProduct = 'Craft' + ' Agent'

describe('isHistoryPathAllowlisted', () => {
  test('allows legal-preserve attribution and historical documentation paths', () => {
    expect(isHistoryPathAllowlisted('LICENSE')).toBe(true)
    expect(isHistoryPathAllowlisted('NOTICE')).toBe(true)
    expect(isHistoryPathAllowlisted('TRADEMARK.md')).toBe(true)
    expect(isHistoryPathAllowlisted('docs/decision-records/0011-example.md')).toBe(true)
    expect(isHistoryPathAllowlisted('docs/worklog/T298-rebrand-git-history-rewrite.md')).toBe(true)
    expect(isHistoryPathAllowlisted('apps/electron/resources/release-notes/0.1.0.md')).toBe(true)
    expect(isHistoryPathAllowlisted('scripts/rebrand-r11-history-scan.ts')).toBe(true)
    expect(isHistoryPathAllowlisted('scripts/__tests__/rebrand-r11-history-scan.test.ts')).toBe(true)
  })

  test('does not allow ordinary runtime paths', () => {
    expect(isHistoryPathAllowlisted('packages/shared/src/config/paths.ts')).toBe(false)
  })
})

describe('collectHistoryFindingsFromText', () => {
  test('records forbidden-token patch lines outside the allowlist', () => {
    const findings = collectHistoryFindingsFromText([
      'commit abc1234',
      'diff --git a/packages/shared/src/config/paths.ts b/packages/shared/src/config/paths.ts',
      '--- a/packages/shared/src/config/paths.ts',
      '+++ b/packages/shared/src/config/paths.ts',
      `+const legacyConfigDir = "${legacyHome}"`,
    ].join('\n'))

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      commit: 'abc1234',
      path: 'packages/shared/src/config/paths.ts',
      token: legacyHome,
    })
  })

  test('ignores forbidden-token patch lines on legal-preserve paths', () => {
    const findings = collectHistoryFindingsFromText([
      'commit abc1234',
      'diff --git a/LICENSE b/LICENSE',
      '--- a/LICENSE',
      '+++ b/LICENSE',
      `+This license text mentions ${legacyPackage} for attribution.`,
    ].join('\n'))

    expect(findings).toHaveLength(0)
  })

  test('honors maxFindings while reporting that results were truncated', () => {
    const findings = collectHistoryFindingsFromText([
      'commit abc1234',
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      `+const one = "${legacyPackage}"`,
      `+const two = "${legacyProduct}"`,
    ].join('\n'), { maxFindings: 1 })

    expect(findings).toHaveLength(1)
    expect(findings.truncated).toBe(true)
  })
})

describe('formatHistoryScanReport', () => {
  test('renders a red summary with commit, path, and token evidence', () => {
    const findings = collectHistoryFindingsFromText([
      'commit abc1234',
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      `+const one = "${legacyPackage}"`,
    ].join('\n'))

    const report = formatHistoryScanReport(findings)

    expect(report).toContain('red')
    expect(report).toContain('abc1234')
    expect(report).toContain('src/a.ts')
    expect(report).toContain(legacyPackage)
  })
})
