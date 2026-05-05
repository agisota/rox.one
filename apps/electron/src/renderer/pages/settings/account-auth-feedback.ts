import type { AccountAuthTab } from './AccountAuthPanel'

const STALE_AUTH_ERROR_RE = /^(authentication required|unauthorized|http 401)$/i
const POST_AUTH_REFRESH_PENDING_MESSAGE = 'Вход принят, но кабинет еще не подтвердил активную сессию. Обновите кабинет или войдите заново.'

function isStaleAuthError(message?: string | null): boolean {
  return STALE_AUTH_ERROR_RE.test((message ?? '').trim())
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
  if (hasAccountUser && isStaleAuthError(error)) return null
  return error
}

export function getAccountAuthRefreshFailureMessage(error: string | null | undefined): string {
  if (isStaleAuthError(error)) return POST_AUTH_REFRESH_PENDING_MESSAGE
  return error || POST_AUTH_REFRESH_PENDING_MESSAGE
}
