import { describe, expect, test } from 'bun:test'
import { createAccountApiProxy } from '../account-api'
import type { AccountSessionStore } from '../account-session-store'

function createMemorySessionStore(initialCookie: string | null = null) {
  const calls: string[] = []
  let cookie = initialCookie

  const store: AccountSessionStore = {
    async load() {
      calls.push('load')
      return cookie ? { cookie, savedAt: '2026-05-05T00:00:00.000Z', source: 'login' } : null
    },
    async save(session) {
      calls.push(`save:${session.source}:${session.cookie}`)
      cookie = session.cookie
    },
    async clear() {
      calls.push('clear')
      cookie = null
    },
  }

  return {
    store,
    calls,
    get cookie() {
      return cookie
    },
  }
}

describe('account api proxy', () => {
  test('keeps the account session cookie between desktop auth requests', async () => {
    const requests: Array<{ url: string; headers: HeadersInit | undefined }> = []
    const proxy = createAccountApiProxy({
      fetch: async (url, init) => {
        requests.push({ url: String(url), headers: init?.headers })

        if (String(url).endsWith('/api/auth/login')) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'set-cookie': 'rox_session=session-token; Path=/; HttpOnly; SameSite=Lax',
            },
          })
        }

        return new Response(JSON.stringify({ mode: 'account', user: { id: 'u1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    })

    await proxy.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'secret-password' }),
    })
    await proxy.request('/api/account/me')

    expect(requests).toHaveLength(2)
    expect(requests[1]?.headers).toEqual(expect.objectContaining({
      Cookie: 'rox_session=session-token',
    }))
  })

  test('rejects non-account urls before calling fetch', async () => {
    let called = false
    const proxy = createAccountApiProxy({
      fetch: async () => {
        called = true
        return new Response('{}')
      },
    })

    await expect(proxy.request('https://evil.example/api/account/me')).rejects.toThrow('Unsupported account API path')
    await expect(proxy.request('/api/admin/secrets')).rejects.toThrow('Unsupported account API path')
    expect(called).toBe(false)
  })

  test('clears the stored cookie on logout', async () => {
    const cookies: Array<string | undefined> = []
    const proxy = createAccountApiProxy({
      fetch: async (url, init) => {
        cookies.push((init?.headers as Record<string, string> | undefined)?.Cookie)

        if (String(url).endsWith('/api/auth/login')) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'set-cookie': 'rox_session=session-token; Path=/; HttpOnly' },
          })
        }

        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })

    await proxy.request('/api/auth/login', { method: 'POST' })
    await proxy.request('/api/auth/logout', { method: 'POST' })
    await proxy.request('/api/account/me')

    expect(cookies).toEqual([undefined, 'rox_session=session-token', undefined])
  })

  test('persists the account session cookie after login', async () => {
    const sessionStore = createMemorySessionStore()
    const proxy = createAccountApiProxy({
      sessionStore: sessionStore.store,
      fetch: async (url) => {
        if (String(url).endsWith('/api/auth/login')) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'set-cookie': 'rox_session=session-token; Path=/; HttpOnly' },
          })
        }

        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })

    await proxy.request('/api/auth/login', { method: 'POST' })

    expect(sessionStore.cookie).toBe('rox_session=session-token')
    expect(sessionStore.calls).toEqual([
      'load',
      'save:login:rox_session=session-token',
    ])
  })

  test('hydrates a persisted account session before the first account request', async () => {
    const sessionStore = createMemorySessionStore('rox_session=restored-token')
    const cookies: Array<string | undefined> = []
    const proxy = createAccountApiProxy({
      sessionStore: sessionStore.store,
      fetch: async (_url, init) => {
        cookies.push((init?.headers as Record<string, string> | undefined)?.Cookie)
        return new Response(JSON.stringify({ mode: 'account', user: { id: 'u1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    })

    await proxy.request('/api/account/me')

    expect(cookies).toEqual(['rox_session=restored-token'])
    expect(sessionStore.calls).toEqual(['load'])
  })

  test('clears persisted account session on logout', async () => {
    const sessionStore = createMemorySessionStore()
    const cookies: Array<string | undefined> = []
    const proxy = createAccountApiProxy({
      sessionStore: sessionStore.store,
      fetch: async (url, init) => {
        cookies.push((init?.headers as Record<string, string> | undefined)?.Cookie)

        if (String(url).endsWith('/api/auth/login')) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'set-cookie': 'rox_session=session-token; Path=/; HttpOnly' },
          })
        }

        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })

    await proxy.request('/api/auth/login', { method: 'POST' })
    await proxy.request('/api/auth/logout', { method: 'POST' })
    await proxy.request('/api/account/me')

    expect(cookies).toEqual([undefined, 'rox_session=session-token', undefined])
    expect(sessionStore.cookie).toBeNull()
    expect(sessionStore.calls).toEqual([
      'load',
      'save:login:rox_session=session-token',
      'clear',
    ])
  })
})
