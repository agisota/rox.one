import type { AccountAuthTab } from './AccountAuthPanel'

const STALE_AUTH_ERROR_RE = /^(authentication required|unauthorized|http 401)$/i
const POST_AUTH_REFRESH_PENDING_MESSAGE = 'Вход принят, но кабинет еще не подтвердил активную сессию. Обновите кабинет или войдите заново.'
const REGISTER_REFRESH_PENDING_MESSAGE = 'Аккаунт создан. Проверьте email и войдите после подтверждения ROX ID.'
const ACCOUNT_IPC_ERROR_PREFIX_RE = /^Error invoking remote method 'account:request': Error:\s*/i

export function normalizeAccountAuthError(message?: string | null): string {
  return (message ?? '').trim().replace(ACCOUNT_IPC_ERROR_PREFIX_RE, '').trim()
}

export function isPendingAccountAuthRefresh(message?: string | null): boolean {
  return STALE_AUTH_ERROR_RE.test(normalizeAccountAuthError(message))
}

export function getAccountAuthSuccessMessage(
  tab: AccountAuthTab,
  hasAccountUser: boolean,
): string | null {
  if (!hasAccountUser) return null
  if (tab === 'register') return 'Аккаунт создан. Кабинет обновлен.'
  if (tab === 'sign-in') return 'Вход выполнен. Кабинет обновлен.'
  return null
}

export function getConfirmedAccountCabinetError(
  error: string | null | undefined,
  hasAccountUser: boolean,
): string | null {
  if (!error) return null
  if (hasAccountUser && isPendingAccountAuthRefresh(error)) return null
  return normalizeAccountAuthError(error)
}

export function getAccountAuthRefreshFailureMessage(
  error: string | null | undefined,
  tab: AccountAuthTab = 'sign-in',
): string {
  if (isPendingAccountAuthRefresh(error)) {
    return tab === 'register' ? REGISTER_REFRESH_PENDING_MESSAGE : POST_AUTH_REFRESH_PENDING_MESSAGE
  }
  return normalizeAccountAuthError(error) || POST_AUTH_REFRESH_PENDING_MESSAGE
}
