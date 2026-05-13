# T235b - Wire EmphasisToolbar into FreeFormInput.tsx

Status: DONE
Phase: M.10

## Context

T235 (merged via PR #101, commit `d5ae6c25`) shipped the pure
`toggleEmphasis` helper and the presentational `EmphasisToolbar.tsx`
component. The wiring into the actual composer was deferred to T235b
so the math + the UI primitive could be reviewed independently from
the integration plumbing.

T235b lands the integration in
`apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`:

- Renders `<EmphasisToolbar />` below the rich-text input and above
  the bottom-row controls so the formatting affordance is visually
  attached to the composer surface but does not crowd the toolbar
  row that hosts attach / sources / model picker.
- Adds a `handleEmphasisToggle` callback that reads the current
  selection from the composer input, calls `toggleEmphasis` from
  `emphasis-mode.ts`, applies the new value via the controlled
  `setInput` + `syncToParent` chain, and restores the post-edit
  selection range on the next animation frame.
- Wires the keyboard shortcut path: the existing `handleKeyDown`
  consults `matchEmphasisShortcut` before the Enter / Escape / mention
  / slash / label branches. On a match the keydown is preventDefault-ed
  and `handleEmphasisToggle(mode)` runs.

## Scope

- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx` —
  new imports, `handleEmphasisToggle` callback, `<EmphasisToolbar />`
  render slot, and the keydown shortcut branch.
- `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.emphasis.rtl.test.tsx` —
  RTL coverage for the wired surface.

## Out of scope

- Any change to `EmphasisToolbar.tsx` or `emphasis-mode.ts` (T235
  surface frozen).
- Line-numbers gutter (T236), paste-image preview (T237),
  voice-input slot (T238).

## Validation gates

- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.emphasis.rtl.test.tsx` —
  RTL coverage for click + keyboard paths.
- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/emphasis-mode.test.ts` —
  still green (no helper changes).

## Acceptance matrix

| Surface | Status |
| --- | --- |
| Toolbar renders below the textarea | DONE |
| Click bold button wraps selection with `**…**` | DONE (RTL) |
| `Cmd+B` shortcut wraps selection | DONE (RTL) |
| Italic / code / strike all toggleable via click and shortcut | DONE (RTL) |
| Existing keydown behaviour (Enter to submit, ArrowUp history) preserved | DONE |
| LOC budget (≤120 source, ≤300 test) | DONE |
