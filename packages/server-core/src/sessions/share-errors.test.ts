import { describe, expect, test } from 'bun:test'

import { createViewerShareFailureResult } from './share-errors'

describe('viewer share error mapping', () => {
  test('maps auth failures to an actionable account error', () => {
    expect(createViewerShareFailureResult(401, 'Unauthorized')).toEqual({
      success: false,
      code: 'auth_required',
      status: 401,
      error: 'Authentication required to create a public session link. Sign in again in Account and retry.',
    })

    expect(createViewerShareFailureResult(403, 'Forbidden').code).toBe('auth_required')
  })

  test('keeps payload too large distinct from generic viewer failures', () => {
    expect(createViewerShareFailureResult(413, 'Payload Too Large')).toEqual({
      success: false,
      code: 'payload_too_large',
      status: 413,
      error: 'Session too large to share',
    })
  })

  test('includes HTTP status for viewer failures instead of hiding the cause', () => {
    expect(createViewerShareFailureResult(502, 'Bad Gateway')).toEqual({
      success: false,
      code: 'viewer_unavailable',
      status: 502,
      error: 'Failed to upload session: viewer returned HTTP 502 Bad Gateway',
    })
  })
})
