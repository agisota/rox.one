/**
 * Tests for `maskEmail` — keep PII out of logs while preserving
 * enough signal (domain) to triage incidents.
 */

import { describe, expect, it } from 'bun:test'
import { maskEmail } from '../logging-helpers'

describe('maskEmail', () => {
  it('keeps the first local-part character and the full domain', () => {
    expect(maskEmail('alice@example.com')).toBe('a***@example.com')
  })

  it('does not leak more than one local-part character even for short addresses', () => {
    expect(maskEmail('a@example.com')).toBe('a***@example.com')
  })

  it('preserves multi-label domains for triage', () => {
    expect(maskEmail('engineer@team.eng.example.co.uk')).toBe('e***@team.eng.example.co.uk')
  })

  it('redacts entirely when the input has no @', () => {
    expect(maskEmail('not-an-email')).toBe('[redacted-email]')
  })

  it('redacts entirely when the local-part is empty', () => {
    expect(maskEmail('@example.com')).toBe('[redacted-email]')
  })

  it('redacts entirely when the domain is empty', () => {
    expect(maskEmail('alice@')).toBe('[redacted-email]')
  })

  it('redacts null / undefined / empty inputs without throwing', () => {
    expect(maskEmail(null)).toBe('[redacted-email]')
    expect(maskEmail(undefined)).toBe('[redacted-email]')
    expect(maskEmail('')).toBe('[redacted-email]')
  })
})
