# T389 - R.11 fork review blocker refresh

Status: DONE

## Context

T388 added fork-review to the R.11 report-only preflight. T298's current
blocker evidence still records fork count as a manual evidence bullet only,
not as a preflight row.

## Goal

Refresh T298 and T388 so the post-push fork-review evidence is captured:
expected fork count `0`, live fork-review row passing, and R.11 still blocked
only by active goal in pre-backup mode.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

No automation changes. This is a post-push evidence refresh.

## Required Subagents

None.

## TDD Requirements

Use the live post-push preflight output from T388 as evidence. The default
preflight must show `fork-review` passing and remain red only on
`no-active-goal`.

## Implementation Requirements

- Update T388 ticket/worklog to `Status: DONE`.
- Record post-push fork-review evidence in T388.
- Refresh T298 current evidence to include the fork-review preflight row.
- Keep T298 `Status: BLOCKED`.
- Do not create backup refs, mirrors, rewritten history, or force-pushed refs.
- Do not call `update_goal`.

## Validation Commands

- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] T388 ticket is `Status: DONE`.
- [x] T388 worklog is `Status: DONE`.
- [x] T298 records fork-review as a green preflight prerequisite.
- [x] T298 remains `Status: BLOCKED`.
- [x] Documentation/rebrand validation remains green.
- [x] Destructive R.11 actions are not executed.
- [x] Commit created.

## Worklog

See `docs/worklog/T389-r11-fork-review-blocker-refresh.md`.
