# T238 - Composer voice-input toolbar slot (placeholder)

Status: DONE
Phase: M.10

## Context

M.10 Composer Pillar 4 closeout. T234 (history), T235/T235b (emphasis
toolbar + wiring), T236 (line numbers), T237 (paste-image preview)
already shipped or in flight. T238 lands the **last** Pillar 4
sub-feature: a UI slot for a voice-input button next to the emphasis
toolbar. The ASR (automatic speech recognition) backend integration
is **out of scope** — T239 (future) plugs the real provider in.

## Scope

- `apps/electron/src/renderer/components/app-shell/input/VoiceInputSlot.tsx` —
  presentational microphone button with `aria-label` + tooltip
  "Voice input — Coming soon". When `onStart` prop is absent the
  button is disabled (placeholder mode).
- `apps/electron/src/renderer/components/app-shell/input/voice-input-state.ts` —
  pure state machine union: `Idle | Recording | Transcribing | Error`.
  No Web Audio / mediaDevices calls — those land in T239.
- `FreeFormInput.tsx` — wires the slot into the emphasis toolbar row
  with `onStart={undefined}` (disabled placeholder).
- 2 i18n keys × 8 locales:
  - `workbench.composer.voiceInput.aria-label`
  - `workbench.composer.voiceInput.comingSoon`

## Out of scope (T239)

- Real `mediaDevices.getUserMedia` capture.
- ASR provider integration (Whisper, browser SpeechRecognition).
- Final waveform / volume meter visualization.

## Validation gates

- `bun test voice-input-state.test.ts` — pure state machine cases.
- `bun run lint:i18n:parity` — pass (8 locales).
- `bun run validate:agent-contract` — pass.
- `bun run validate:roadmap` — pass.

## Follow-ups

- **T239** — ASR backend wiring (provider abstraction + real capture).
