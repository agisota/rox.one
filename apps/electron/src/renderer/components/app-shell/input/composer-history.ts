/**
 * Composer history store. Per-session, in-memory stack of submitted
 * messages with an ArrowUp / ArrowDown recall cursor.
 *
 * Pillar 4 sub-feature 1 (T234). Pure helper module — no React or DOM
 * dependencies. Wired into FreeFormInput.tsx by holding the state in a
 * ref and threading the helpers through the submit + key-down paths.
 */

export const MAX_COMPOSER_HISTORY = 50

export interface ComposerHistoryEntry {
  message: string
  submittedAt: number
}

export interface ComposerHistoryState {
  entries: ComposerHistoryEntry[]
  /** -1 means "not recalling"; 0 = most recent submission. */
  cursor: number
  /** Text the user had typed before recall started; restored on walk-forward. */
  scratch: string
  /** Bound session id; resetHistoryForSession clears on change. */
  sessionId: string | null
}

export interface RecallResult {
  changed: boolean
  message: string
  next: ComposerHistoryState
}

/** Fresh empty state. */
export function createComposerHistoryState(): ComposerHistoryState {
  return {
    entries: [],
    cursor: -1,
    scratch: '',
    sessionId: null,
  }
}

/**
 * Push a submitted message onto the history stack.
 * - Trims; ignores empty / whitespace-only.
 * - Dedupes consecutive identical entries.
 * - Caps at MAX_COMPOSER_HISTORY.
 * - Resets cursor and scratch.
 */
export function pushHistoryEntry(
  state: ComposerHistoryState,
  message: string,
  submittedAt: number,
): ComposerHistoryState {
  const trimmed = message.trim()
  if (!trimmed) {
    return state
  }

  const head = state.entries[0]
  if (head && head.message === trimmed) {
    return {
      entries: state.entries,
      cursor: -1,
      scratch: '',
      sessionId: state.sessionId,
    }
  }

  const next: ComposerHistoryEntry = { message: trimmed, submittedAt }
  const entries = [next, ...state.entries].slice(0, MAX_COMPOSER_HISTORY)
  return {
    entries,
    cursor: -1,
    scratch: '',
    sessionId: state.sessionId,
  }
}

/**
 * Recall the previous (older) entry.
 *
 * From `cursor === -1`, captures `currentInput` into `scratch` and moves
 * to cursor 0. Subsequent calls walk back up to `entries.length - 1`.
 *
 * Returns `changed: false` when there is nothing further back to recall.
 */
export function recallPrevious(
  state: ComposerHistoryState,
  currentInput: string,
): RecallResult {
  if (state.entries.length === 0) {
    return { changed: false, message: currentInput, next: state }
  }

  if (state.cursor === -1) {
    const target = state.entries[0]
    if (!target) {
      return { changed: false, message: currentInput, next: state }
    }
    return {
      changed: true,
      message: target.message,
      next: {
        entries: state.entries,
        cursor: 0,
        scratch: currentInput,
        sessionId: state.sessionId,
      },
    }
  }

  const nextCursor = state.cursor + 1
  if (nextCursor >= state.entries.length) {
    return { changed: false, message: '', next: state }
  }
  const target = state.entries[nextCursor]
  if (!target) {
    return { changed: false, message: '', next: state }
  }
  return {
    changed: true,
    message: target.message,
    next: {
      entries: state.entries,
      cursor: nextCursor,
      scratch: state.scratch,
      sessionId: state.sessionId,
    },
  }
}

/**
 * Recall the next (newer) entry.
 *
 * From `cursor === 0`, returns the saved scratch and resets cursor to -1.
 * From `cursor > 0`, walks toward more recent entries.
 *
 * Returns `changed: false` when not recalling (cursor === -1).
 */
export function recallNext(state: ComposerHistoryState): RecallResult {
  if (state.cursor < 0) {
    return { changed: false, message: '', next: state }
  }

  if (state.cursor === 0) {
    return {
      changed: true,
      message: state.scratch,
      next: {
        entries: state.entries,
        cursor: -1,
        scratch: '',
        sessionId: state.sessionId,
      },
    }
  }

  const nextCursor = state.cursor - 1
  const target = state.entries[nextCursor]
  if (!target) {
    return { changed: false, message: '', next: state }
  }
  return {
    changed: true,
    message: target.message,
    next: {
      entries: state.entries,
      cursor: nextCursor,
      scratch: state.scratch,
      sessionId: state.sessionId,
    },
  }
}

/**
 * Bind a session id (and clear history when it changes).
 *
 * No-op when the incoming session is identical to the bound one.
 */
export function resetHistoryForSession(
  state: ComposerHistoryState,
  sessionId: string,
): ComposerHistoryState {
  if (state.sessionId === sessionId) {
    return state
  }
  return {
    entries: [],
    cursor: -1,
    scratch: '',
    sessionId,
  }
}
