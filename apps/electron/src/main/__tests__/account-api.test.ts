import { describe, expect, test } from 'bun:test'
import { createAccountApiProxy } from '../account-api'

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
})
