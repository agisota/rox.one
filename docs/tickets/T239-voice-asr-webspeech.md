# T239 - Composer voice-input ASR backend (Web Speech API)

Status: DONE
Phase: M.10

## Context

T238 (PR #123) shipped the voice-input slot at
`apps/electron/src/renderer/components/app-shell/input/` as a
disabled placeholder with two artefacts: the pure state machine in
`voice-input-state.ts` and the presentational button in
`VoiceInputSlot.tsx`. T239 plugs in the first real ASR backend by
wrapping the browser-native Web Speech API
(`window.SpeechRecognition` or the webkit-prefixed sibling) so the
slot becomes interactive on Chromium-family runtimes while staying
in T238's placeholder mode everywhere else.

## Scope

- `apps/electron/src/renderer/components/app-shell/input/voice-asr-webspeech.ts` —
  `createWebSpeechRecognizer({ lang, continuous, interimResults })`
  factory that returns `{ start, stop, onResult, onError }` and
  maps each callback onto T238's `VoiceInputEvent` shape. Returns
  `null` when the API is missing — slot stays disabled.
- `apps/electron/src/renderer/components/app-shell/input/__tests__/voice-asr-webspeech.test.ts` —
  bun:test coverage using a structural `MockRecognizer` and an
  injected `globalObject`. 18 cases, 36 expects.
- `VoiceInputSlot.tsx` — additive props (`onStop`, `recording`)
  wired so the same button toggles capture on/off and surfaces an
  `aria-pressed` + `data-recording` hook for assistive tech and
  RTL assertions. T238 callers keep their behaviour unchanged
  because every new prop is optional.
- `FreeFormInput.tsx` — constructs the recognizer at first render
  via a `useRef` so the platform probe runs exactly once, wires
  `onResult` / `onError` into the reducer, and threads `onStart` /
  `onStop` / `recording` down to the slot. When the recognizer is
  `null` (unsupported browser), the slot falls back to the T238
  placeholder automatically.
- `voice-input-slot.rtl.test.tsx` — extended with four
  recording-mode cases covering toggle behaviour, the aria-pressed
  surface, and the no-stop fallback contract.

## Out of scope (follow-up T239b)

- Alternate ASR providers (Whisper, cloud) behind a discriminated
  union — the factory is intentionally narrow so the provider seam
  lands in a separate ticket.
- Live waveform / volume meter visualisation.
- Persisting the interim transcript stream into the textarea
  (current wiring only updates state-machine kind; the host can
  surface partials in a follow-up once UX is signed off).

## Validation gates

- `bun test voice-asr-webspeech.test.ts` — 18 pass / 36 expects.
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pass.
- `bun run validate:roadmap` — pass.

## Rollback

Revert PR; T238 placeholder behaviour is restored automatically
because the slot's new props are additive and the FreeFormInput
wiring is gated on `voiceRecognizer !== null`.

## Follow-ups

- **T239b** — alternate provider seam (whisper.cpp / cloud) +
  provider-pick UX.
