import { describe, expect, test } from 'bun:test'

import {
  getAccountAuthRefreshFailureMessage,
  getAccountAuthSuccessMessage,
  getConfirmedAccountCabinetError,
  normalizeAccountAuthError,
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
    expect(getConfirmedAccountCabinetError('Authentication required', false)).toBe('Требуется вход в ROX ID.')
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

  test('maps account auth failures to explicit Russian UI-safe states', () => {
    expect(normalizeAccountAuthError('Invalid credentials')).toBe('Неверный email или пароль.')
    expect(normalizeAccountAuthError('Email verification required')).toBe('Email не подтвержден. Проверьте почту и завершите подтверждение ROX ID.')
    expect(normalizeAccountAuthError('Account is disabled')).toBe('Аккаунт отключен. Обратитесь в поддержку ROX.')
    expect(normalizeAccountAuthError('HTTP 401')).toBe('Требуется вход в ROX ID.')
    expect(normalizeAccountAuthError('HTTP 403')).toBe('Недостаточно прав для этого действия.')
    expect(normalizeAccountAuthError('HTTP 500')).toBe('Сервер ROX ID временно недоступен. Повторите позже.')
    expect(normalizeAccountAuthError('Failed to fetch')).toBe('Нет связи с ROX ID. Проверьте сеть и повторите попытку.')
    expect(normalizeAccountAuthError('Session expired')).toBe('Сессия истекла. Войдите в ROX ID заново.')
  })

  test('never exposes raw Electron IPC account errors to the renderer copy', () => {
    const normalized = normalizeAccountAuthError(
      "Error invoking remote method 'account:request': Error: Invalid credentials",
    )

    expect(normalized).toBe('Неверный email или пароль.')
    expect(normalized).not.toContain('Error invoking remote method')
    expect(normalized).not.toContain('account:request')
  })
})
