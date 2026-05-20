import { describe, expect, test, beforeEach } from 'bun:test'
import {
  handleReleaseFeedRequest,
  resetReleaseFeedCachesForTest,
} from '../cloudflare/rox-one-release-feed.worker'

type FetchStub = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function installFetchStub(stub: FetchStub): () => void {
  const original = globalThis.fetch
  globalThis.fetch = stub as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

const ENV = { GITHUB_RELEASE_TOKEN: 'test-token' }
const ENV_R2 = {
  GITHUB_RELEASE_TOKEN: 'test-token',
  R2_PUBLIC_BASE_URL: 'https://pub-abc123.r2.dev',
  R2_PRIMARY: 'true',
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
}

function makeRelease(
  tag: string,
  assetNames: string[],
  options: { draft?: boolean; prerelease?: boolean } = {},
): unknown {
  return {
    tag_name: tag,
    draft: options.draft,
    prerelease: options.prerelease,
    assets: assetNames.map((name, i) => ({
      name,
      size: 100 + i,
      url: `https://api.github.com/repos/agisota/rox-one-terminal/releases/assets/${name}`,
    })),
  }
}

describe('rox-one release feed worker v2', () => {
  beforeEach(() => {
    resetReleaseFeedCachesForTest()
  })

  test('serves manifest.json for /electron/latest', async () => {
    const restore = installFetchStub(async (input) => {
      const u = String(input)
      if (u.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.0.0' })
      if (u.endsWith('/releases/tags/v1.0.0')) return jsonResponse(makeRelease('v1.0.0', ['manifest.json']))
      return new Response('{"version":"1.0.0","binaries":{}}', { status: 200 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/manifest.json'),
        ENV,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')
      const body = await response.json()
      expect(body.version).toBe('1.0.0')
    } finally {
      restore()
    }
  })

  test('serves /electron/stable/latest-mac.yml from the latest stable release', async () => {
    const calls: string[] = []
    const restore = installFetchStub(async (input) => {
      const u = String(input)
      calls.push(u)
      if (u.includes('/releases?')) {
        return jsonResponse([
          makeRelease('v1.1.0-beta.1', ['beta-mac.yml']),
          makeRelease('v1.0.0', ['latest-mac.yml']),
        ])
      }
      if (u.endsWith('/releases/tags/v1.0.0')) return jsonResponse(makeRelease('v1.0.0', ['latest-mac.yml']))
      return new Response('version: 1.0.0\n', { status: 200 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/stable/latest-mac.yml'),
        ENV,
      )
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('version: 1.0.0')
      expect(calls.some((u) => u.endsWith('/releases/tags/v1.0.0'))).toBe(true)
      expect(calls.some((u) => u.endsWith('/releases/tags/v1.1.0-beta.1'))).toBe(false)
    } finally {
      restore()
    }
  })

  test('/electron/latest aliases stable and does not resolve prerelease tags', async () => {
    const calls: string[] = []
    const restore = installFetchStub(async (input) => {
      const u = String(input)
      calls.push(u)
      if (u.includes('/releases?')) {
        return jsonResponse([
          makeRelease('v1.2.0-rc.1', ['manifest.json']),
          makeRelease('v1.1.0', ['manifest.json']),
        ])
      }
      if (u.endsWith('/releases/tags/v1.1.0')) return jsonResponse(makeRelease('v1.1.0', ['manifest.json']))
      return new Response('{"version":"1.1.0"}', { status: 200 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/manifest.json'),
        ENV,
      )
      expect(response.status).toBe(200)
      expect((await response.json()).version).toBe('1.1.0')
      expect(calls.some((u) => u.endsWith('/releases/tags/v1.1.0'))).toBe(true)
      expect(calls.some((u) => u.endsWith('/releases/tags/v1.2.0-rc.1'))).toBe(false)
    } finally {
      restore()
    }
  })

  test('serves /electron/beta/beta-mac.yml from the latest beta or rc prerelease', async () => {
    const calls: string[] = []
    const restore = installFetchStub(async (input) => {
      const u = String(input)
      calls.push(u)
      if (u.includes('/releases?')) {
        return jsonResponse([
          makeRelease(
            'v1.3.0-beta.2',
            ['manifest.json', 'beta-mac.yml', 'beta.yml', 'beta-linux.yml'],
            { prerelease: true },
          ),
          makeRelease(
            'v1.2.0-rc.7',
            ['manifest.json', 'beta-mac.yml', 'beta.yml', 'beta-linux.yml'],
            { prerelease: true },
          ),
          makeRelease('v1.1.0', ['latest-mac.yml']),
        ])
      }
      if (u.endsWith('/releases/tags/v1.3.0-beta.2')) {
        return jsonResponse(makeRelease('v1.3.0-beta.2', ['beta-mac.yml'], { prerelease: true }))
      }
      return new Response('version: 1.3.0-beta.2\n', { status: 200 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/beta/beta-mac.yml'),
        ENV,
      )
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('1.3.0-beta.2')
      expect(calls.some((u) => u.endsWith('/releases/tags/v1.3.0-beta.2'))).toBe(true)
    } finally {
      restore()
    }
  })

  test('skips beta/rc releases that are not prereleases or lack beta update metadata', async () => {
    const calls: string[] = []
    const restore = installFetchStub(async (input) => {
      const u = String(input)
      calls.push(u)
      if (u.includes('/releases?')) {
        return jsonResponse([
          makeRelease('v1.3.0-rc.7', ['manifest.json', 'ROX-ONE-arm64.zip']),
          makeRelease(
            'v1.2.0-beta.1',
            ['manifest.json', 'beta-mac.yml', 'beta.yml', 'beta-linux.yml'],
            { prerelease: true },
          ),
          makeRelease('v1.1.0', ['manifest.json', 'latest-mac.yml']),
        ])
      }
      if (u.endsWith('/releases/tags/v1.2.0-beta.1')) {
        return jsonResponse(makeRelease('v1.2.0-beta.1', ['beta-mac.yml'], { prerelease: true }))
      }
      return new Response('version: 1.2.0-beta.1\n', { status: 200 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/beta/beta-mac.yml'),
        ENV,
      )
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('1.2.0-beta.1')
      expect(calls.some((u) => u.endsWith('/releases/tags/v1.2.0-beta.1'))).toBe(true)
      expect(calls.some((u) => u.endsWith('/releases/tags/v1.3.0-rc.7'))).toBe(false)
    } finally {
      restore()
    }
  })

  test('serves stable release-notes.json as a public JSON feed', async () => {
    const restore = installFetchStub(async (input) => {
      const u = String(input)
      if (u.includes('/releases?')) return jsonResponse([makeRelease('v1.4.0', ['release-notes.json'])])
      if (u.endsWith('/releases/tags/v1.4.0')) return jsonResponse(makeRelease('v1.4.0', ['release-notes.json']))
      return new Response('{"releases":[{"version":"1.4.0","content":"notes"}]}', { status: 200 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/stable/release-notes.json'),
        ENV,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')
      expect((await response.json()).releases[0].version).toBe('1.4.0')
    } finally {
      restore()
    }
  })

  test('proxies a Windows .exe with attachment disposition and correct content type', async () => {
    const restore = installFetchStub(async (input) => {
      const u = String(input)
      if (u.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.0.1' })
      if (u.endsWith('/releases/tags/v1.0.1'))
        return jsonResponse(makeRelease('v1.0.1', ['ROX-ONE-x64.exe']))
      return new Response('exe-bytes', { status: 200 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/ROX-ONE-x64.exe'),
        ENV,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/vnd.microsoft.portable-executable')
      expect(response.headers.get('content-disposition')).toContain('ROX-ONE-x64.exe')
    } finally {
      restore()
    }
  })

  test('proxies a Linux .AppImage', async () => {
    const restore = installFetchStub(async (input) => {
      const u = String(input)
      if (u.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.0.2' })
      if (u.endsWith('/releases/tags/v1.0.2'))
        return jsonResponse(makeRelease('v1.0.2', ['ROX-ONE-x64.AppImage']))
      return new Response('appimage-bytes', { status: 200 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/ROX-ONE-x64.AppImage'),
        ENV,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/octet-stream')
      expect(response.headers.get('content-disposition')).toContain('ROX-ONE-x64.AppImage')
    } finally {
      restore()
    }
  })

  test('serves /electron/{version}/manifest.json from a pinned tag', async () => {
    const restore = installFetchStub(async (input) => {
      const u = String(input)
      if (u.endsWith('/releases/tags/v0.9.2'))
        return jsonResponse(makeRelease('v0.9.2', ['manifest.json']))
      return new Response('{"version":"0.9.2","binaries":{}}', { status: 200 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/0.9.2/manifest.json'),
        ENV,
      )
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.version).toBe('0.9.2')
    } finally {
      restore()
    }
  })

  test('returns 404 for asset names the release does not contain', async () => {
    const restore = installFetchStub(async (input) => {
      const u = String(input)
      if (u.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.1.0' })
      if (u.endsWith('/releases/tags/v1.1.0'))
        return jsonResponse(makeRelease('v1.1.0', ['ROX-ONE-arm64.zip']))
      return new Response('asset-bytes', { status: 200 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/does-not-exist.bin'),
        ENV,
      )
      expect(response.status).toBe(404)
    } finally {
      restore()
    }
  })

  test('serves the install script from latest release', async () => {
    const restore = installFetchStub(async (input) => {
      const u = String(input)
      if (u.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.2.0' })
      if (u.endsWith('/releases/tags/v1.2.0'))
        return jsonResponse(makeRelease('v1.2.0', ['install-app.sh']))
      return new Response('#!/bin/bash\n', { status: 200 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/install-app.sh'),
        ENV,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/x-shellscript')
    } finally {
      restore()
    }
  })

  test('returns 503 when GITHUB_RELEASE_TOKEN is missing', async () => {
    const response = await handleReleaseFeedRequest(
      new Request('https://app.rox.one/electron/latest/manifest.json'),
      { GITHUB_RELEASE_TOKEN: '' },
    )
    expect(response.status).toBe(503)
  })

  test('does NOT forward GITHUB_RELEASE_TOKEN to the S3 redirect target (security)', async () => {
    const calls: Array<{ url: string; authorization: string | null; redirect: RequestRedirect | undefined }> = []
    const restore = installFetchStub(async (input, init) => {
      const url = String(input)
      const headers = new Headers(init?.headers as HeadersInit | undefined)
      calls.push({ url, authorization: headers.get('authorization'), redirect: init?.redirect })

      if (url.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.3.0' })
      if (url.endsWith('/releases/tags/v1.3.0'))
        return jsonResponse(makeRelease('v1.3.0', ['ROX-ONE-arm64.dmg']))
      if (url.endsWith('/releases/assets/ROX-ONE-arm64.dmg')) {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://objects.githubusercontent.com/some-presigned-url?token=signed' },
        })
      }
      if (url.startsWith('https://objects.githubusercontent.com/')) {
        return new Response('dmg-bytes', { status: 200 })
      }
      return new Response('unexpected url', { status: 500 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/ROX-ONE-arm64.dmg'),
        ENV,
      )
      expect(response.status).toBe(200)

      const apiCall = calls.find((c) => c.url.endsWith('/releases/assets/ROX-ONE-arm64.dmg'))
      expect(apiCall).toBeDefined()
      expect(apiCall!.redirect).toBe('manual')
      expect(apiCall!.authorization).toBe('Bearer test-token')

      const s3Call = calls.find((c) => c.url.startsWith('https://objects.githubusercontent.com/'))
      expect(s3Call).toBeDefined()
      expect(s3Call!.authorization).toBeNull()
    } finally {
      restore()
    }
  })

  test('follows a relative Location header by resolving against the asset URL', async () => {
    const calls: string[] = []
    const restore = installFetchStub(async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.4.0' })
      if (url.endsWith('/releases/tags/v1.4.0'))
        return jsonResponse(makeRelease('v1.4.0', ['ROX-ONE-arm64.dmg']))
      if (url.endsWith('/releases/assets/ROX-ONE-arm64.dmg')) {
        return new Response(null, {
          status: 302,
          headers: { location: '/repos/agisota/rox-one-terminal/releases/assets/relative-target' },
        })
      }
      if (url === 'https://api.github.com/repos/agisota/rox-one-terminal/releases/assets/relative-target') {
        return new Response('dmg-bytes', { status: 200 })
      }
      return new Response('unexpected url: ' + url, { status: 500 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/ROX-ONE-arm64.dmg'),
        ENV,
      )
      expect(response.status).toBe(200)
      expect(
        calls.some(
          (u) => u === 'https://api.github.com/repos/agisota/rox-one-terminal/releases/assets/relative-target',
        ),
      ).toBe(true)
    } finally {
      restore()
    }
  })

  test('refuses to follow a non-https redirect', async () => {
    const restore = installFetchStub(async (input) => {
      const url = String(input)
      if (url.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.5.0' })
      if (url.endsWith('/releases/tags/v1.5.0'))
        return jsonResponse(makeRelease('v1.5.0', ['ROX-ONE-arm64.dmg']))
      if (url.endsWith('/releases/assets/ROX-ONE-arm64.dmg')) {
        return new Response(null, {
          status: 302,
          headers: { location: 'http://malicious.example.com/asset' },
        })
      }
      return new Response('should not be reached', { status: 500 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/ROX-ONE-arm64.dmg'),
        ENV,
      )
      expect(response.status).toBe(502)
      const body = await response.text()
      expect(body).toContain('non-https')
    } finally {
      restore()
    }
  })

  test('HEAD returns metadata-only without touching the asset URL', async () => {
    const calls: string[] = []
    const restore = installFetchStub(async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.8.0' })
      if (url.endsWith('/releases/tags/v1.8.0'))
        return jsonResponse(makeRelease('v1.8.0', ['ROX-ONE-arm64.dmg']))
      if (url.endsWith('/releases/assets/ROX-ONE-arm64.dmg')) {
        return new Response('should-not-be-called-for-HEAD', { status: 500 })
      }
      return new Response('unexpected', { status: 500 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/ROX-ONE-arm64.dmg', { method: 'HEAD' }),
        ENV,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/x-apple-diskimage')
      expect(response.headers.get('content-length')).toBe('100')
      expect(response.headers.get('content-disposition')).toContain('ROX-ONE-arm64.dmg')
      expect(response.headers.get('accept-ranges')).toBe('bytes')
      const body = await response.text()
      expect(body).toBe('')
      expect(calls.some((u) => u.endsWith('/releases/assets/ROX-ONE-arm64.dmg'))).toBe(false)
    } finally {
      restore()
    }
  })

  test('rejects POST / PUT / DELETE with 405 + Allow header (RFC 7231)', async () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH'] as const) {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/manifest.json', { method }),
        ENV,
      )
      expect(response.status).toBe(405)
      expect(response.headers.get('allow')).toBe('GET, HEAD, OPTIONS')
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
    }
  })

  test('HEAD on /electron/latest/manifest.json returns short-cache headers (text-like asset)', async () => {
    const calls: string[] = []
    const restore = installFetchStub(async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.9.0' })
      if (url.endsWith('/releases/tags/v1.9.0'))
        return jsonResponse(makeRelease('v1.9.0', ['manifest.json']))
      return new Response('should-not-be-called', { status: 500 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/manifest.json', { method: 'HEAD' }),
        ENV,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
      expect(response.headers.get('cache-control')).toBe('public, max-age=60')
      expect(calls.some((u) => u.includes('manifest.json') && u.includes('assets'))).toBe(false)
    } finally {
      restore()
    }
  })

  test('HEAD on /install-app.sh returns shell content-type + short cache', async () => {
    const restore = installFetchStub(async (input) => {
      const url = String(input)
      if (url.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.10.0' })
      if (url.endsWith('/releases/tags/v1.10.0'))
        return jsonResponse(makeRelease('v1.10.0', ['install-app.sh']))
      return new Response('should-not-be-called', { status: 500 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/install-app.sh', { method: 'HEAD' }),
        ENV,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/x-shellscript')
      expect(response.headers.get('cache-control')).toBe('public, max-age=60')
    } finally {
      restore()
    }
  })

  test('OPTIONS on a binary path also returns the preflight 204', async () => {
    const response = await handleReleaseFeedRequest(
      new Request('https://app.rox.one/electron/latest/ROX-ONE-arm64.dmg', { method: 'OPTIONS' }),
      ENV,
    )
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-methods')).toContain('HEAD')
    expect(response.headers.get('vary')).toContain('Access-Control-Request-Headers')
  })

  test('OPTIONS works even when GITHUB_RELEASE_TOKEN is missing (preflight is pre-auth)', async () => {
    const response = await handleReleaseFeedRequest(
      new Request('https://app.rox.one/electron/latest/manifest.json', { method: 'OPTIONS' }),
      { GITHUB_RELEASE_TOKEN: '' },
    )
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })

  test('sets permissive CORS on streamed manifest responses', async () => {
    const restore = installFetchStub(async (input) => {
      const url = String(input)
      if (url.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.7.0' })
      if (url.endsWith('/releases/tags/v1.7.0'))
        return jsonResponse(makeRelease('v1.7.0', ['manifest.json']))
      return new Response('{"version":"1.7.0","binaries":{}}', { status: 200 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/manifest.json', {
          headers: { Origin: 'https://rox.one' },
        }),
        ENV,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      expect(response.headers.get('vary')).toBe('Origin')
    } finally {
      restore()
    }
  })

  test('responds to CORS preflight with 204 and allowed methods', async () => {
    const response = await handleReleaseFeedRequest(
      new Request('https://app.rox.one/electron/latest/manifest.json', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://rox.one',
          'Access-Control-Request-Method': 'GET',
        },
      }),
      ENV,
    )
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-methods')).toContain('GET')
  })

  // ---------------------------------------------------------------------------
  // R2 Phase 5 tests
  // ---------------------------------------------------------------------------

  test('R2_PRIMARY=true: serves asset from R2 when R2 returns 200 (no GH asset hit)', async () => {
    // Tag resolution still contacts GH (to know which channel/tag to use for R2).
    // The asset body fetch goes to R2 only — the GH asset/S3 path is bypassed.
    const calls: string[] = []
    const restore = installFetchStub(async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.startsWith('https://pub-abc123.r2.dev/')) {
        return new Response('{"version":"2.0.0","binaries":{}}', { status: 200 })
      }
      if (url.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v2.0.0' })
      if (url.endsWith('/releases/tags/v2.0.0')) return jsonResponse(makeRelease('v2.0.0', ['manifest.json']))
      return new Response('unexpected-gh-asset', { status: 500 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/manifest.json'),
        ENV_R2,
      )
      expect(calls.some((u) => u.startsWith('https://pub-abc123.r2.dev/'))).toBe(true)
      expect(calls.some((u) => u.includes('/releases/assets/'))).toBe(false)
      expect(response.status).toBe(200)
      expect(response.headers.get('x-source')).toBe('r2')
      const body = await response.json()
      expect(body.version).toBe('2.0.0')
    } finally {
      restore()
    }
  })

  test('R2_PRIMARY=true: falls back to GH on R2 404', async () => {
    const calls: string[] = []
    const restore = installFetchStub(async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.startsWith('https://pub-abc123.r2.dev/')) {
        return new Response('not found', { status: 404 })
      }
      if (url.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.0.0' })
      if (url.endsWith('/releases/tags/v1.0.0')) return jsonResponse(makeRelease('v1.0.0', ['manifest.json']))
      return new Response('{"version":"1.0.0-gh","binaries":{}}', { status: 200 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/manifest.json'),
        ENV_R2,
      )
      expect(calls.some((u) => u.startsWith('https://pub-abc123.r2.dev/'))).toBe(true)
      expect(calls.some((u) => u.endsWith('/releases/tags/v1.0.0'))).toBe(true)
      expect(response.status).toBe(200)
      expect(response.headers.get('x-source')).toBeNull()
      const body = await response.json()
      expect(body.version).toBe('1.0.0-gh')
    } finally {
      restore()
    }
  })

  test('R2_PRIMARY unset: does NOT contact R2 even when R2_PUBLIC_BASE_URL is set', async () => {
    const calls: string[] = []
    const restore = installFetchStub(async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.startsWith('https://pub-abc123.r2.dev/')) {
        return new Response('r2-unexpected', { status: 200 })
      }
      if (url.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.0.0' })
      if (url.endsWith('/releases/tags/v1.0.0')) return jsonResponse(makeRelease('v1.0.0', ['manifest.json']))
      return new Response('{"version":"1.0.0"}', { status: 200 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/manifest.json'),
        { GITHUB_RELEASE_TOKEN: 'test-token', R2_PUBLIC_BASE_URL: 'https://pub-abc123.r2.dev', R2_PRIMARY: 'false' },
      )
      expect(response.status).toBe(200)
      expect(calls.some((u) => u.startsWith('https://pub-abc123.r2.dev/'))).toBe(false)
    } finally {
      restore()
    }
  })

  test('R2_PRIMARY=true: HEAD requests skip R2 and use GH metadata (HEAD is metadata-only)', async () => {
    const calls: string[] = []
    const restore = installFetchStub(async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.startsWith('https://pub-abc123.r2.dev/')) {
        return new Response('should-not-be-called', { status: 500 })
      }
      if (url.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v2.1.0' })
      if (url.endsWith('/releases/tags/v2.1.0')) return jsonResponse(makeRelease('v2.1.0', ['manifest.json']))
      return new Response('should-not-be-called', { status: 500 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/manifest.json', { method: 'HEAD' }),
        ENV_R2,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
      expect(calls.some((u) => u.startsWith('https://pub-abc123.r2.dev/'))).toBe(false)
    } finally {
      restore()
    }
  })

  test('R2_PRIMARY=true: beta channel resolves to R2 beta/ prefix', async () => {
    const calls: string[] = []
    const restore = installFetchStub(async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.startsWith('https://pub-abc123.r2.dev/beta/')) {
        return new Response('version: 2.0.0-beta.1\n', { status: 200 })
      }
      if (url.includes('/releases?')) {
        return jsonResponse([
          makeRelease('v2.0.0-beta.1', ['manifest.json', 'beta-mac.yml', 'beta.yml', 'beta-linux.yml'], {
            prerelease: true,
          }),
        ])
      }
      return new Response('unexpected', { status: 500 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/beta/beta-mac.yml'),
        ENV_R2,
      )
      expect(response.status).toBe(200)
      expect(calls.some((u) => u.startsWith('https://pub-abc123.r2.dev/beta/'))).toBe(true)
      expect(response.headers.get('x-source')).toBe('r2')
    } finally {
      restore()
    }
  })

  test('R2_PRIMARY=true: R2 non-404 error surfaces as 502 (no GH asset fallback)', async () => {
    // Tag resolution still contacts GH; only the asset fetch is short-circuited.
    const calls: string[] = []
    const restore = installFetchStub(async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.startsWith('https://pub-abc123.r2.dev/')) {
        return new Response('internal error', { status: 503 })
      }
      if (url.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.0.0' })
      return new Response('should-not-reach', { status: 500 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/manifest.json'),
        ENV_R2,
      )
      expect(response.status).toBe(502)
      expect(calls.some((u) => u.includes('/releases/assets/'))).toBe(false)
    } finally {
      restore()
    }
  })

  test('passes 304 Not Modified through instead of treating it as a redirect', async () => {
    const restore = installFetchStub(async (input) => {
      const url = String(input)
      if (url.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.6.0' })
      if (url.endsWith('/releases/tags/v1.6.0'))
        return jsonResponse(makeRelease('v1.6.0', ['ROX-ONE-arm64.dmg']))
      if (url.endsWith('/releases/assets/ROX-ONE-arm64.dmg')) {
        return new Response(null, { status: 304 })
      }
      return new Response('unexpected', { status: 500 })
    })

    try {
      const response = await handleReleaseFeedRequest(
        new Request('https://app.rox.one/electron/latest/ROX-ONE-arm64.dmg'),
        ENV,
      )
      expect(response.status).toBe(502)
      const body = await response.text()
      expect(body).toContain('fetch failed')
      expect(body).not.toContain('Location')
    } finally {
      restore()
    }
  })
})
