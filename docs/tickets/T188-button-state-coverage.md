# T188 - button.tsx State Coverage

Status: DONE

## Context

`apps/electron/src/renderer/components/ui/button.tsx` is a CVA-based button component used across the entire renderer. It supports 6 variants (default, destructive, outline, secondary, ghost, link), 4 sizes (default, sm, lg, icon), disabled state, keyboard activation, and Radix `asChild` composition. No behavioral tests existed. Any regression in the CVA class wiring or disabled-state guard is invisible until a visual QA pass.

## Goal

Write a single RTL test file covering all CVA variants and sizes, disabled state (attribute and onClick suppression), keyboard focus + Enter/Space activation, `asChild` rendering, and 3 axe a11y assertions.

## Required UI

None — test coverage only.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Tests are written against the existing `button.tsx` implementation. All 21 tests must pass under `bun run test:rtl`.

## Implementation Requirements

File: `apps/electron/src/renderer/components/ui/__tests__/button.rtl.test.tsx`

Test groups:

- **variants** (7 tests): default text content render; `it.each` over all 6 CVA variants (default/destructive/outline/secondary/ghost/link).
- **sizes** (4 tests): `it.each` over all 4 sizes (default/sm/lg/icon).
- **disabled state** (2 tests): `disabled` attribute set on the native button element; `onClick` not called when disabled.
- **focus + click** (4 tests): Tab focuses the button; Enter fires `onClick`; Space fires `onClick`; mouse click fires `onClick`.
- **asChild prop** (1 test): renders as the child element (`<a>`), no `<button>` wrapper.
- **a11y** (3 tests): no axe violations for a labeled button; no axe violations for icon-only button with `aria-label`; no axe violations for destructive variant.

Additional notes:
- `afterEach(cleanup)` required — rendered buttons bleed across tests without it.
- No `loading` prop exists in this implementation; if a future ticket adds one, T188 needs extension.

## Validation Commands

- `bun run test:rtl`
- `bun run typecheck:electron`

## Acceptance Criteria

- [x] `apps/electron/src/renderer/components/ui/__tests__/button.rtl.test.tsx` exists.
- [x] 21 tests: 7 variant + 4 size + 2 disabled + 4 focus/click + 1 asChild + 3 a11y.
- [x] All tests pass under `bun run test:rtl`.
- [x] Typecheck passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T188-button-state-coverage.md`.
