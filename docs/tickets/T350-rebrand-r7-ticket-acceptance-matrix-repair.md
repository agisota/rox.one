# T350 - Rebrand R.7 ticket acceptance matrix repair

Status: DONE

## Context

The rebrand R.7 tickets T289, T290, and T291 are marked `Status: DONE` and
their worklogs carry green 11-section acceptance matrices. The ticket files
still had unchecked acceptance criteria, which weakens the completion audit
for the rebrand sweep goal.

## Goal

Align the R.7 ticket acceptance checkboxes with the already-recorded worklog
evidence, without changing runtime source.

## Required UI

None.

## Required Data/API

No data or API changes.

## Required Automations

Use repository search as the red/green check for unchecked acceptance criteria
inside the three R.7 ticket files.

## Required Subagents

None.

## TDD Requirements

Run a focused `rg` check for unchecked criteria in T289-T291 before editing and
confirm it finds the stale unchecked rows.

## Implementation Requirements

- Update only T289, T290, and T291 ticket acceptance checkboxes.
- Keep the worklogs unchanged except for this ticket's new worklog.
- Do not touch runtime files.

## Validation Commands

- `rg -n '^- \\[ \\]' docs/tickets/T289-rebrand-dockerfile.md docs/tickets/T290-rebrand-ci-workflows.md docs/tickets/T291-rebrand-electron-builder-config.md`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] Initial unchecked-criteria search fails on T289-T291.
- [x] T289 acceptance criteria are checked.
- [x] T290 acceptance criteria are checked.
- [x] T291 acceptance criteria are checked.
- [x] Post-edit unchecked-criteria search returns no matches.
- [x] Documentation validation passes.
- [x] Rebrand validation passes.
- [x] Whitespace diff check passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T350-rebrand-r7-ticket-acceptance-matrix-repair.md`.
