# T380 - R.11 staged blocker refresh

Status: DONE

## Context

T378 split the R.11 report-only preflight into a default pre-backup gate and an
explicit `--stage pre-rewrite` gate. T298's closeout worklog still described
backup tag and offline mirror as default pre-backup blockers.

## Goal

Refresh T298 so it records the current staged blocker state accurately.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

No automation changes. This is a closeout evidence update.

## Required Subagents

None.

## TDD Requirements

Use the two live report-only preflight commands as the RED evidence:

- Default pre-backup gate must be red only on `no-active-goal`.
- Explicit pre-rewrite gate must remain red on backup artifacts when the
  acknowledgement env is provided.

## Implementation Requirements

- Update T298's current blocker matrix to distinguish pre-backup and
  pre-rewrite blockers.
- Do not mark T298 as done.
- Do not create backup refs, mirrors, rewritten history, or force-pushed refs.
- Do not call `update_goal`.

## Validation Commands

- `get_goal`
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] T298 records default pre-backup blocker state accurately.
- [x] T298 records explicit pre-rewrite blocker state accurately.
- [x] T298 remains `Status: BLOCKED`.
- [x] Destructive R.11 actions are not executed.
- [x] Documentation/rebrand validation remains green.
- [x] Commit created.

## Worklog

See `docs/worklog/T380-r11-staged-blocker-refresh.md`.
