# T235 - Composer emphasis-modes toolbar (B/I/`/S + shortcuts)

Status: DONE
Phase: M.10

## Context

M.10 Composer Pillar 4 spec (T233, on `main`) defines five Pillar 4
sub-features. T234 (already merged) added composer history recall.
T235 ships the second Pillar 4 sub-feature: pure
`toggleEmphasis` helper plus an `EmphasisToolbar.tsx` presentational
component for bold / italic / inline-code / strikethrough modes.

Per spec, keyboard shortcuts are `Cmd+B`, `Cmd+I`, `` Cmd+` ``, and
`Cmd+Shift+X` (Windows/Linux use `Ctrl+` modifier).

## Scope

- `apps/electron/src/renderer/components/app-shell/input/emphasis-mode.ts` —
  pure helpers:
  - `EmphasisMode` union (`'bold' | 'italic' | 'code' | 'strike'`)
  - `EMPHASIS_MARKERS` (frozen lookup: bold='**', italic='_', code='\`',
    strike='~~')
  - `toggleEmphasis(value, selection, mode) → { next, nextSelection }`
    handling word selection, line selection, empty selection, and
    nested toggling (bold-italic).
  - `EMPHASIS_SHORTCUTS` table + `matchEmphasisShortcut(event)` that
    accepts a synthetic keyboard event and returns the matched mode
    (or null).
- `apps/electron/src/renderer/components/app-shell/input/EmphasisToolbar.tsx` —
  presentational 4-button toolbar with i18n'd ARIA label + per-button
  tooltips showing the shortcut for the current platform (Cmd vs Ctrl
  detected via `isMac`).
- i18n: 2 keys across **all 8 locales** —
  `workbench.composer.emphasis.toolbar.aria-label` +
  `workbench.composer.emphasis.toolbar.tooltip`.
- bun:test coverage for the pure helpers in
  `__tests__/emphasis-mode.test.ts`.

## Out of scope (deferred to T235b)

- Wiring the toolbar into `FreeFormInput.tsx`. T235 ships the helper
  + presentational component; the integration point (toolbar render
  position, keyboard-shortcut interceptor in the textarea's keydown
  handler) lands in T235b so it can be reviewed independently from
  the math.

## Validation gates

- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/emphasis-mode.test.ts` —
  helper covered with bun:test.
- `bun run lint:i18n:parity` — pass (8 locales).
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pass.
- `bun run validate:roadmap` — pass.

## Follow-ups

- **T235b** — wire `EmphasisToolbar` into `FreeFormInput.tsx` +
  install Cmd/Ctrl-B/I/`/Shift+X keydown interceptor + RTL coverage.
- **T236** — line-numbers gutter in expanded composer mode.
- **T237** — paste-image preview dialog.
- **T238** — voice-input toolbar slot.
