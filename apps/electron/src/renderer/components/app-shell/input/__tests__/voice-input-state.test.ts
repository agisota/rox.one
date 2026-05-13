/**
 * voice-input-state.test.ts (M.10 T238)
 *
 * Coverage for the pure voice-input state machine. The reducer is
 * framework-free — these tests do not need React, JSDOM, or any timer
 * fakes; every transition is exercised by feeding `voiceInputReducer` a
 * starting state plus an event and asserting on the returned state.
 */

import { describe, expect, it } from 'bun:test'

import {
  VOICE_INPUT_INITIAL_STATE,
  isDisabledPlaceholder,
  voiceInputReducer,
  type VoiceInputState,
} from '../voice-input-state'

describe('voice-input-state initial', () => {
  it('boots into idle and is frozen so callers cannot mutate the singleton', () => {
    expect(VOICE_INPUT_INITIAL_STATE.kind).toBe('idle')
    expect(Object.isFrozen(VOICE_INPUT_INITIAL_STATE)).toBe(true)
  })
})

describe('voiceInputReducer - start transitions', () => {
  it('moves idle -> recording with the supplied timestamp', () => {
    const next = voiceInputReducer(VOICE_INPUT_INITIAL_STATE, {
      type: 'start',
      at: 1_700_000_000_000,
    })
    expect(next).toEqual({ kind: 'recording', startedAt: 1_700_000_000_000 })
  })

  it('moves error -> recording (operator retried after a failure)', () => {
    const start: VoiceInputState = { kind: 'error', code: 'aborted' }
    const next = voiceInputReducer(start, { type: 'start', at: 42 })
    expect(next).toEqual({ kind: 'recording', startedAt: 42 })
  })

  it('ignores duplicate start while already recording (identity-stable)', () => {
    const start: VoiceInputState = { kind: 'recording', startedAt: 10 }
    const next = voiceInputReducer(start, { type: 'start', at: 99 })
    expect(next).toBe(start)
  })
})

describe('voiceInputReducer - stop / transcribed / fail', () => {
  it('moves recording -> transcribing on stop', () => {
    const start: VoiceInputState = { kind: 'recording', startedAt: 10 }
    const next = voiceInputReducer(start, { type: 'stop' })
    expect(next).toEqual({ kind: 'transcribing' })
  })

  it('ignores stop from idle (no-op, identity-stable)', () => {
    const next = voiceInputReducer(VOICE_INPUT_INITIAL_STATE, { type: 'stop' })
    expect(next).toBe(VOICE_INPUT_INITIAL_STATE)
  })

  it('moves transcribing -> idle on transcribed', () => {
    const start: VoiceInputState = { kind: 'transcribing' }
    const next = voiceInputReducer(start, { type: 'transcribed' })
    expect(next.kind).toBe('idle')
  })

  it('lifts recording -> error with the supplied code', () => {
    const start: VoiceInputState = { kind: 'recording', startedAt: 1 }
    const next = voiceInputReducer(start, {
      type: 'fail',
      code: 'permission-denied',
    })
    expect(next).toEqual({ kind: 'error', code: 'permission-denied' })
  })

  it('lifts transcribing -> error with the supplied code', () => {
    const start: VoiceInputState = { kind: 'transcribing' }
    const next = voiceInputReducer(start, {
      type: 'fail',
      code: 'transcription-failed',
    })
    expect(next).toEqual({ kind: 'error', code: 'transcription-failed' })
  })

  it('ignores fail while idle (no phantom errors)', () => {
    const next = voiceInputReducer(VOICE_INPUT_INITIAL_STATE, {
      type: 'fail',
      code: 'aborted',
    })
    expect(next).toBe(VOICE_INPUT_INITIAL_STATE)
  })
})

describe('voiceInputReducer - reset', () => {
  it('returns identity when reset is fired from idle', () => {
    const next = voiceInputReducer(VOICE_INPUT_INITIAL_STATE, { type: 'reset' })
    expect(next).toBe(VOICE_INPUT_INITIAL_STATE)
  })

  it('returns idle when reset is fired from recording', () => {
    const start: VoiceInputState = { kind: 'recording', startedAt: 7 }
    expect(voiceInputReducer(start, { type: 'reset' })).toEqual({ kind: 'idle' })
  })

  it('returns idle when reset is fired from error', () => {
    const start: VoiceInputState = { kind: 'error', code: 'no-audio-device' }
    expect(voiceInputReducer(start, { type: 'reset' })).toEqual({ kind: 'idle' })
  })
})

describe('isDisabledPlaceholder', () => {
  it('is true while idle with no registered provider', () => {
    expect(isDisabledPlaceholder(VOICE_INPUT_INITIAL_STATE, false)).toBe(true)
  })

  it('flips to false once a provider is registered (T239 surface)', () => {
    expect(isDisabledPlaceholder(VOICE_INPUT_INITIAL_STATE, true)).toBe(false)
  })

  it('is never disabled when recording (slot must allow stop)', () => {
    const recording: VoiceInputState = { kind: 'recording', startedAt: 1 }
    expect(isDisabledPlaceholder(recording, false)).toBe(false)
  })
})
