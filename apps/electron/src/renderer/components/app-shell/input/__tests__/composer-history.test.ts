import { describe, it, expect } from 'bun:test'
import {
  MAX_COMPOSER_HISTORY,
  createComposerHistoryState,
  pushHistoryEntry,
  recallPrevious,
  recallNext,
  resetHistoryForSession,
  type ComposerHistoryState,
} from '../composer-history'

function makeState(overrides: Partial<ComposerHistoryState> = {}): ComposerHistoryState {
  return {
    ...createComposerHistoryState(),
    ...overrides,
  }
}

describe('composer-history', () => {
  describe('createComposerHistoryState', () => {
    it('starts with no entries, cursor at -1, empty scratch, no session', () => {
      const state = createComposerHistoryState()
      expect(state.entries).toEqual([])
      expect(state.cursor).toBe(-1)
      expect(state.scratch).toBe('')
      expect(state.sessionId).toBeNull()
    })
  })

  describe('pushHistoryEntry', () => {
    it('adds the message to the front and resets cursor', () => {
      const before = makeState({ cursor: 2 })
      const after = pushHistoryEntry(before, 'hello world', 1000)
      expect(after.entries.length).toBe(1)
      expect(after.entries[0]?.message).toBe('hello world')
      expect(after.entries[0]?.submittedAt).toBe(1000)
      expect(after.cursor).toBe(-1)
    })

    it('deduplicates consecutive identical messages', () => {
      const first = pushHistoryEntry(createComposerHistoryState(), 'same', 1)
      const second = pushHistoryEntry(first, 'same', 2)
      expect(second.entries.length).toBe(1)
      expect(second.entries[0]?.submittedAt).toBe(1)
    })

    it('caps history length at MAX_COMPOSER_HISTORY entries', () => {
      let state = createComposerHistoryState()
      for (let i = 0; i < MAX_COMPOSER_HISTORY + 5; i += 1) {
        state = pushHistoryEntry(state, `msg-${i}`, i)
      }
      expect(state.entries.length).toBe(MAX_COMPOSER_HISTORY)
      expect(state.entries[0]?.message).toBe(`msg-${MAX_COMPOSER_HISTORY + 4}`)
      // oldest entry should have rolled off
      expect(state.entries.find(e => e.message === 'msg-0')).toBeUndefined()
    })

    it('ignores empty or whitespace-only messages', () => {
      const state = createComposerHistoryState()
      expect(pushHistoryEntry(state, '', 1).entries).toEqual([])
      expect(pushHistoryEntry(state, '   ', 1).entries).toEqual([])
      expect(pushHistoryEntry(state, '\n\t', 1).entries).toEqual([])
    })

    it('clears scratch and cursor when a new entry lands', () => {
      const before = makeState({
        entries: [{ message: 'older', submittedAt: 0 }],
        cursor: 0,
        scratch: 'in-flight draft',
      })
      const after = pushHistoryEntry(before, 'new entry', 5)
      expect(after.cursor).toBe(-1)
      expect(after.scratch).toBe('')
      expect(after.entries[0]?.message).toBe('new entry')
    })
  })

  describe('recallPrevious', () => {
    it('is a no-op on empty state', () => {
      const state = createComposerHistoryState()
      const result = recallPrevious(state, 'whatever-typed')
      expect(result.changed).toBe(false)
      expect(result.next).toEqual(state)
    })

    it('captures scratch and moves cursor to 0 from -1', () => {
      const before = makeState({
        entries: [
          { message: 'b', submittedAt: 2 },
          { message: 'a', submittedAt: 1 },
        ],
      })
      const result = recallPrevious(before, 'in-progress')
      expect(result.changed).toBe(true)
      expect(result.message).toBe('b')
      expect(result.next.cursor).toBe(0)
      expect(result.next.scratch).toBe('in-progress')
    })

    it('walks cursor back through entries up to length - 1', () => {
      const initial = makeState({
        entries: [
          { message: 'c', submittedAt: 3 },
          { message: 'b', submittedAt: 2 },
          { message: 'a', submittedAt: 1 },
        ],
      })
      const r1 = recallPrevious(initial, '')
      expect(r1.message).toBe('c')
      expect(r1.next.cursor).toBe(0)

      const r2 = recallPrevious(r1.next, '')
      expect(r2.message).toBe('b')
      expect(r2.next.cursor).toBe(1)

      const r3 = recallPrevious(r2.next, '')
      expect(r3.message).toBe('a')
      expect(r3.next.cursor).toBe(2)

      const r4 = recallPrevious(r3.next, '')
      expect(r4.changed).toBe(false)
      expect(r4.next.cursor).toBe(2)
    })
  })

  describe('recallNext', () => {
    it('is a no-op when cursor is -1 (not recalling)', () => {
      const state = makeState({
        entries: [{ message: 'a', submittedAt: 1 }],
      })
      const result = recallNext(state)
      expect(result.changed).toBe(false)
      expect(result.next).toEqual(state)
    })

    it('walks cursor forward and returns the matching entry', () => {
      const state = makeState({
        entries: [
          { message: 'c', submittedAt: 3 },
          { message: 'b', submittedAt: 2 },
          { message: 'a', submittedAt: 1 },
        ],
        cursor: 2,
        scratch: 'draft',
      })
      const r1 = recallNext(state)
      expect(r1.changed).toBe(true)
      expect(r1.message).toBe('b')
      expect(r1.next.cursor).toBe(1)

      const r2 = recallNext(r1.next)
      expect(r2.message).toBe('c')
      expect(r2.next.cursor).toBe(0)
    })

    it('restores scratch and resets cursor to -1 when walking off the front', () => {
      const state = makeState({
        entries: [{ message: 'a', submittedAt: 1 }],
        cursor: 0,
        scratch: 'my draft',
      })
      const result = recallNext(state)
      expect(result.changed).toBe(true)
      expect(result.message).toBe('my draft')
      expect(result.next.cursor).toBe(-1)
      expect(result.next.scratch).toBe('')
    })
  })

  describe('resetHistoryForSession', () => {
    it('clears entries / scratch / cursor when session changes', () => {
      const before = makeState({
        entries: [{ message: 'a', submittedAt: 1 }],
        cursor: 0,
        scratch: 'draft',
        sessionId: 'session-old',
      })
      const after = resetHistoryForSession(before, 'session-new')
      expect(after.entries).toEqual([])
      expect(after.cursor).toBe(-1)
      expect(after.scratch).toBe('')
      expect(after.sessionId).toBe('session-new')
    })

    it('is a no-op when the session is unchanged', () => {
      const before = makeState({
        entries: [{ message: 'a', submittedAt: 1 }],
        cursor: 0,
        scratch: 'draft',
        sessionId: 'session-x',
      })
      const after = resetHistoryForSession(before, 'session-x')
      expect(after).toEqual(before)
    })

    it('binds the session id on first use', () => {
      const before = createComposerHistoryState()
      const after = resetHistoryForSession(before, 'session-1')
      expect(after.sessionId).toBe('session-1')
      expect(after.entries).toEqual([])
    })
  })
})
