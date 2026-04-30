import type { AccountAuthTab } from './AccountAuthPanel'

export function getAccountAuthSuccessMessage(
  tab: AccountAuthTab,
  hasAccountUser: boolean,
): string | null {
  if (!hasAccountUser) return null
  if (tab === 'register') return 'Аккаунт создан. Кабинет обновлен.'
  if (tab === 'sign-in') return 'Вход выполнен. Кабинет обновлен.'
  return null
}
