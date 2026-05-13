/**
 * voice-input-state.ts (M.10 T238)
 *
 * Pure state machine that backs the composer's voice-input toolbar slot. The
 * actual speech recognition pipeline (Web Audio capture, ASR provider call,
 * partial-transcript streaming) is intentionally OUT OF SCOPE for T238 — it
 * lands in T239 once a provider is picked. This module ships only the shape
 * of the state graph so the UI slot has a stable surface to render against
 * and the future ASR adapter has a fixed contract to plug into.
 *
 * Design notes:
 *   - The reducer is a single pure function `voiceInputReducer(state, event)`
 *     with no side-effects. No `mediaDevices`, no `AudioContext`, no fetch.
 *   - Transitions are deliberately conservative: only the transitions a
 *     real ASR session needs (start → recording → stop → transcribing →
 *     done / error) are accepted. Out-of-order events are ignored — the
 *     reducer returns the previous state instead of throwing so the UI can
 *     never crash a render on a stale event.
 *   - The error state carries a stable `code` so the slot tooltip can
 *     surface a translated message in T239 without leaking provider
 *     internals through the UI.
 */

/**
 * Discriminated union for every state the voice-input slot can be in. T238
 * only renders `Idle` (the placeholder microphone button) but the full union
 * ships now so the slot and the future ASR adapter both compile against the
 * same surface from day one.
 */
export type VoiceInputState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'recording'; readonly startedAt: number }
  | { readonly kind: 'transcribing' }
  | { readonly kind: 'error'; readonly code: VoiceInputErrorCode }

/**
 * Closed set of error codes the reducer can emit. Keeping this a string
 * union (rather than free-form strings) means the i18n layer can map every
 * code to a localised message at render time without runtime surprises.
 */
export type VoiceInputErrorCode =
  | 'permission-denied'
  | 'no-audio-device'
  | 'transcription-failed'
  | 'aborted'

/**
 * Events accepted by the reducer. `start` enters recording with a
 * monotonic timestamp so the UI can render an elapsed-time indicator
 * without consulting `Date.now()` on every paint.
 */
export type VoiceInputEvent =
  | { readonly type: 'start'; readonly at: number }
  | { readonly type: 'stop' }
  | { readonly type: 'transcribed' }
  | { readonly type: 'fail'; readonly code: VoiceInputErrorCode }
  | { readonly type: 'reset' }

/** Canonical initial state — the slot boots into idle. */
export const VOICE_INPUT_INITIAL_STATE: VoiceInputState = Object.freeze({
  kind: 'idle',
}) as VoiceInputState

/**
 * Pure reducer. Returns the previous state object reference (identity-stable)
 * when an event would otherwise be a no-op so React consumers can rely on
 * `Object.is` for memo equality and skip needless re-renders.
 */
export function voiceInputReducer(
  state: VoiceInputState,
  event: VoiceInputEvent,
): VoiceInputState {
  switch (event.type) {
    case 'start':
      // Only idle and error states can transition into recording. Mid-
      // recording 'start' events are dropped so a noisy producer cannot
      // restart the clock and confuse the elapsed-time indicator.
      if (state.kind === 'idle' || state.kind === 'error') {
        return { kind: 'recording', startedAt: event.at }
      }
      return state
    case 'stop':
      // 'stop' is only meaningful while recording — it hands control to
      // the transcription phase. Any other origin state is left alone.
      if (state.kind === 'recording') {
        return { kind: 'transcribing' }
      }
      return state
    case 'transcribed':
      // Transcription completion returns the slot to idle so a fresh
      // recording can begin without an explicit reset.
      if (state.kind === 'transcribing') {
        return { kind: 'idle' }
      }
      return state
    case 'fail':
      // Failure can land from recording or transcribing — both surface
      // the error to the user. Failing from idle is dropped to keep the
      // reducer total without polluting idle with phantom errors.
      if (state.kind === 'recording' || state.kind === 'transcribing') {
        return { kind: 'error', code: event.code }
      }
      return state
    case 'reset':
      // Reset always returns to idle — it's the operator's escape hatch
      // and must work from any state.
      return state.kind === 'idle' ? state : { kind: 'idle' }
  }
}

/**
 * Convenience predicate: true when the slot should render its disabled
 * placeholder. Used by the slot component while T239's ASR adapter has not
 * yet registered a real provider — at that point `isDisabled` flips to false
 * for the idle state and the button becomes interactive.
 */
export function isDisabledPlaceholder(
  state: VoiceInputState,
  hasProvider: boolean,
): boolean {
  return state.kind === 'idle' && !hasProvider
}
