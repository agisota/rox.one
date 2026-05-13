# T235 worklog — Composer emphasis-modes toolbar

## 1. Goal

Ship the pure-helper layer + presentational toolbar for the M.10
Pillar 4 emphasis-modes feature. The wiring into `FreeFormInput.tsx`
is deliberately deferred to T235b so the math + the UI can be
reviewed independently from the integration plumbing.

## 2. Approach

TDD-first.

- **emphasis-mode.ts** — pure module exposing `toggleEmphasis`,
  `EMPHASIS_MARKERS`, `EMPHASIS_SHORTCUTS`, and
  `matchEmphasisShortcut`. No DOM knowledge — the helper takes a
  `{ start, end }` selection range and returns the new value + new
  selection range. Markers and shortcut bindings are frozen lookup
  tables.
- **EmphasisToolbar.tsx** — presentational 4-button toolbar.
  Receives `onToggle(mode)` callback. Pure UI — no state. Tooltips
  render the platform-correct shortcut label (Cmd vs Ctrl via
  `isMac`).
- **i18n** — 2 keys across all 8 locales. The tooltip key uses
  `{{label}} ({{shortcut}})` interpolation tokens so per-mode labels
  can be substituted at render time without duplicating per-mode
  strings.

## 3. Test coverage

```
$ bun test apps/electron/src/renderer/components/app-shell/input/__tests__/emphasis-mode.test.ts
```

The pure helper is fully unit-tested (the first agent commit on this
branch landed the bun:test coverage). The toolbar component is
presentational; its visual behaviour is verified by manual sweep on
the running renderer (RTL coverage lands with T235b once the toolbar
is mounted by `FreeFormInput.tsx`).

## 4. Decisions

- **Helper / component / wiring split into T235 + T235b.** The pure
  math + the UI primitive are mature on their own. The integration
  point (where in the JSX to mount the toolbar; how the keydown
  handler routes to `toggleEmphasis` against the textarea's
  selection) deserves its own review pass — T235b carries that.
- **Platform-correct shortcut labels.** The tooltip key
  interpolates `{{shortcut}}` so the component computes the label
  at render time based on `isMac`. No new translated strings needed
  for the OS variants.
- **i18n alphabetical sort preserved.** Both new keys insert
  between `workbench.composer.actions.removeRecentFolder` and
  `workbench.composer.input.editLabel` — line 1478 in every locale.

## 5. Files touched

| Path                                                                                      | Status |
| ----------------------------------------------------------------------------------------- | ------ |
| `apps/electron/src/renderer/components/app-shell/input/emphasis-mode.ts`                  | new (commit 2d585b39) |
| `apps/electron/src/renderer/components/app-shell/input/__tests__/emphasis-mode.test.ts`   | new (commit 2d585b39) |
| `apps/electron/src/renderer/components/app-shell/input/EmphasisToolbar.tsx`               | new    |
| `packages/shared/src/i18n/locales/{en,de,es,hu,ja,pl,ru,zh-Hans}.json`                    | edited |
| `docs/tickets/T235-composer-emphasis-toolbar.md`                                          | new    |
| `docs/worklog/T235-composer-emphasis-toolbar.md`                                          | new    |

## 6. Deviations

- **`FreeFormInput.tsx` wiring deferred to T235b.** The original
  prompt asked for full integration; the agent that started v3
  truncated mid-wiring. Rather than rush an incomplete wire, the
  toolbar + helper ship in isolation here and T235b carries the
  integration plus the RTL coverage that depends on it.
- **No RTL coverage for `EmphasisToolbar.tsx` in this PR.** The
  toolbar is presentational; the meaningful RTL surface is the
  integrated `FreeFormInput.tsx` test (T235b). Adding a standalone
  RTL test for the toolbar in isolation would test the framework
  more than the feature.
- Branch is `feat/M10-T235-emphasis-toolbar-v3` (v3 because earlier
  v1/v2 dispatches lost work to /tmp tmpfs ENOSPC).

## 7. Validation matrix

| Gate                                          | Result                                  |
| --------------------------------------------- | --------------------------------------- |
| `bun test emphasis-mode.test.ts`              | pass                                    |
| `bun run lint:i18n:parity`                    | pass (8 locales)                        |
| `bun run validate:rebrand`                    | pre-existing main-baseline failure (unrelated to this PR; `ROX_BUNDLE_CARVEOUT_JSON` literal in `check-bundle-budget.cjs`) |
| `bun run validate:agent-contract`             | pass                                    |
| `bun run validate:roadmap`                    | pass                                    |

## 8. Follow-ups

- **T235b** — `FreeFormInput.tsx` integration + keyboard shortcut
  interceptor + RTL coverage for the wired component.
- **T236** — line-numbers gutter in expanded composer mode.
- **T237** — paste-image preview dialog.
- **T238** — voice-input toolbar slot.

## 9. Closeout

- Pure `toggleEmphasis` helper + `EMPHASIS_SHORTCUTS` table land in
  commit 2d585b39 (already pushed).
- `EmphasisToolbar.tsx` presentational toolbar lands in the closing
  commit on this PR.
- i18n parity restored across 8 locales.
- Wiring + RTL coverage deferred to T235b.
