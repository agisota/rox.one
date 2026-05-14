/**
 * voice-asr-webspeech.test.ts (M.10 T239)
 *
 * Coverage for the Web Speech API factory. Tests build a `globalObject`
 * stub that exposes either `SpeechRecognition` or `webkitSpeechRecognition`
 * (or neither) and drive the factory + its registered handlers through
 * the surface methods. No real microphone access; no JSDOM required.
 */

import { describe, expect, it } from 'bun:test'

import {
  createWebSpeechRecognizer,
  getWebSpeechRecognitionCtor,
  mapWebSpeechError,
  type WebSpeechRecognition,
  type WebSpeechRecognitionEvent,
} from '../voice-asr-webspeech'

/**
 * Minimal mock recognizer that captures method calls and exposes its
 * registered event handlers so tests can fire synthetic results.
 */
class MockRecognizer implements WebSpeechRecognition {
  lang = ''
  continuous = false
  interimResults = false
  onresult: WebSpeechRecognition['onresult'] = null
  onerror: WebSpeechRecognition['onerror'] = null
  onend: WebSpeechRecognition['onend'] = null
  onstart: WebSpeechRecognition['onstart'] = null
  startCalls = 0
  stopCalls = 0
  abortCalls = 0
  start(): void {
    this.startCalls += 1
  }
  stop(): void {
    this.stopCalls += 1
  }
  abort(): void {
    this.abortCalls += 1
  }
}

/**
 * Build a `globalObject` shim that the factory can probe. Optionally
 * leaves both constructor slots undefined to model an unsupported browser.
 */
function buildGlobal(opts: {
  prefixed?: boolean
  unprefixed?: boolean
  factory?: () => MockRecognizer
} = {}): { global: typeof globalThis; lastInstance: () => MockRecognizer | null } {
  let last: MockRecognizer | null = null
  const factory = opts.factory ?? (() => new MockRecognizer())
  const ctor = function () {
    last = factory()
    return last
  } as unknown as new () => MockRecognizer
  const fakeGlobal: Record<string, unknown> = {}
  if (opts.unprefixed) fakeGlobal.SpeechRecognition = ctor
  if (opts.prefixed) fakeGlobal.webkitSpeechRecognition = ctor
  return {
    global: fakeGlobal as unknown as typeof globalThis,
    lastInstance: () => last,
  }
}

/**
 * Construct a synthetic SpeechRecognitionEvent shaped like the live
 * browser surface. `final` controls the `isFinal` flag on the result.
 */
function buildResultEvent(
  segments: ReadonlyArray<{ text: string; final: boolean }>,
): WebSpeechRecognitionEvent {
  const results = segments.map((seg) => {
    return {
      isFinal: seg.final,
      length: 1,
      0: { transcript: seg.text, confidence: 0.95 },
    } as unknown as WebSpeechRecognitionEvent['results'][number]
  }) as unknown as WebSpeechRecognitionEvent['results']
  // Attach a `length` property since arrays already have one, but cast
  // through to match the structural surface declared in the factory.
  Object.defineProperty(results, 'length', { value: segments.length })
  return { resultIndex: 0, results } as WebSpeechRecognitionEvent
}

describe('getWebSpeechRecognitionCtor - feature detection', () => {
  it('returns null when neither global is exposed (unsupported browser)', () => {
    const { global } = buildGlobal({})
    expect(getWebSpeechRecognitionCtor(global)).toBeNull()
  })

  it('returns the unprefixed constructor when SpeechRecognition is present', () => {
    const { global } = buildGlobal({ unprefixed: true })
    expect(typeof getWebSpeechRecognitionCtor(global)).toBe('function')
  })

  it('falls back to webkitSpeechRecognition when only the prefixed variant exists', () => {
    const { global } = buildGlobal({ prefixed: true })
    expect(typeof getWebSpeechRecognitionCtor(global)).toBe('function')
  })

  it('prefers the unprefixed constructor when both are present', () => {
    const unprefixedCtor = function Unprefixed() {} as unknown as new () => WebSpeechRecognition
    const prefixedCtor = function Prefixed() {} as unknown as new () => WebSpeechRecognition
    const fake = {
      SpeechRecognition: unprefixedCtor,
      webkitSpeechRecognition: prefixedCtor,
    } as unknown as typeof globalThis
    expect(getWebSpeechRecognitionCtor(fake)).toBe(unprefixedCtor)
  })
})

describe('createWebSpeechRecognizer - construction & defaults', () => {
  it('returns null on an unsupported global (slot keeps T238 placeholder)', () => {
    const { global } = buildGlobal({})
    expect(createWebSpeechRecognizer({ globalObject: global })).toBeNull()
  })

  it('applies the documented defaults when no options are supplied', () => {
    const { global, lastInstance } = buildGlobal({ unprefixed: true })
    const recognizer = createWebSpeechRecognizer({ globalObject: global })
    expect(recognizer).not.toBeNull()
    const instance = lastInstance()
    expect(instance).not.toBeNull()
    expect(instance?.lang).toBe('en-US')
    expect(instance?.continuous).toBe(false)
    expect(instance?.interimResults).toBe(true)
  })

  it('forwards explicit options onto the recognizer instance', () => {
    const { global, lastInstance } = buildGlobal({ unprefixed: true })
    createWebSpeechRecognizer({
      globalObject: global,
      lang: 'de-DE',
      continuous: true,
      interimResults: false,
    })
    const instance = lastInstance()
    expect(instance?.lang).toBe('de-DE')
    expect(instance?.continuous).toBe(true)
    expect(instance?.interimResults).toBe(false)
  })
})

describe('createWebSpeechRecognizer - start / stop wiring', () => {
  it('calls into the underlying recognizer on start() and stop()', () => {
    const { global, lastInstance } = buildGlobal({ unprefixed: true })
    const recognizer = createWebSpeechRecognizer({ globalObject: global })!
    recognizer.start()
    recognizer.start()
    recognizer.stop()
    const instance = lastInstance()!
    expect(instance.startCalls).toBe(2)
    expect(instance.stopCalls).toBe(1)
  })
})

describe('createWebSpeechRecognizer - onResult dispatch', () => {
  it('streams interim partials without emitting a state-machine event', () => {
    const { global, lastInstance } = buildGlobal({ unprefixed: true })
    const recognizer = createWebSpeechRecognizer({ globalObject: global })!
    const calls: Array<{ transcript: string; isFinal: boolean; event: unknown }> = []
    recognizer.onResult((payload) => calls.push(payload))
    lastInstance()!.onresult!(buildResultEvent([{ text: 'hel', final: false }]))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ transcript: 'hel', isFinal: false, event: null })
  })

  it('emits a stop event when the final result lands', () => {
    const { global, lastInstance } = buildGlobal({ unprefixed: true })
    const recognizer = createWebSpeechRecognizer({ globalObject: global })!
    const calls: Array<{ transcript: string; isFinal: boolean; event: unknown }> = []
    recognizer.onResult((payload) => calls.push(payload))
    lastInstance()!.onresult!(buildResultEvent([{ text: 'hello world', final: true }]))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.isFinal).toBe(true)
    expect(calls[0]?.transcript).toBe('hello world')
    expect(calls[0]?.event).toEqual({ type: 'stop' })
  })

  it('concatenates multi-segment results into a single transcript string', () => {
    const { global, lastInstance } = buildGlobal({ unprefixed: true })
    const recognizer = createWebSpeechRecognizer({ globalObject: global })!
    let captured = ''
    recognizer.onResult((payload) => {
      captured = payload.transcript
    })
    lastInstance()!.onresult!(
      buildResultEvent([
        { text: 'hello ', final: true },
        { text: 'world', final: true },
      ]),
    )
    expect(captured).toBe('hello world')
  })

  it('is a no-op when no result handler has been registered yet', () => {
    const { global, lastInstance } = buildGlobal({ unprefixed: true })
    createWebSpeechRecognizer({ globalObject: global })
    // No registration → no throw when the recognizer fires.
    expect(() => {
      lastInstance()!.onresult!(buildResultEvent([{ text: 'hi', final: true }]))
    }).not.toThrow()
  })
})

describe('createWebSpeechRecognizer - onError mapping', () => {
  it('translates not-allowed into permission-denied', () => {
    const { global, lastInstance } = buildGlobal({ unprefixed: true })
    const recognizer = createWebSpeechRecognizer({ globalObject: global })!
    const errors: Array<{ code: string; rawError: string }> = []
    recognizer.onError((payload) => errors.push(payload))
    lastInstance()!.onerror!({ error: 'not-allowed' })
    expect(errors[0]?.code).toBe('permission-denied')
    expect(errors[0]?.rawError).toBe('not-allowed')
  })

  it('translates audio-capture into no-audio-device', () => {
    const { global, lastInstance } = buildGlobal({ unprefixed: true })
    const recognizer = createWebSpeechRecognizer({ globalObject: global })!
    let captured: { code?: string; event?: unknown } = {}
    recognizer.onError((payload) => {
      captured = payload
    })
    lastInstance()!.onerror!({ error: 'audio-capture' })
    expect(captured.code).toBe('no-audio-device')
    expect(captured.event).toEqual({ type: 'fail', code: 'no-audio-device' })
  })

  it('translates aborted into the aborted code', () => {
    const { global, lastInstance } = buildGlobal({ unprefixed: true })
    const recognizer = createWebSpeechRecognizer({ globalObject: global })!
    let code = ''
    recognizer.onError((payload) => {
      code = payload.code
    })
    lastInstance()!.onerror!({ error: 'aborted' })
    expect(code).toBe('aborted')
  })

  it('collapses unknown errors into transcription-failed', () => {
    const { global, lastInstance } = buildGlobal({ unprefixed: true })
    const recognizer = createWebSpeechRecognizer({ globalObject: global })!
    let code = ''
    recognizer.onError((payload) => {
      code = payload.code
    })
    lastInstance()!.onerror!({ error: 'network' })
    expect(code).toBe('transcription-failed')
  })

  it('is a no-op when no error handler is registered', () => {
    const { global, lastInstance } = buildGlobal({ unprefixed: true })
    createWebSpeechRecognizer({ globalObject: global })
    expect(() => {
      lastInstance()!.onerror!({ error: 'not-allowed' })
    }).not.toThrow()
  })
})

describe('mapWebSpeechError - direct helper', () => {
  it('covers the documented raw-error vocabulary', () => {
    expect(mapWebSpeechError('not-allowed')).toBe('permission-denied')
    expect(mapWebSpeechError('service-not-allowed')).toBe('permission-denied')
    expect(mapWebSpeechError('audio-capture')).toBe('no-audio-device')
    expect(mapWebSpeechError('aborted')).toBe('aborted')
    expect(mapWebSpeechError('language-not-supported')).toBe('transcription-failed')
    expect(mapWebSpeechError('')).toBe('transcription-failed')
  })
})
