import { describe, expect, test } from 'bun:test'
import { handleReleaseFeedRequest } from '../cloudflare/rox-one-release-feed.worker'

describe('rox-one release feed worker', () => {
  test('serves the mac updater manifest with installer-compatible arch metadata', async () => {
    const response = await handleReleaseFeedRequest(
      new Request('https://app.rox.one/electron/latest/latest-mac.yml'),
      { GITHUB_RELEASE_TOKEN: 'test-token' },
    )

    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain('version: 0.9.2')
    expect(body).toContain('url: ROX-ONE-arm64.zip')
    expect(body).toContain('arch: arm64')
    expect(response.headers.get('content-type')).toContain('application/x-yaml')
  })

  test('routes install scripts and release artifacts to private GitHub assets', async () => {
    const fetchCalls: string[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = ((input: RequestInfo | URL) => {
      fetchCalls.push(String(input))
      if (String(input).endsWith('/releases/tags/v0.9.2')) {
        return Promise.resolve(
          Response.json({
            assets: [
              {
                name: 'install-app.sh',
                url: 'https://api.github.com/repos/agisota/rox-one-terminal/releases/assets/install-sh',
              },
              {
                name: 'ROX-ONE-arm64.zip',
                url: 'https://api.github.com/repos/agisota/rox-one-terminal/releases/assets/mac-zip',
              },
            ],
          }),
        )
      }
      return Promise.resolve(new Response('asset body', { status: 200 }))
    }) as typeof fetch

    try {
      const script = await handleReleaseFeedRequest(new Request('https://app.rox.one/install-app.sh'), {
        GITHUB_RELEASE_TOKEN: 'test-token',
      })
      const zip = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/ROX-ONE-arm64.zip'),
        { GITHUB_RELEASE_TOKEN: 'test-token' },
      )

      expect(script.status).toBe(200)
      expect(script.headers.get('content-type')).toContain('text/x-shellscript')
      expect(zip.status).toBe(200)
      expect(zip.headers.get('content-type')).toBe('application/zip')
      expect(fetchCalls).toEqual([
        'https://api.github.com/repos/agisota/rox-one-terminal/releases/tags/v0.9.2',
        'https://api.github.com/repos/agisota/rox-one-terminal/releases/assets/install-sh',
        'https://api.github.com/repos/agisota/rox-one-terminal/releases/tags/v0.9.2',
        'https://api.github.com/repos/agisota/rox-one-terminal/releases/assets/mac-zip',
      ])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('fails closed when private release token is not configured', async () => {
    const response = await handleReleaseFeedRequest(new Request('https://app.rox.one/install-app.sh'), {
      GITHUB_RELEASE_TOKEN: '',
    })

    expect(response.status).toBe(503)
    expect(await response.text()).toContain('not configured')
  })
})
