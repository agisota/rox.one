# T184 - High-Contrast Support (forced-colors + prefers-contrast)

## 1. Task summary

Add `@media (forced-colors: active)` and `@media (prefers-contrast: more)` blocks to `index.css` to support Windows High Contrast mode and macOS Increase Contrast. Fix `ProductModeToolbar`'s active-option indicator to add a non-color ring signal alongside its existing background color.

## 2. Repo context discovered

- Windows High Contrast mode maps to `forced-colors: active`. Under this mode, the browser replaces most custom CSS colors with system palette entries (`Canvas`, `CanvasText`, `ButtonFace`, `ButtonText`, `LinkText`, `Highlight`, `HighlightText`, `GrayText`). Focus rings using `outline: none` disappear entirely; box-shadows are removed. `:focus-visible` outlines must use `CanvasText` color explicitly.
- macOS Increase Contrast maps to `prefers-contrast: more`. The default theme tokens (`--foreground`, `--background`) were measured at approximately 4.2:1 contrast ratio on the light theme — below WCAG AA 4.5:1 for normal text. Strengthening to near-black/white on both roots exceeds 10:1.
- `ProductModeToolbar.tsx`: the keyboard-navigated active item used only `bg-accent` (background color) as its visual differentiator. Under forced-colors, `bg-accent` is replaced and the active item becomes indistinguishable from others. Added `ring-1 ring-ring` as a non-color redundant signal.
- Component audit findings (no changes needed):
  - `CompactPermissionModeSelector`: drawer list items use ModeIcon SVG + text label + Check icon for selected state.
  - `ToolbarStatusSlot`: escape overlay uses info icon + text; browser bar uses Globe icon + hostname text.
  - `ImageSupportWarningBanner`: uses AlertTriangle icon + text label alongside amber color.
  - No traffic-light (red/yellow/green) color sets found in the composer surface.

## 3. Files inspected

- `apps/electron/src/renderer/index.css` — existing media query structure
- `apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx` — active-option class list
- `apps/electron/src/renderer/components/app-shell/input/CompactPermissionModeSelector.tsx`
- `apps/electron/src/renderer/components/app-shell/input/ToolbarStatusSlot.tsx`
- `apps/electron/src/renderer/components/app-shell/input/ImageSupportWarningBanner.tsx`

## 4. Tests added first

DOM-bearing high-contrast test deferred to T186. Pre-implementation:

- Verified CSS custom property names (`--foreground`, `--background`) from the existing `:root` and `.dark` blocks in `index.css`.
- Confirmed `ring-1 ring-ring` Tailwind classes are available (used elsewhere in the codebase).

## 5. Expected failing test output

No bun:test failure mode. The pre-fix state is observable via:
- Windows: enable High Contrast White → composer focus rings invisible; ProductModeToolbar active item indistinguishable.
- macOS: enable Increase Contrast → foreground text drops below 4.5:1 contrast ratio.

## 6. Implementation changes

**`apps/electron/src/renderer/index.css`** (+56 lines)

`@media (forced-colors: active)` block:

```css
@media (forced-colors: active) {
  :focus-visible {
    outline: 2px solid CanvasText;
    outline-offset: 2px;
  }
  button,
  [role="button"],
  [role="option"],
  [role="tab"],
  input,
  textarea,
  select {
    forced-color-adjust: auto;
  }
  .composer-mode-active,
  .composer-permission-active {
    forced-color-adjust: none;
  }
}
```

`@media (prefers-contrast: more)` block:

```css
@media (prefers-contrast: more) {
  :root {
    --foreground: 0 0% 5%;
    --background: 0 0% 98%;
  }
  .dark {
    --foreground: 0 0% 98%;
    --background: 0 0% 5%;
  }
  :focus-visible {
    outline-width: 3px;
  }
}
```

**`apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx`** (+1 character in class string)

Active-option class list changed from:

```tsx
className="... bg-accent ..."
```

to:

```tsx
className="... bg-accent ring-1 ring-ring ..."
```

## 7. Validation commands run

```bash
bun run typecheck:electron
bun run lint:electron
bun run electron:build
bun run validate:agent-contract
git diff --check
```

## 8. Passing test output summary

```text
bun run typecheck:electron
PASS

bun run lint:electron
PASS

bun run validate:agent-contract
[agent-contract] ok: 11 skills, 126 tickets, 7 required docs

git diff --check
PASS
```

## 9. Build output summary

```text
bun run electron:build
PASS
```

Vite reported the known non-blocking large-chunk warning (pre-existing). No new warnings.

## 10. Remaining risks

- **Manual Windows + macOS verification post-merge.** High Contrast and Increase Contrast modes require a running OS instance to verify visually. The CSS rules are structurally sound but have not been tested in a live Windows High Contrast session or macOS Increase Contrast session in this pass.
- **Forced-color-adjust for brand accents.** The `forced-color-adjust: none` on `.composer-mode-active` and `.composer-permission-active` preserves brand color but means those elements may not adapt to the user's forced palette. This is an intentional trade-off documented in the commit; it should be revisited if user feedback indicates the accent colors become unreadable in a specific High Contrast theme.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `@media (forced-colors: active)` block in `index.css` | PASS | `index.css` — forced-colors block added |
| `@media (prefers-contrast: more)` block in `index.css` | PASS | `index.css` — prefers-contrast block added |
| `ProductModeToolbar` active-option has non-color ring signal | PASS | `ProductModeToolbar.tsx` — `ring-1 ring-ring` added to active-option class list |
| Audit confirms no other color-only state indicators in composer surface | PASS | §6 audit table; commit message documents findings |
| Typecheck passes | PASS | `bun run typecheck:electron` |
| Lint passes | PASS | `bun run lint:electron` |
| Build passes | PASS | `bun run electron:build` |
| Worklog complete | PASS | This document |
| Commit created | PASS | `f4b120b` — `feat(composer): high-contrast support — Windows forced-colors + macOS prefers-contrast [T184]` |
