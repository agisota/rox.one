import { describe, expect, test } from 'bun:test'

import {
  assertPublicShareUrl,
  createFakeShareProvider,
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
