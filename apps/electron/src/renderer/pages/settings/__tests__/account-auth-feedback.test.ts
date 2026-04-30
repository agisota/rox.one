import { describe, expect, test } from 'bun:test'

import { getAccountAuthSuccessMessage } from '../account-auth-feedback'

describe('account auth feedback', () => {
  test('shows sign-in success only after account refresh returns a user', () => {
    expect(getAccountAuthSuccessMessage('sign-in', true)).toBe('Вход выполнен. Кабинет обновлен.')
    expect(getAccountAuthSuccessMessage('sign-in', false)).toBeNull()
  })

  test('shows registration success only after account refresh returns a user', () => {
    expect(getAccountAuthSuccessMessage('register', true)).toBe('Аккаунт создан. Кабинет обновлен.')
    expect(getAccountAuthSuccessMessage('register', false)).toBeNull()
  })
})
