import { describe, expect, test, beforeEach } from 'bun:test'
import {
  handleReleaseFeedRequest,
  resetReleaseFeedCachesForTest,
} from '../cloudflare/rox-one-release-feed.worker'

type FetchStub = (input: RequestInfo | URL) => Promise<Response>

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
})
