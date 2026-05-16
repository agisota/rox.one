import { describe, expect, test } from 'bun:test'

import {
  ROX_ACCOUNT_DOMAIN,
  ROX_SIGNUP_BONUS_UNITS,
  normalizeRoxUsername,
  roxUsernameToEmail,
  isValidRoxUsername,
} from '../index'

describe('ROX account username helpers', () => {
  test('normalizes handles and derives the canonical rox.one address', () => {
    expect(ROX_ACCOUNT_DOMAIN).toBe('rox.one')
    expect(normalizeRoxUsername('  @Release_User  ')).toBe('release_user')
    expect(roxUsernameToEmail('Release_User')).toBe('release_user@rox.one')
  })

  test('accepts stable username characters and rejects ambiguous handles', () => {
    expect(isValidRoxUsername('release_user')).toBe(true)
    expect(isValidRoxUsername('release-user')).toBe(true)
    expect(isValidRoxUsername('release.user')).toBe(true)
    expect(isValidRoxUsername('ab')).toBe(false)
    expect(isValidRoxUsername('-release')).toBe(false)
    expect(isValidRoxUsername('release-')).toBe(false)
    expect(isValidRoxUsername('release user')).toBe(false)
  })

  test('defines the default starter balance as 10 USDT in ledger units', () => {
    expect(ROX_SIGNUP_BONUS_UNITS).toBe(10_000_000)
  })
})
