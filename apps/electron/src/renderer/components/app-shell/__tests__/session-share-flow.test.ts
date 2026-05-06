import { describe, expect, test } from 'bun:test'

import {
  createShareFlowController,
  getShareFailureState,
  getShareStatusState,
  type SessionShareFlowState,
} from '../session-share-flow'

describe('session share flow state', () => {
  test('maps public share failures to deterministic UI states', () => {
    expect(getShareFailureState({ success: false, code: 'auth_required', error: 'Sign in' })).toEqual({
      state: 'auth_required',
      retryable: false,
      message: 'Sign in',
    })
    expect(getShareFailureState({ success: false, code: 'viewer_unavailable', error: 'Viewer down' })).toEqual({
      state: 'failed_retryable',
      retryable: true,
      message: 'Viewer down',
    })
    expect(getShareFailureState({ success: false, code: 'invalid_public_url', error: 'Local URL' })).toEqual({
      state: 'failed_permanent',
      retryable: false,
      message: 'Local URL',
    })
  })

  test('maps provider status into copied and revoked feedback states', () => {
    expect(getShareStatusState({ success: true, shareId: 'share-1', status: 'active' })).toBe('copied')
    expect(getShareStatusState({ success: true, shareId: 'share-1', status: 'revoked' })).toBe('revoked')
    expect(getShareStatusState({ success: true, shareId: 'share-1', status: 'expired' })).toBe('failed_permanent')
  })

  test('runs share creation through preparing, uploading, creating link, and copied states', async () => {
    const states: SessionShareFlowState[] = []
    const controller = createShareFlowController({
      onStateChange: (state) => states.push(state),
      copyToClipboard: async () => {},
      createShare: async () => ({ success: true, url: 'https://viewer.test/s/share_1' }),
    })

    await controller.share()

    expect(states.map(state => state.state)).toEqual([
      'preparing',
      'uploading',
      'creating_link',
      'copied',
    ])
    expect(states.at(-1)).toEqual({
      state: 'copied',
      retryable: false,
      url: 'https://viewer.test/s/share_1',
    })
  })

  test('retryable failure can retry through the same controller', async () => {
    const states: SessionShareFlowState[] = []
    let attempt = 0
    const controller = createShareFlowController({
      onStateChange: (state) => states.push(state),
      copyToClipboard: async () => {},
      createShare: async () => {
        attempt += 1
        if (attempt === 1) {
          return { success: false, code: 'viewer_unavailable', error: 'Viewer down' }
        }
        return { success: true, url: 'https://viewer.test/s/share_retry' }
      },
    })

    await controller.share()
    await controller.retry()

    expect(states.map(state => state.state)).toEqual([
      'preparing',
      'uploading',
      'creating_link',
      'failed_retryable',
      'preparing',
      'uploading',
      'creating_link',
      'copied',
    ])
  })

  test('revoke success enters revoked state', async () => {
    const states: SessionShareFlowState[] = []
    const controller = createShareFlowController({
      onStateChange: (state) => states.push(state),
      copyToClipboard: async () => {},
      createShare: async () => ({ success: true, url: 'https://viewer.test/s/share_1' }),
      revokeShare: async () => ({ success: true }),
    })

    await controller.revoke()

    expect(states).toEqual([{ state: 'revoked', retryable: false }])
  })
})
