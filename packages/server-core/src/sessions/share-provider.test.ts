import { describe, expect, test } from 'bun:test'

import {
  assertPublicShareUrl,
  createFakeShareProvider,
  createViewerShareProvider,
  mapShareProviderFailureToShareResult,
  sanitizeShareBundleForPublicViewer,
} from './share-provider'

describe('share provider contract', () => {
  test('sanitizes obvious secret and auth fields recursively before public upload', () => {
    const sanitized = sanitizeShareBundleForPublicViewer({
      id: 'session-1',
      rox_session: 'cookie-secret',
      headers: {
        authorization: 'Bearer token-secret',
        ok: 'keep-me',
      },
      messages: [
        {
          id: 'message-1',
          content: 'public content',
          apiKey: 'api-key-secret',
          nested: {
            accessToken: 'access-token-secret',
            refresh_token: 'refresh-secret',
          },
        },
      ],
    })

    const payload = JSON.stringify(sanitized)

    expect(payload).toContain('keep-me')
    expect(payload).toContain('public content')
    expect(payload).not.toContain('cookie-secret')
    expect(payload).not.toContain('Bearer token-secret')
    expect(payload).not.toContain('api-key-secret')
    expect(payload).not.toContain('access-token-secret')
    expect(payload).not.toContain('refresh-secret')
  })

  test('redacts secret-looking values embedded in public content fields', () => {
    const sanitized = sanitizeShareBundleForPublicViewer({
      id: 'session-1',
      messages: [
        {
          id: 'message-1',
          content: [
            'Authorization: Bearer bearer-secret-value',
            'OPENAI_API_KEY=sk-publicleak123456',
            'Set-Cookie: rox_session=session-cookie-secret; Path=/',
            'Safe user note',
          ].join('\n'),
        },
      ],
      files: [
        {
          path: '.env.example',
          text: 'DATABASE_PASSWORD=db-secret-value\nNORMAL_VALUE=keep-me',
        },
      ],
    })

    const payload = JSON.stringify(sanitized)

    expect(payload).toContain('Safe user note')
    expect(payload).toContain('NORMAL_VALUE=keep-me')
    expect(payload).toContain('Bearer [redacted]')
    expect(payload).toContain('OPENAI_API_KEY=[redacted]')
    expect(payload).toContain('rox_session=[redacted]')
    expect(payload).toContain('DATABASE_PASSWORD=[redacted]')
    expect(payload).not.toContain('bearer-secret-value')
    expect(payload).not.toContain('sk-publicleak123456')
    expect(payload).not.toContain('session-cookie-secret')
    expect(payload).not.toContain('db-secret-value')
  })

  test('accepts only public https shortlink URLs', () => {
    expect(assertPublicShareUrl('https://app.rox.one/s/share_123')).toEqual({ success: true })
    expect(assertPublicShareUrl('http://127.0.0.1:3000/s/share_123')).toEqual({
      success: false,
      code: 'invalid_public_url',
      error: 'Share provider returned a non-public shortlink URL.',
      retryable: false,
    })
    expect(assertPublicShareUrl('file:///tmp/share.html').success).toBe(false)
  })

  test('fake provider requires upload before shortlink creation', async () => {
    const provider = createFakeShareProvider({ baseUrl: 'https://viewer.test' })

    expect(await provider.createShortlink({ sessionId: 'session-1', uploadId: 'missing' })).toEqual({
      success: false,
      code: 'viewer_unavailable',
      error: 'Upload not found for shortlink creation.',
      retryable: true,
      status: 404,
    })

    const upload = await provider.uploadBundle({ sessionId: 'session-1', bundle: { id: 'session-1' } })
    expect(upload.success).toBe(true)
    if (!upload.success) throw new Error('expected upload success')

    const shortlink = await provider.createShortlink({ sessionId: 'session-1', uploadId: upload.uploadId })
    expect(shortlink).toEqual({
      success: true,
      shareId: 'share_session-1',
      url: 'https://viewer.test/s/share_session-1',
    })
    expect(provider.listUploads()).toEqual([
      { uploadId: 'upload_session-1', sessionId: 'session-1', bundle: { id: 'session-1' } },
    ])
  })

  test('fake provider sanitizes uploaded bundles at the provider seam', async () => {
    const provider = createFakeShareProvider({ baseUrl: 'https://viewer.test' })

    await provider.uploadBundle({
      sessionId: 'session-secret',
      bundle: {
        id: 'session-secret',
        authorization: 'Bearer upload-secret',
        content: 'OPENAI_API_KEY=sk-uploadsecret123456\nSafe note',
      },
    })

    const payload = JSON.stringify(provider.listUploads()[0]?.bundle)
    expect(payload).toContain('Safe note')
    expect(payload).toContain('OPENAI_API_KEY=[redacted]')
    expect(payload).not.toContain('upload-secret')
    expect(payload).not.toContain('sk-uploadsecret123456')
    expect(payload).not.toContain('authorization')
  })

  test('viewer provider sanitizes upload and update bundles at the provider seam', async () => {
    const bodies: string[] = []
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(String(init?.body ?? ''))
      return new Response(JSON.stringify({ id: 'upload_session-secret', url: 'https://viewer.test/s/share_session-secret' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch
    const provider = createViewerShareProvider({ viewerUrl: 'https://viewer.test', fetchFn })

    await provider.uploadBundle({
      sessionId: 'session-secret',
      bundle: {
        authorization: 'Bearer viewer-upload-secret',
        content: 'OPENAI_API_KEY=sk-viewerupload123456\nSafe upload',
      },
    })
    await provider.updateBundle({
      sessionId: 'session-secret',
      shareId: 'share_session-secret',
      currentUrl: 'https://viewer.test/s/share_session-secret',
      bundle: {
        rox_session: 'viewer-session-secret',
        content: 'DATABASE_PASSWORD=db-viewer-secret\nSafe update',
      },
    })

    const payload = JSON.stringify(bodies)
    expect(payload).toContain('Safe upload')
    expect(payload).toContain('Safe update')
    expect(payload).toContain('OPENAI_API_KEY=[redacted]')
    expect(payload).toContain('DATABASE_PASSWORD=[redacted]')
    expect(payload).not.toContain('viewer-upload-secret')
    expect(payload).not.toContain('sk-viewerupload123456')
    expect(payload).not.toContain('viewer-session-secret')
    expect(payload).not.toContain('db-viewer-secret')
    expect(payload).not.toContain('authorization')
    expect(payload).not.toContain('rox_session')
  })

  test('fake provider reports active and revoked share status deterministically', async () => {
    const provider = createFakeShareProvider({ baseUrl: 'https://viewer.test' })

    const upload = await provider.uploadBundle({ sessionId: 'session-status', bundle: { id: 'session-status' } })
    expect(upload.success).toBe(true)
    if (!upload.success) throw new Error('expected upload success')

    const shortlink = await provider.createShortlink({ sessionId: 'session-status', uploadId: upload.uploadId })
    expect(shortlink.success).toBe(true)
    if (!shortlink.success) throw new Error('expected shortlink success')

    expect(await provider.getShareStatus({ sessionId: 'session-status', shareId: shortlink.shareId })).toEqual({
      success: true,
      shareId: shortlink.shareId,
      status: 'active',
    })

    expect(await provider.revokeShare({ sessionId: 'session-status', shareId: shortlink.shareId })).toEqual({
      success: true,
    })
    expect(await provider.getShareStatus({ sessionId: 'session-status', shareId: shortlink.shareId })).toEqual({
      success: true,
      shareId: shortlink.shareId,
      status: 'revoked',
    })
  })

  test('maps provider failures back to session share results', () => {
    expect(mapShareProviderFailureToShareResult({
      success: false,
      code: 'auth_required',
      error: 'Sign in again.',
      retryable: false,
      status: 401,
    })).toEqual({
      success: false,
      code: 'auth_required',
      error: 'Sign in again.',
      status: 401,
    })
  })
})
