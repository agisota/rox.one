export const ROX_ACCOUNT_DOMAIN = 'rox.one'
export const ROX_SIGNUP_BONUS_UNITS = 10_000_000

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/

export function normalizeRoxUsername(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase()
}

export function isValidRoxUsername(value: string): boolean {
  const username = normalizeRoxUsername(value)
  return username.length >= 3 && username.length <= 32 && USERNAME_PATTERN.test(username)
}

export function roxUsernameToEmail(value: string): string | null {
  const username = normalizeRoxUsername(value)
  if (!isValidRoxUsername(username)) return null
  return `${username}@${ROX_ACCOUNT_DOMAIN}`
}
