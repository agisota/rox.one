import { describe, expect, test } from 'bun:test'

import {
  evaluateLegalPreserveSnapshot,
  formatLegalPreserveReport,
  type LegalPreserveSnapshot,
} from '../rebrand-r11-legal-preserve'

function passingSnapshot(
  overrides: Partial<LegalPreserveSnapshot> = {},
): LegalPreserveSnapshot {
  const sourceRepo = 'rox' + '-agents-oss'
  return {
    files: {
      LICENSE: { before: 'license text', after: 'license text' },
      NOTICE: { before: 'notice text', after: 'notice text' },
      'TRADEMARK.md': { before: 'trademark text', after: 'trademark text' },
    },
    dockerfile: `LABEL org.opencontainers.image.source="https://github.com/lukilabs/${sourceRepo}"`,
    ...overrides,
  }
}

describe('evaluateLegalPreserveSnapshot', () => {
  test('passes when legal files match and Dockerfile attribution is intact', () => {
    const report = evaluateLegalPreserveSnapshot(passingSnapshot())

    expect(report.allPassed).toBe(true)
    expect(report.results.every((result) => result.passed)).toBe(true)
  })

  test('fails when a legal preserve file drifts', () => {
    const report = evaluateLegalPreserveSnapshot(passingSnapshot({
      files: {
        LICENSE: { before: 'license text', after: 'changed license text' },
        NOTICE: { before: 'notice text', after: 'notice text' },
        'TRADEMARK.md': { before: 'trademark text', after: 'trademark text' },
      },
    }))

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'legal-file-LICENSE'))
      .toMatchObject({ passed: false })
  })

  test('fails closed when backup content is missing', () => {
    const report = evaluateLegalPreserveSnapshot(passingSnapshot({
      files: {
        LICENSE: { beforeError: 'missing backup tag', after: 'license text' },
        NOTICE: { before: 'notice text', after: 'notice text' },
        'TRADEMARK.md': { before: 'trademark text', after: 'trademark text' },
      },
    }))

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'legal-file-LICENSE')?.detail)
      .toContain('missing backup tag')
  })

  test('fails when Dockerfile source attribution is missing', () => {
    const report = evaluateLegalPreserveSnapshot(passingSnapshot({
      dockerfile: 'LABEL org.opencontainers.image.source="https://example.invalid/rewrite"',
    }))

    expect(report.allPassed).toBe(false)
    expect(report.results.find((result) => result.id === 'dockerfile-source-attribution'))
      .toMatchObject({ passed: false })
  })
})

describe('formatLegalPreserveReport', () => {
  test('renders failed rows with useful detail', () => {
    const report = evaluateLegalPreserveSnapshot(passingSnapshot({
      dockerfile: 'no attribution here',
    }))
    const formatted = formatLegalPreserveReport(report)

    expect(formatted).toContain('red')
    expect(formatted).toContain('dockerfile-source-attribution')
  })
})
