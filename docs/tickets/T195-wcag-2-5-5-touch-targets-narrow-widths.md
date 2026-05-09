# T195 - WCAG 2.5.5 Touch Targets at Narrow Widths

Status: DONE

## Context

WCAG 2.5.5 (AAA) requires interactive targets to be at least 44×44 CSS pixels. WCAG 2.5.8 (AA, WCAG 2.2) requires 24×24 minimum with sufficient spacing. The composer toolbar icon buttons (attach, sources, working directory badge, model picker, send button) measured 36×36 at all widths in the existing implementation. On narrow viewport widths (mobile / tablet portrait / split-screen), these targets are too small for reliable touch interaction.

The fix uses a CSS container query so the bump to ≥44×44 applies only at narrow widths (`max-width: 480px`), leaving the desktop layout unchanged.

## Goal

Add a `@container shell (max-width: 480px)` block in `index.css` that overrides the minimum size of existing CSS classes `.input-toolbar-btn` and `.send-btn` to `min-width: 44px; min-height: 44px`. No JSX changes are needed: both class names are already applied to all composer toolbar icon buttons.

## Required UI

- `@container shell (max-width: 480px)` block in `apps/electron/src/renderer/styles/index.css`, lines 1442–1459.
- Inside the block:
  ```css
  .input-toolbar-btn {
    min-width: 44px;
    min-height: 44px;
  }
  .send-btn {
    min-width: 44px;
    min-height: 44px;
  }
  ```
- Desktop layout (>480px): unchanged.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Not applicable. CSS container query changes cannot be validated by Vitest RTL tests (jsdom does not evaluate CSS). Visual verification is manual at narrow widths. The pattern is documented here for future contributors.

## Implementation Requirements

- `apps/electron/src/renderer/styles/index.css`:
  - At line ~1442, add the `@container shell (max-width: 480px)` block with the two class rules above.
  - Existing `.input-toolbar-btn` and `.send-btn` definitions above this block remain unchanged.
  - The shell container query context (`container-name: shell`) must already be defined on the composer root — verify or add if missing.

## Validation Commands

- `bun run typecheck:electron` (no TypeScript touched, but confirms no import chain broken)

## Acceptance Criteria

- [x] `@container shell (max-width: 480px)` block present in `index.css`.
- [x] `.input-toolbar-btn` gets `min-width: 44px; min-height: 44px` inside the block.
- [x] `.send-btn` gets `min-width: 44px; min-height: 44px` inside the block.
- [x] Desktop layout (>480px) unchanged.
- [x] No JSX changes.
- [x] Typecheck passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T195-wcag-2-5-5-touch-targets-narrow-widths.md`.
