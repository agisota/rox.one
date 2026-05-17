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

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
}

function makeRelease(tag: string, assetNames: string[]): unknown {
  return {
    tag_name: tag,
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
    // Track every fetch call so we can assert:
    //   (a) the asset API call was issued with redirect: 'manual'
    //       — the actual safeguard against the PAT leak; without it the
    //       fetch runtime auto-follows and retains the Authorization header.
    //   (b) the second hop to S3 carries NO Authorization header.
    //   (c) the first hop to the GitHub API DID carry the Authorization header.
    const calls: Array<{ url: string; authorization: string | null; redirect: RequestRedirect | undefined }> = []
    const restore = installFetchStub(async (input, init) => {
      const url = String(input)
      const headers = new Headers(init?.headers as HeadersInit | undefined)
      calls.push({ url, authorization: headers.get('authorization'), redirect: init?.redirect })

      if (url.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.3.0' })
      if (url.endsWith('/releases/tags/v1.3.0'))
        return jsonResponse(makeRelease('v1.3.0', ['ROX-ONE-arm64.dmg']))
      // The assets endpoint returns a 302 to a presigned S3 URL — same shape
      // as the real GitHub API.
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
      // (a) the assets fetch must opt out of redirect-following — if anyone
      // ever removes this, the GitHub PAT would silently leak to S3.
      expect(apiCall!.redirect).toBe('manual')
      // (c) the GitHub API call carries the Bearer token.
      expect(apiCall!.authorization).toBe('Bearer test-token')

      const s3Call = calls.find((c) => c.url.startsWith('https://objects.githubusercontent.com/'))
      expect(s3Call).toBeDefined()
      // (b) the S3 hop must not carry the GitHub PAT.
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
    // Prove: HEAD must NOT call the GitHub asset URL (no 302 dance, no S3 fetch).
    // The worker uses release metadata (already in releaseCache) to synthesize
    // Content-Type / Content-Length / Content-Disposition headers.
    const calls: string[] = []
    const restore = installFetchStub(async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.endsWith('/releases/latest')) return jsonResponse({ tag_name: 'v1.8.0' })
      if (url.endsWith('/releases/tags/v1.8.0'))
        return jsonResponse(makeRelease('v1.8.0', ['ROX-ONE-arm64.dmg']))
      // If we ever hit this in a HEAD test, the worker is wrong.
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
      expect(response.headers.get('content-length')).toBe('100') // makeRelease sets size: 100 + i for first asset
      expect(response.headers.get('content-disposition')).toContain('ROX-ONE-arm64.dmg')
      expect(response.headers.get('accept-ranges')).toBe('bytes')
      // Crucial: no body
      const body = await response.text()
      expect(body).toBe('')
      // Crucial: did NOT call the asset URL
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
      // 405 errors must also carry CORS so the browser doesn't show an
      // opaque cross-origin error in the console.
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
      // text-like asset → 60s cache, not 300s
      expect(response.headers.get('cache-control')).toBe('public, max-age=60')
      // HEAD must not hit the upstream asset URL
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
      // 304 has no body; the worker should NOT mislabel this as a broken redirect.
      // streamAsset treats non-ok upstream as 502, so the asserted status here
      // is 502 with a clear "fetch failed" message — NOT "redirect missing
      // Location". The key thing is we did not attempt a second fetch.
      expect(response.status).toBe(502)
      const body = await response.text()
      expect(body).toContain('fetch failed')
      expect(body).not.toContain('Location')
    } finally {
      restore()
    }
  })
})
