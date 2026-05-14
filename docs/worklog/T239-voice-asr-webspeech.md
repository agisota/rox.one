# T239 worklog — Composer voice-input ASR backend (Web Speech API)

## 1. Goal

Plug a real ASR backend into the T238 voice-input slot using the
browser-native Web Speech API. Keep the slot disabled on runtimes
where the API is absent. Do not touch T238's frozen state machine.

## 2. Approach

Three small layers:

1. **Factory** — `voice-asr-webspeech.ts` probes
   `SpeechRecognition` / `webkitSpeechRecognition` on a supplied
   `globalObject` (defaults to `globalThis`). Returns `null` on
   unsupported runtimes; otherwise builds a thin `{ start, stop,
   onResult, onError }` wrapper that translates raw browser
   events into the T238 `VoiceInputEvent` shape and a closed set
   of `VoiceInputErrorCode`s.
2. **Slot extension** — `VoiceInputSlot.tsx` gains two optional
   props (`onStop`, `recording`) plus `aria-pressed` /
   `data-recording` so the toggle behaviour is discoverable from
   the DOM. T238 callers are source-compatible.
3. **Host wiring** — `FreeFormInput.tsx` builds the recognizer
   once via `useRef`, owns the state via `useState` + manual
   reducer dispatch (state-machine file untouched), and threads
   start/stop/recording into the slot. When the recognizer is
   `null`, the slot falls back to T238 placeholder mode.

## 3. Files touched

| Path                                                                                            | Status |
| ----------------------------------------------------------------------------------------------- | ------ |
| `apps/electron/src/renderer/components/app-shell/input/voice-asr-webspeech.ts`                  | new (commit 3ef1193a) |
| `apps/electron/src/renderer/components/app-shell/input/__tests__/voice-asr-webspeech.test.ts`   | new (commit 3ef1193a) |
| `apps/electron/src/renderer/components/app-shell/input/VoiceInputSlot.tsx`                      | edited (additive props) |
| `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`                       | edited (recognizer construction + slot wiring) |
| `apps/electron/src/renderer/components/app-shell/input/__tests__/voice-input-slot.rtl.test.tsx` | edited (recording-mode cases) |
| `docs/tickets/T239-voice-asr-webspeech.md`                                                      | new    |
| `docs/worklog/T239-voice-asr-webspeech.md`                                                      | new    |

## 4. Decisions

- **Browser-feature-detect first.** The factory returns `null`
  instead of throwing so the slot can keep its T238 placeholder
  presentation on browsers / SSR contexts without
  `SpeechRecognition`. No try/catch needed in the host.
- **State machine stays frozen.** The reducer (`voice-input-
  state.ts`) is not modified; the host owns the reducer
  invocation via `useState` + `voiceInputReducer(...)`. New props
  on the slot (`onStop`, `recording`) are purely additive.
- **Interim partials don't dispatch reducer events.** Streaming
  preview is a side-channel (`onResult` carries a `transcript`
  string + `isFinal` flag). Only the final result emits a `stop`
  event so the reducer transitions recording → transcribing
  exactly once per utterance.
- **No real microphone access in tests.** The bun:test suite
  builds a structural `MockRecognizer` and injects it via a fake
  `globalObject`. No JSDOM, no permission prompts, no flakes.
- **Recording toggle without onStop is a no-op.** When the host
  hands the slot `recording=true` but omits `onStop`, the click
  intentionally does nothing — falling back to `onStart` would
  double-start a recognizer mid-session. Documented in the RTL
  suite.

## 5. Deviations

- The original prompt mentioned `'composer.voiceInput.*'` i18n
  keys for the new `Stop recording` tooltip; reused the existing
  `composer.voiceInput.aria-label` / `comingSoon` prefix from
  T238 with a new `composer.voiceInput.stop` fallback default
  string so i18n parity scaffolding remains the T238 surface
  (this is the same pragmatic decision T238's worklog called
  out). No new locale files were added in this commit because
  `t()` falls back to the supplied `defaultValue`; the parity
  lint passed.
- RTL test runtime: this worktree's `node_modules` is missing
  the root-level `react` copy that `vitest.config.ts` aliases to,
  so `bunx vitest` fails to bootstrap for **every** existing RTL
  test (verified against `button.rtl.test.tsx`). Pre-existing
  infra issue; cannot be fixed without `bun install`, which is
  banned by the ticket's strict rules. CI will run them.

## 6. Validation matrix

| Gate                                                  | Result                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| `bun test voice-asr-webspeech.test.ts`                | 18 pass / 0 fail / 36 expects                                 |
| `bun test voice-input-state.test.ts` (regression)     | 16 pass / 0 fail (T238 reducer untouched)                     |
| `bun run validate:rebrand`                            | pass                                                          |
| `bun run validate:agent-contract`                     | pass (11 skills, 315 tickets, 7 required docs)                |
| `bun run validate:roadmap`                            | pass (46 phases, 110 tickets)                                 |
| RTL `voice-input-slot.rtl.test.tsx`                   | blocked by pre-existing worktree infra (missing root react)   |

## 7. Follow-ups

- **T239b** — alternate ASR provider seam (whisper.cpp / cloud)
  + provider-pick UX. The current factory's return type is the
  natural place to plug a `Provider` discriminated union.
- Surface interim transcript partials into the textarea once UX
  signs off the visual treatment.

## 8. Closeout

- All M.10 voice-input pieces are in place: T238 placeholder
  slot (already on `main`) + T239 ASR backend (this PR). Web
  Speech API runtimes get an interactive button; everything else
  keeps the disabled placeholder until T239b lands an alternate
  provider.
