# T325 - RBAC ticket status contract repair

Status: DONE

## Context

After rebasing the rebrand follow-up branch onto PR #72, the repository-level
agent-contract validator failed because the new RBAC tickets from that PR
did not include the required top-level `Status:` line.

## Goal

Restore the ticket/worklog metadata contract for the RBAC foundation tickets
without changing runtime behavior.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

Use `bun run validate:agent-contract` as the regression gate.

## Required Subagents

None.

## TDD Requirements

Run `bun run validate:agent-contract` first and confirm it fails on the
missing RBAC ticket status line.

## Implementation Requirements

1. Add `Status: DONE` to the T224 and T225 tickets.
2. Add matching `Status: DONE` lines to the T224 and T225 worklogs for
   consistency with the active worklog format.
3. Do not edit RBAC runtime/source files.

## Validation Commands

- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] Agent-contract validation fails before implementation for the expected RBAC ticket.
- [x] T224 and T225 ticket metadata include `Status: DONE`.
- [x] T224 and T225 worklog metadata include `Status: DONE`.
- [x] Agent-contract/docs validation passes.
- [x] Worklog complete.

## Worklog

Update `docs/worklog/T325-rbac-ticket-status-contract-repair.md`.
