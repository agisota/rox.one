import type { PublicShareStatusResult, ShareResult } from '@rox-one/shared/protocol'

export type SessionShareFlowStateName =
  | 'idle'
  | 'auth_required'
  | 'preparing'
  | 'uploading'
  | 'creating_link'
  | 'copied'
  | 'failed_retryable'
  | 'failed_permanent'
  | 'revoked'

export interface SessionShareFlowState {
  state: SessionShareFlowStateName
  retryable: boolean
  message?: string
  url?: string
}

export interface SessionShareFlowControllerOptions {
  onStateChange: (state: SessionShareFlowState) => void
  copyToClipboard: (url: string) => Promise<void>
  createShare: () => Promise<ShareResult>
  revokeShare?: () => Promise<ShareResult>
}

export function getShareFailureState(result: ShareResult): SessionShareFlowState {
  const message = result.error
  if (result.code === 'auth_required') {
    return { state: 'auth_required', retryable: false, message }
  }
  if (result.code === 'viewer_unavailable' || result.code === 'expired') {
    return { state: 'failed_retryable', retryable: true, message }
  }
  return { state: 'failed_permanent', retryable: false, message }
}

export function getShareStatusState(result: PublicShareStatusResult): SessionShareFlowStateName {
  if (!result.success) return getShareFailureState(result).state
  if (result.status === 'active') return 'copied'
  if (result.status === 'revoked') return 'revoked'
  return 'failed_permanent'
}

export function createShareFlowController(options: SessionShareFlowControllerOptions) {
  async function share(): Promise<SessionShareFlowState> {
    options.onStateChange({ state: 'preparing', retryable: false })
    options.onStateChange({ state: 'uploading', retryable: false })
    options.onStateChange({ state: 'creating_link', retryable: false })

    const result = await options.createShare()
    if (!result.success || !result.url) {
      const failure = getShareFailureState(result)
      options.onStateChange(failure)
      return failure
    }

    await options.copyToClipboard(result.url)
    const copied: SessionShareFlowState = { state: 'copied', retryable: false, url: result.url }
    options.onStateChange(copied)
    return copied
  }

  async function revoke(): Promise<SessionShareFlowState> {
    const result = await options.revokeShare?.()
    if (!result?.success) {
      const failure = getShareFailureState(result ?? { success: false, error: 'Share revoke failed.' })
      options.onStateChange(failure)
      return failure
    }
    const revoked: SessionShareFlowState = { state: 'revoked', retryable: false }
    options.onStateChange(revoked)
    return revoked
  }

  return { share, retry: share, revoke }
}
