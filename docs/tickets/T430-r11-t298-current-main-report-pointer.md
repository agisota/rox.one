# T430 - R.11 T298 current-main report pointer

Status: DONE

## Context

T429 moved pre-rewrite current-main validation evidence into
`docs/release/r11-current-main-validation-2026-05-14.md`. The T298 R.11
destructive closeout worklog points at the durable completion audit, but it
does not yet point directly at the current-main validation report.

## Goal

Keep the T298 closeout worklog from drifting by linking the latest
current-main validation report directly while preserving the blocked R.11
state.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend the existing R.11 closeout worklog documentation regression so T298 must
reference the current-main validation report and its full-suite count.

## Required Subagents

None. This is a narrow report-only documentation pointer.

## TDD Requirements

Add the failing documentation regression first and confirm it fails because
T298 lacks the current-main validation report pointer.

## Implementation Requirements

- Update `docs/worklog/T298-rebrand-git-history-rewrite.md` only.
- Preserve `Status: BLOCKED` on T298.
- Do not mutate refs, tags, branches, backups, mirrors, history, or runtime
  source files.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED documentation regression proves T298 lacks the current-main report
  pointer.
- [x] T298 links `docs/release/r11-current-main-validation-2026-05-14.md`.
- [x] T298 records the current-main full-suite count as pre-rewrite evidence.
- [x] T298 remains `Status: BLOCKED`.
- [x] Targeted validation, docs validation, rebrand validation, and whitespace
  checks pass.

## Worklog

Update `docs/worklog/T430-r11-t298-current-main-report-pointer.md`.
