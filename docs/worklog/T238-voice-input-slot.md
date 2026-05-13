# T238 worklog — Composer voice-input slot (placeholder)

## 1. Goal

Land the M.10 Composer Pillar 4 closeout sub-feature: a UI slot for
a voice-input button next to the emphasis toolbar. ASR backend out
of scope; placeholder ships disabled with a "Coming soon" tooltip.

## 2. Approach

Three layers, all small:

1. **Pure state machine** in `voice-input-state.ts` — `Idle |
   Recording | Transcribing | Error` union with a pure reducer.
   No DOM / Web Audio access.
2. **Presentational slot** in `VoiceInputSlot.tsx` — microphone
   button with i18n'd aria-label + tooltip; disabled when `onStart`
   absent.
3. **Wiring** into `FreeFormInput.tsx` — slot rendered in the
   emphasis toolbar row, after the 4 emphasis buttons, with
   `onStart={undefined}` for now.

i18n: 2 keys across all 8 locales.

## 3. Files touched

| Path                                                                                                | Status |
| --------------------------------------------------------------------------------------------------- | ------ |
| `apps/electron/src/renderer/components/app-shell/input/voice-input-state.ts`                        | new (commit f8058fa1) |
| `apps/electron/src/renderer/components/app-shell/input/__tests__/voice-input-state.test.ts`         | new (commit f8058fa1) |
| `apps/electron/src/renderer/components/app-shell/input/VoiceInputSlot.tsx`                          | new (commit c178beee) |
| `apps/electron/src/renderer/components/app-shell/input/__tests__/voice-input-slot.rtl.test.tsx`     | new (commit c178beee) |
| `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`                           | edited (toolbar row composition + slot import) |
| `packages/shared/src/i18n/locales/{en,de,es,hu,ja,pl,ru,zh-Hans}.json`                              | edited (2 keys × 8 locales) |
| `docs/tickets/T238-voice-input-slot.md`                                                             | new    |
| `docs/worklog/T238-voice-input-slot.md`                                                             | new    |

## 4. Decisions

- **Placeholder, not stub**. The component compiles and renders;
  it just has no `onStart` wired so the button is disabled and the
  tooltip is "Coming soon". This avoids dead code while T239 plugs
  in the real capture path.
- **State machine separate from component**. Tests can fuzz the
  state machine without touching the DOM.
- **i18n tokens use `workbench.composer.voiceInput.*` prefix** to
  match the existing `workbench.composer.emphasis.*` and
  `workbench.composer.permission.*` siblings.

## 5. Deviations

- Original prompt said `composer.voiceInput.*` for the keys;
  matched the actual codebase prefix `workbench.composer.*` to
  keep i18n parity / alphabetical sort consistent.
- Branch closes M.10 Pillar 4 alongside T237 (paste-image
  preview) when both PRs land on `main`.

## 6. Validation matrix

| Gate                                          | Result                                  |
| --------------------------------------------- | --------------------------------------- |
| `bun test voice-input-state.test.ts`          | pass (covered by f8058fa1)              |
| `bun run lint:i18n:parity`                    | pass (8 locales)                        |
| `bun run validate:agent-contract`             | pass                                    |
| `bun run validate:roadmap`                    | pass                                    |

## 7. Follow-ups

- **T239** — real ASR backend wiring (provider abstraction + Web
  Audio capture).

## 8. Closeout

- All five M.10 Pillar 4 sub-features have shipped (T234 history,
  T235/T235b emphasis, T236 line-numbers, T237 paste-image,
  T238 voice slot). Pillar 4 closed at the composer surface.
