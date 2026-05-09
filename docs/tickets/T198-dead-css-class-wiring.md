# T198 - Dead CSS Class Wiring

Status: DONE (partial — see scope note)

## Context

T184 reserved two CSS classes for active-state semantics:

- `.composer-mode-active` — intended to mark the currently selected product mode in `ProductModeToolbar`.
- `.composer-permission-active` — intended to mark the active trigger chip in `CompactPermissionModeSelector`.

Both classes were defined in CSS but never applied to any JSX element. The architect flagged these as dead CSS in the PR-B1 review. This ticket wires them to their intended elements.

The full T198 scope from the original backlog also included: slash-mention `it.todo` resolution and a Radix Dialog audit. Both sub-tasks are **deferred** to a follow-up cleanup PR (working title: B4-cleanup).

## Goal

Wire `.composer-mode-active` onto the active mode option in `ProductModeToolbar.tsx:215` and `.composer-permission-active` onto the trigger chip in `CompactPermissionModeSelector.tsx:94`. 2-line diff. Close the architect-flagged dead-code finding from PR-B1.

## Required UI

- `ProductModeToolbar.tsx:215` (active mode option element): append `composer-mode-active` to the existing class list. The element already has `bg-accent ring-1 ring-ring` for the active state — the class is added alongside these.
- `CompactPermissionModeSelector.tsx:94` (trigger chip): append `composer-permission-active` to the existing class list.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Not applicable. Pure className additions with no behavioral delta. No existing tests cover these class names as assertions. If future tests target `.composer-mode-active` or `.composer-permission-active` as selectors, they will now find matches.

## Implementation Requirements

- `apps/electron/src/renderer/components/app-shell/ProductModeToolbar.tsx`:
  - Line 215 (active mode option): add `composer-mode-active` to the `className` expression.
- `apps/electron/src/renderer/components/app-shell/CompactPermissionModeSelector.tsx`:
  - Line 94 (trigger chip): add `composer-permission-active` to the `className` expression.

## Validation Commands

- `bun run typecheck:electron`

## Out of Scope (deferred to B4-cleanup)

- Slash-mention `it.todo` resolution.
- Radix Dialog audit.

## Acceptance Criteria

- [x] `composer-mode-active` applied to `ProductModeToolbar.tsx:215`.
- [x] `composer-permission-active` applied to `CompactPermissionModeSelector.tsx:94`.
- [x] Both CSS classes are now reachable in the DOM (no longer dead).
- [x] Architect dead-code finding from PR-B1 closed.
- [x] No behavioral changes (pure className additions).
- [x] Typecheck passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T198-dead-css-class-wiring.md`.
