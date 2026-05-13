# T301 - Ticket status contract repair

Status: DONE

## Context

`bun run validate:docs` currently fails on `main` because two recently landed
ticket files do not include the required `Status:` line.

## Goal

Restore the ticket metadata contract by adding the missing status lines to the
already-completed tickets without changing their implementation scope.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None required.

## TDD Requirements

Use `bun run validate:docs` as the failing contract check before editing and
confirm it passes after adding the missing metadata.

## Implementation Requirements

- Add `Status: DONE` to `docs/tickets/T078-rox-composer-quick-action-wrappers.md`.
- Add `Status: DONE` to `docs/tickets/T202-zed-md-default-provider.md`.
- Do not change runtime code.

## Validation Commands

- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] Ticket exists before metadata edits.
- [x] Failing validation identified the missing `Status:` contract.
- [x] T078 has `Status: DONE`.
- [x] T202 has `Status: DONE`.
- [x] `bun run validate:docs` passes.
- [x] `git diff --check` passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T301-ticket-status-contract-repair.md`.
