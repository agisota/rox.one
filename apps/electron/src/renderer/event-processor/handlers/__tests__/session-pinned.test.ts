import { describe, expect, it } from 'bun:test'
import { handleSessionPinned, handleSessionUnpinned } from '../session'
import type { SessionPinnedEvent, SessionState, SessionUnpinnedEvent } from '../../types'

function makeState(pinnedAt?: number): SessionState {
  return {
    session: {
      id: 'session-1',
      messages: [],
      lastMessageAt: 100,
      pinnedAt,
    } as any,
    streaming: null,
  }
}

describe('session pin events', () => {
  it('applies pinnedAt from session_pinned events', () => {
    const event: SessionPinnedEvent = {
      type: 'session_pinned',
      sessionId: 'session-1',
      pinnedAt: 200,
    }

    const next = handleSessionPinned(makeState(), event)
    expect(next.state.session.pinnedAt).toBe(200)
    expect(next.effects).toEqual([])
  })

  it('clears pinnedAt from session_unpinned events', () => {
    const event: SessionUnpinnedEvent = {
      type: 'session_unpinned',
      sessionId: 'session-1',
    }

    const next = handleSessionUnpinned(makeState(200), event)
    expect(next.state.session.pinnedAt).toBeUndefined()
    expect(next.effects).toEqual([])
  })
})
