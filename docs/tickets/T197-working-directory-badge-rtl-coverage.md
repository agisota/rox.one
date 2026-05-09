# T197 - WorkingDirectoryBadge RTL Coverage

Status: DONE

## Context

T187 established the RTL test harness for `FreeFormInput`. After Pillar 2 the FreeFormInput line coverage stood at 36.30%. The architect's review of PR-B2 flagged (recommendation #4) that `WorkingDirectoryBadge` inside `FreeFormInput` had zero RTL coverage — it was rendered in production but never exercised by a test. This ticket closes that gap.

The Radix Popover used inside `WorkingDirectoryBadge` causes the "multi-copy Radix context" issue in jsdom: when the popover is rendered inside a portal, the provider is duplicated in the tree. The solution is a Popover stub that renders children unconditionally (no portal, no context boundary).

## Goal

Add 5 RTL tests for `WorkingDirectoryBadge` within `FreeFormInput`, advancing FreeFormInput.tsx line coverage from 36.30% to 44.25%. Close architect recommendation #4 from PR-B2.

## Required UI

No UI changes. Test-only ticket.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

New test file: `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.workdir.rtl.test.tsx`.

5 tests:
1. `'renders the WorkingDirectoryBadge when workingDirectory is provided'` — confirms badge label is in the DOM.
2. `'does not render the WorkingDirectoryBadge when workingDirectory is null'` — confirms badge absent.
3. `'WorkingDirectoryBadge button is keyboard focusable'` — confirms `tabIndex` not `-1`.
4. `'WorkingDirectoryBadge button has an accessible label'` — confirms `aria-label` or visible text.
5. `'WorkingDirectoryBadge opens the popover panel on click'` — confirms popover children rendered after click (enabled by Popover stub).

## Implementation Requirements

- New file: `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.workdir.rtl.test.tsx`.
- Vitest mock for `@radix-ui/react-popover` (or the local Popover re-export): renders children unconditionally via `({ children }) => <>{children}</>` stub to avoid multi-copy Radix context.
- Tests use the existing `renderFreeFormInput` helper from the T186 harness.

## Validation Commands

- `bun run test:rtl`

## Acceptance Criteria

- [x] 5 new RTL tests, all passing.
- [x] FreeFormInput.tsx line coverage: 36.30% → 44.25% (+7.95%).
- [x] FreeFormInput.tsx branch coverage: 46.25% → 50.18% (+3.93%).
- [x] FreeFormInput.tsx function coverage: 23.40% → 28.30% (+4.90%).
- [x] Popover stub renders children unconditionally (no multi-copy Radix context error).
- [x] Architect recommendation #4 from PR-B2 closed.
- [x] `bun run test:rtl` green (51 pass + 1 todo).
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T197-working-directory-badge-rtl-coverage.md`.
