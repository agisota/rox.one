import type { ShareResult } from '@rox-agent/shared/protocol'

export type ShareFailureCode =
  | 'auth_required'
  | 'payload_too_large'
  | 'viewer_unavailable'

export function createViewerShareFailureResult(status: number, statusText?: string): ShareResult {
  if (status === 401 || status === 403) {
    return {
      success: false,
      code: 'auth_required',
      status,
      error: 'Authentication required to create a public session link. Sign in again in Account and retry.',
    }
  }

  if (status === 413) {
    return {
      success: false,
      code: 'payload_too_large',
      status,
      error: 'Session too large to share',
    }
  }

  const suffix = statusText ? ` ${statusText}` : ''
  return {
    success: false,
    code: 'viewer_unavailable',
    status,
    error: `Failed to upload session: viewer returned HTTP ${status}${suffix}`,
  }
}
