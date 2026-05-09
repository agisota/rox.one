# T184 - High-Contrast Support (forced-colors + prefers-contrast)

Status: DONE

## Context

Windows High Contrast mode (`forced-colors: active`) replaces most CSS colors with system palette entries, breaking focus rings and any UI affordance that relies solely on `background-color` or `color`. macOS Increase Contrast (`prefers-contrast: more`) weakens the default light/dark theme tokens to below-threshold contrast ratios. WCAG 2.1 SC 1.4.11 (Non-text Contrast) and SC 1.4.3 (Contrast Minimum) apply in both scenarios.

## Goal

Add two media query blocks to `index.css` — one for `forced-colors: active` (Windows) and one for `prefers-contrast: more` (macOS). Fix `ProductModeToolbar`'s active-option indicator to use a non-color redundant signal (ring) alongside its existing `bg-accent` background.

## Required UI

- `forced-colors: active`: `:focus-visible` uses a 2px `CanvasText` outline; interactive controls get `forced-color-adjust: auto`; brand accent markers (`.composer-mode-active`, `.composer-permission-active`) get `forced-color-adjust: none` to preserve intentional color.
- `prefers-contrast: more`: `--foreground`/`--background` CSS custom properties strengthened to near-black/white on both light and dark roots; `:focus-visible` outline-width increased to 3px.
- `ProductModeToolbar` active item: `ring-1 ring-ring` added as redundant non-color differentiator.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Self-test deferred to T186. Component audit required before changes to confirm no other components use color as the sole conveyor of state.

Audit findings (documented in commit and worklog):
- `CompactPermissionModeSelector`: uses ModeIcon SVG + Check icon + text — not color-only.
- `ToolbarStatusSlot`: uses AlertTriangle/Globe icon + text label.
- `ImageSupportWarningBanner`: uses AlertTriangle icon + amber color + text.
- No traffic-light color sets found in composer surface.

## Implementation Requirements

- `apps/electron/src/renderer/index.css`: add `@media (forced-colors: active)` block.
- `apps/electron/src/renderer/index.css`: add `@media (prefers-contrast: more)` block.
- `apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx`: add `ring-1 ring-ring` to active-option class list.

## Validation Commands

- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run electron:build`
- `bun run validate:agent-contract`

## Acceptance Criteria

- [x] `@media (forced-colors: active)` block present in `index.css`.
- [x] `@media (prefers-contrast: more)` block present in `index.css`.
- [x] `ProductModeToolbar` active-option has non-color ring signal.
- [x] Audit confirms no other color-only state indicators remain in composer surface.
- [x] Typecheck, lint, and build pass.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T184-high-contrast-support.md`.
