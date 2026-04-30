const ACCOUNT_WEB_ORIGIN = 'https://rox.one'

type AccountApiInit = {
  method?: string
  headers?: Record<string, string>
  body?: string | null
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export interface AccountApiProxyOptions {
  origin?: string
  fetch?: FetchLike
}

function assertAccountApiPath(path: string): void {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('Unsupported account API path')
  }

  if (path.startsWith('/api/account') || path.startsWith('/api/auth/')) {
    return
  }

  throw new Error('Unsupported account API path')
}

function extractCookiePair(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null
  const sessionMatch = setCookieHeader.match(/(?:^|,\s*)(rox_session=[^;,]+)/)
  if (sessionMatch?.[1]) return sessionMatch[1]
  const firstCookie = setCookieHeader.split(';')[0]?.trim()
  return firstCookie || null
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function extractResponseError(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as { error?: unknown }).error
    if (typeof error === 'string') return error
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message
      if (typeof message === 'string') return message
    }
  }
  return `HTTP ${status}`
}

export function createAccountApiProxy(options: AccountApiProxyOptions = {}) {
  const origin = options.origin ?? ACCOUNT_WEB_ORIGIN
  const fetchImpl = options.fetch ?? fetch
  let cookieHeader: string | null = null

  return {
    async request<T = unknown>(path: string, init: AccountApiInit = {}): Promise<T> {
      assertAccountApiPath(path)

      const headers: Record<string, string> = { ...(init.headers ?? {}) }
      if (cookieHeader) headers.Cookie = cookieHeader

      const response = await fetchImpl(`${origin}${path}`, {
        method: init.method ?? 'GET',
        headers,
        body: init.body ?? undefined,
      })

      const nextCookie = extractCookiePair(response.headers.get('set-cookie'))
      if (nextCookie) cookieHeader = nextCookie

      const body = await parseResponseBody(response)

      if (path === '/api/auth/logout' && response.ok) {
        cookieHeader = null
      }

      if (!response.ok) {
        throw new Error(extractResponseError(body, response.status))
      }

      return body as T
    },
  }
}
