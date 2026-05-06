import { describe, expect, test } from 'bun:test'

import {
  getAccountAuthRefreshFailureMessage,
  getAccountAuthSuccessMessage,
  getConfirmedAccountCabinetError,
} from '../account-auth-feedback'

describe('account auth feedback', () => {
  const confirmedAccount = {
    mode: 'account',
    user: { id: 'user-test-1', email: 'user@example.com' },
    currentSessionId: 'session-test-1',
  }

  test('shows sign-in success only after account refresh returns a user', () => {
    expect(getAccountAuthSuccessMessage('sign-in', true)).toBe('Вход выполнен. Кабинет обновлен.')
    expect(getAccountAuthSuccessMessage('sign-in', false)).toBeNull()
  })

  test('shows registration success only after account refresh returns a user', () => {
    expect(getAccountAuthSuccessMessage('register', true)).toBe('Аккаунт создан. Кабинет обновлен.')
    expect(getAccountAuthSuccessMessage('register', false)).toBeNull()
  })

  test('does not surface stale auth errors after account refresh confirms a user', () => {
    const hasConfirmedUser = confirmedAccount.mode === 'account' && Boolean(confirmedAccount.user)

    expect(getConfirmedAccountCabinetError('Authentication required', hasConfirmedUser)).toBeNull()
    expect(getConfirmedAccountCabinetError('Unauthorized', hasConfirmedUser)).toBeNull()
    expect(getConfirmedAccountCabinetError('Team spaces are not available', true)).toBe('Team spaces are not available')
    expect(getConfirmedAccountCabinetError('Authentication required', false)).toBe('Authentication required')
  })

  test('replaces stale auth text after an accepted login waits for session refresh', () => {
    expect(getAccountAuthRefreshFailureMessage('Authentication required')).toBe(
      'Вход принят, но кабинет еще не подтвердил активную сессию. Обновите кабинет или войдите заново.',
    )
    expect(getAccountAuthRefreshFailureMessage('Profile endpoint unavailable')).toBe('Profile endpoint unavailable')
  })

  test('treats registration auth refresh as a non-fatal verification pending state', () => {
    expect(getAccountAuthRefreshFailureMessage('Authentication required', 'register')).toBe(
      'Аккаунт создан. Проверьте email и войдите после подтверждения ROX ID.',
    )
    expect(getAccountAuthRefreshFailureMessage(
      "Error invoking remote method 'account:request': Error: Authentication required",
      'register',
    )).toBe('Аккаунт создан. Проверьте email и войдите после подтверждения ROX ID.')
  })
})
