/**
 * voice-asr-webspeech.ts (M.10 T239)
 *
 * Web Speech API adapter for the composer's voice-input slot. The factory
 * wraps the browser-native `SpeechRecognition` constructor (or its
 * `webkitSpeechRecognition` prefixed sibling) and exposes a small surface
 * that the slot can drive without ever touching the underlying recognizer
 * directly.
 *
 * Design notes
 * ------------
 * - **Browser-feature-detect first.** The factory returns `null` when
 *   neither `SpeechRecognition` nor `webkitSpeechRecognition` is exposed
 *   on `globalThis`. The voice-input slot stays in T238's disabled-
 *   placeholder mode when the factory returns `null` — no crash, no
 *   spurious permission prompt.
 * - **Mapping to T238's state machine.** Each handler the recognizer
 *   emits is translated into a `VoiceInputEvent` shape so the host can
 *   forward results straight into `voiceInputReducer` without bespoke
 *   adapter glue. Interim results stream a `transcript` payload; final
 *   results emit `stop` so the reducer transitions through transcribing.
 * - **No real microphone access in tests.** Constructor + start/stop are
 *   the only Web Speech API methods touched; consumers can swap a mock
 *   global in their test harness (see `voice-asr-webspeech.test.ts`).
 * - **T238 stays frozen.** This module does not import — and is not
 *   imported by — `voice-input-state.ts`. The reducer remains the single
 *   source of state truth; the factory only emits the event shapes the
 *   reducer accepts plus a streaming `transcript` callback for interim
 *   results that live outside the state machine.
 */

import type {
  VoiceInputErrorCode,
  VoiceInputEvent,
} from './voice-input-state'

/**
 * Subset of the Web Speech API SpeechRecognition surface we actually use.
 * Declared structurally so tests can supply a minimal mock without having
 * to satisfy the full lib.dom.d.ts ambient type. The Chrome/Safari runtime
 * objects are a superset of this shape.
 */
export interface WebSpeechRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null
  onerror: ((event: WebSpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

export interface WebSpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence?: number
}

export interface WebSpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  // Indexed access — alternative results per result entry.
  readonly [index: number]: WebSpeechRecognitionAlternative
}

export interface WebSpeechRecognitionEvent {
  readonly resultIndex: number
  readonly results: {
    readonly length: number
    readonly [index: number]: WebSpeechRecognitionResult
  }
}

export interface WebSpeechRecognitionErrorEvent {
  readonly error: string
}

/** Structural type for the constructor — `new SpeechRecognition()`. */
export type WebSpeechRecognitionCtor = new () => WebSpeechRecognition

/**
 * Factory options. Defaults mirror the common "single-utterance,
 * en-US, stream interim partials" recipe most ASR slots want.
 */
export interface CreateWebSpeechRecognizerOptions {
  /** BCP-47 language tag. Defaults to `'en-US'`. */
  readonly lang?: string
  /**
   * Whether to keep listening past the first silence boundary. Most
   * composer slots want `false` so the user gets a clean stop after
   * a single utterance — set to `true` for hands-free dictation.
   */
  readonly continuous?: boolean
  /**
   * Whether to stream interim partials through `onResult`. Defaults
   * to `true` so the slot can render a live transcript preview.
   */
  readonly interimResults?: boolean
  /**
   * Test/SSR seam — inject a custom global object. Defaults to
   * `globalThis`. The factory probes both `SpeechRecognition` and
   * `webkitSpeechRecognition` on whatever is passed in.
   */
  readonly globalObject?: typeof globalThis
}

/**
 * Callback surface returned by `createWebSpeechRecognizer`. The shape
 * is deliberately small — three event sinks plus start/stop — so the
 * host can wire them straight into the T238 reducer without an adapter.
 */
export interface WebSpeechRecognizer {
  /** Begin a recognition session. Emits a `start` event on success. */
  start(): void
  /** Gracefully end the session (final result still fires through `onResult`). */
  stop(): void
  /**
   * Register a handler for transcript updates. Fires for each interim
   * partial when `interimResults` is true, and once more when the final
   * result lands. The payload includes a `state-machine event` field so
   * the host can dispatch it straight into `voiceInputReducer`.
   */
  onResult(handler: (payload: WebSpeechRecognizerResult) => void): void
  /**
   * Register a handler for error and end-of-session events. The payload
   * is already mapped to the state machine's `fail` event shape.
   */
  onError(handler: (payload: WebSpeechRecognizerError) => void): void
}

/**
 * Payload emitted by `onResult`. Carries the cumulative transcript text
 * (interim partials replace previous interim partials; the final result
 * carries the canonical version) plus a flag indicating whether the
 * recognizer is done with this utterance.
 */
export interface WebSpeechRecognizerResult {
  readonly transcript: string
  readonly isFinal: boolean
  /**
   * State-machine event the host should dispatch into the T238 reducer.
   * - Interim partials emit no event (`null`) — they're a streaming
   *   side-channel that lives outside the reducer's purview.
   * - The final result emits a `stop` event so the reducer transitions
   *   from recording into transcribing; the host then issues
   *   `transcribed` once it has applied the transcript to the textarea.
   */
  readonly event: VoiceInputEvent | null
}

/**
 * Payload emitted by `onError`. Always carries a mapped state-machine
 * `fail` event so the host can dispatch it directly. The raw browser
 * error string is preserved on `rawError` for telemetry / debugging.
 */
export interface WebSpeechRecognizerError {
  readonly code: VoiceInputErrorCode
  readonly rawError: string
  readonly event: Extract<VoiceInputEvent, { type: 'fail' }>
}

/**
 * Probe the supplied global for the Web Speech API constructor.
 * Exported separately so the slot can render a "feature unavailable"
 * hint without instantiating a recognizer.
 */
export function getWebSpeechRecognitionCtor(
  globalObject: typeof globalThis = globalThis,
): WebSpeechRecognitionCtor | null {
  // Cast through a structural lookup — the lib.dom typings vary across
  // TS versions for the prefixed variant.
  const candidate =
    (globalObject as unknown as { SpeechRecognition?: WebSpeechRecognitionCtor })
      .SpeechRecognition ??
    (globalObject as unknown as {
      webkitSpeechRecognition?: WebSpeechRecognitionCtor
    }).webkitSpeechRecognition ??
    null
  return typeof candidate === 'function' ? candidate : null
}

/**
 * Map a raw browser SpeechRecognition error string onto the closed set
 * of state-machine error codes. Unknown errors collapse to
 * `'transcription-failed'` so the reducer always lands on a valid code.
 */
export function mapWebSpeechError(raw: string): VoiceInputErrorCode {
  // The Web Speech API spec defines a small set of error strings —
  // 'not-allowed' / 'service-not-allowed' are the permission-denied
  // signals; 'audio-capture' is the no-device signal; 'aborted' is
  // explicit cancellation; everything else (network, language-not-
  // supported, etc.) folds into the generic transcription failure.
  switch (raw) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission-denied'
    case 'audio-capture':
      return 'no-audio-device'
    case 'aborted':
      return 'aborted'
    default:
      return 'transcription-failed'
  }
}

/**
 * Build the cumulative transcript string from a SpeechRecognition
 * results list. The Web Speech API hands back a sparse array indexed
 * from `resultIndex`; we concatenate the highest-confidence alternative
 * from each entry to produce a single user-facing string.
 */
function readTranscript(event: WebSpeechRecognitionEvent): {
  transcript: string
  isFinal: boolean
} {
  let transcript = ''
  let isFinal = false
  for (let i = 0; i < event.results.length; i += 1) {
    const result = event.results[i]
    if (!result || result.length === 0) continue
    const top = result[0]
    if (!top) continue
    transcript += top.transcript
    if (result.isFinal) isFinal = true
  }
  return { transcript, isFinal }
}

/**
 * Construct a Web Speech API recognizer wrapped in the small surface
 * the voice-input slot consumes. Returns `null` when the API is
 * unavailable on the supplied global — the slot then stays in T238's
 * disabled-placeholder mode.
 *
 * Usage from the host:
 *   const recognizer = createWebSpeechRecognizer({ lang: 'en-US' })
 *   if (recognizer) {
 *     recognizer.onResult(({ transcript, isFinal, event }) => {
 *       setLivePreview(transcript)
 *       if (event) dispatch(event)
 *     })
 *     recognizer.onError(({ event }) => dispatch(event))
 *     // pass recognizer.start as `onStart` to the slot
 *   }
 */
export function createWebSpeechRecognizer(
  options: CreateWebSpeechRecognizerOptions = {},
): WebSpeechRecognizer | null {
  const globalObject = options.globalObject ?? globalThis
  const Ctor = getWebSpeechRecognitionCtor(globalObject)
  if (!Ctor) return null

  // Instantiate eagerly so configuration mistakes surface at slot mount
  // time, not at first click. The recognizer object is small and idle
  // until `start()` is called, so creating it up front is cheap.
  const recognition = new Ctor()
  recognition.lang = options.lang ?? 'en-US'
  recognition.continuous = options.continuous ?? false
  recognition.interimResults = options.interimResults ?? true

  // Handlers default to no-ops so the recognizer can fire events even
  // before the host has wired listeners (e.g. a result lands between
  // mount and `onResult` registration during async i18n hydration).
  let resultHandler: ((payload: WebSpeechRecognizerResult) => void) | null = null
  let errorHandler: ((payload: WebSpeechRecognizerError) => void) | null = null

  recognition.onresult = (event) => {
    if (!resultHandler) return
    const { transcript, isFinal } = readTranscript(event)
    resultHandler({
      transcript,
      isFinal,
      // Interim partials stay outside the reducer; only the final result
      // transitions recording → transcribing via a `stop` event. The host
      // then applies the transcript and fires `transcribed` itself.
      event: isFinal ? { type: 'stop' } : null,
    })
  }

  recognition.onerror = (event) => {
    if (!errorHandler) return
    const code = mapWebSpeechError(event.error)
    errorHandler({
      code,
      rawError: event.error,
      event: { type: 'fail', code },
    })
  }

  // `onend` fires after a graceful stop AND after errors — we don't
  // forward it as an event because the reducer already moved past
  // recording via the `stop` / `fail` paths. We keep the assignment so
  // future telemetry can hook in without re-touching this module.
  recognition.onend = null
  recognition.onstart = null

  return {
    start() {
      recognition.start()
    },
    stop() {
      recognition.stop()
    },
    onResult(handler) {
      resultHandler = handler
    },
    onError(handler) {
      errorHandler = handler
    },
  }
}
