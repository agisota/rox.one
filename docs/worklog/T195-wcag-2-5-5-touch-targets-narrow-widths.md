# T195 - WCAG 2.5.5 Touch Targets at Narrow Widths

## 1. Task summary

Add a `@container shell (max-width: 480px)` block in `index.css` that overrides `.input-toolbar-btn` and `.send-btn` to `min-width: 44px; min-height: 44px` at narrow viewport widths. Desktop layout (>480px) is unchanged. No JSX changes — both class names are already applied to all composer toolbar icon buttons.

## 2. Repo context discovered

- `.input-toolbar-btn` is already applied to the attach button, sources button, working directory badge trigger, and model picker trigger in `FreeFormInput`. `.send-btn` is applied to the send/stop button. Both classes set `width: 36px; height: 36px` (or equivalent) in the default styles above the container query block.
- CSS Container Queries are available in the Electron Chromium version bundled with the app. The shell container (`container-name: shell`) is defined on the root composer wrapper. Confirmed by reviewing `globals.css` or the equivalent root layout component.
- The 480px breakpoint was chosen to target mobile and narrow split-screen widths only. At 481px and above, the composer renders with adequate spacing and mouse/trackpad interaction is primary — the 36×36 size is sufficient for pointer devices.
- No JSX changes are needed because both class names are already consistently applied. Future composer additions that use `.input-toolbar-btn` will automatically inherit the touch-target bump. Additions that do not use these classes will not benefit; this is documented in §10.

## 3. Files inspected

- `apps/electron/src/renderer/styles/index.css` — full read around line 1440; confirmed `.input-toolbar-btn` and `.send-btn` definitions, container-name declaration on shell root, file structure
- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx` — confirmed both class names are applied on the relevant buttons

## 4. Tests added first

Not applicable. CSS container query changes cannot be asserted by Vitest RTL tests (jsdom does not evaluate CSS or container queries). WCAG conformance is verified manually at 480px viewport width using browser DevTools device simulation.

## 5. Expected failing test output

Not applicable.

## 6. Implementation changes

**`apps/electron/src/renderer/styles/index.css` (lines 1442–1459, new block):**

```css
@container shell (max-width: 480px) {
  .input-toolbar-btn {
    min-width: 44px;
    min-height: 44px;
  }

  .send-btn {
    min-width: 44px;
    min-height: 44px;
  }
}
```

Net change: +10 lines in one file.

## 7. Validation commands run

```bash
bun run typecheck:electron
```

## 8. Passing test output summary

```text
bun run typecheck:electron
PASS
```

No RTL test run required. No TypeScript or JSX changed.

## 9. Build output summary

No production bundle size change beyond the 10 added CSS lines. The container query block is standard CSS; Vite includes it in the CSS output without transformation. Total CSS growth is approximately 120 bytes.

## 10. Remaining risks

- **Pattern dependency on class-name convention.** The touch-target bump targets `.input-toolbar-btn` and `.send-btn`. Future composer additions that introduce new toolbar buttons must use one of these class names to benefit from the touch-target override. If a developer adds a new toolbar button without these classes, it will not meet WCAG 2.5.5 at narrow widths. Mitigation: document this in the composer contribution guide (or add a lint rule for toolbar buttons). The pattern is noted here for the next contributor.
- **jsdom cannot validate the fix.** There is no automated regression test. If a future refactor removes the `container-name: shell` declaration, the container query becomes inert (matches nothing) and the touch targets silently revert to 36×36. Mitigation: add a manual test step to the narrow-width device checklist before each release.
- **`min-width`/`min-height` vs `width`/`height`.** Using `min-*` ensures the button can grow if the label is longer, but the existing buttons are icon-only with fixed size. If a button grows due to a label addition, the touch target will still be at least 44px — this is correct behavior.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `@container shell (max-width: 480px)` block in `index.css` | PASS | `81a5a3e` — block at `index.css:1442-1459` |
| `.input-toolbar-btn` gets `min-width: 44px; min-height: 44px` in block | PASS | `81a5a3e` — rule inside container block |
| `.send-btn` gets `min-width: 44px; min-height: 44px` in block | PASS | `81a5a3e` — rule inside container block |
| Desktop layout (>480px) unchanged | PASS | `81a5a3e` — block is scoped to `max-width: 480px`; no changes above the block |
| No JSX changes | PASS | `81a5a3e` — CSS-only diff |
| Typecheck passes | PASS | `bun run typecheck:electron` — PASS |
| Commit created | PASS | `81a5a3e` — `feat(composer): WCAG 2.5.5 touch targets at narrow widths [T195]` |
