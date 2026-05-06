import type { AccountAuthTab } from './AccountAuthPanel'

const POST_AUTH_REFRESH_PENDING_MESSAGE = 'Вход принят, но кабинет еще не подтвердил активную сессию. Обновите кабинет или войдите заново.'
const REGISTER_REFRESH_PENDING_MESSAGE = 'Аккаунт создан. Проверьте email и войдите после подтверждения ROX ID.'
const ACCOUNT_IPC_ERROR_PREFIX_RE = /^Error invoking remote method 'account:request': Error:\s*/i

type AccountAuthErrorState =
  | 'auth_required'
  | 'invalid_credentials'
  | 'email_unverified'
  | 'network_error'
  | 'server_error'
  | 'session_expired'
  | 'forbidden'
  | 'disabled'
  | 'unknown'

const ACCOUNT_AUTH_ERROR_COPY: Record<Exclude<AccountAuthErrorState, 'unknown'>, string> = {
  auth_required: 'Требуется вход в ROX ID.',
  invalid_credentials: 'Неверный email или пароль.',
  email_unverified: 'Email не подтвержден. Проверьте почту и завершите подтверждение ROX ID.',
  network_error: 'Нет связи с ROX ID. Проверьте сеть и повторите попытку.',
  server_error: 'Сервер ROX ID временно недоступен. Повторите позже.',
  session_expired: 'Сессия истекла. Войдите в ROX ID заново.',
  forbidden: 'Недостаточно прав для этого действия.',
  disabled: 'Аккаунт отключен. Обратитесь в поддержку ROX.',
}

export function normalizeAccountAuthError(message?: string | null): string {
  const raw = stripAccountAuthError(message)
  const state = classifyAccountAuthError(raw)
  return state === 'unknown' ? raw : ACCOUNT_AUTH_ERROR_COPY[state]
}

export function isPendingAccountAuthRefresh(message?: string | null): boolean {
  return classifyAccountAuthError(stripAccountAuthError(message)) === 'auth_required'
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

function stripAccountAuthError(message?: string | null): string {
  return (message ?? '').trim().replace(ACCOUNT_IPC_ERROR_PREFIX_RE, '').trim()
}

function classifyAccountAuthError(message: string): AccountAuthErrorState {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return 'unknown'
  if (normalized === 'authentication required' || normalized === 'unauthorized' || normalized === 'http 401') {
    return 'auth_required'
  }
  if (normalized === 'invalid credentials') return 'invalid_credentials'
  if (normalized === 'email verification required' || normalized === 'email_unverified') return 'email_unverified'
  if (normalized === 'account is disabled') return 'disabled'
  if (normalized === 'session expired' || normalized === 'session_expired') return 'session_expired'
  if (normalized === 'failed to fetch' || normalized.includes('networkerror') || normalized.includes('network error')) {
    return 'network_error'
  }
  if (normalized === 'http 403' || normalized === 'forbidden') return 'forbidden'
  if (/^http 5\d\d$/.test(normalized) || normalized === 'server_error') return 'server_error'
  return 'unknown'
}
