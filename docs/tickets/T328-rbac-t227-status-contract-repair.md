# T328 - RBAC T227 status contract repair

Status: DONE

## Context

After rebasing the rebrand follow-up branch onto PR #74, the repository-level
agent-contract validator failed because the newly landed T227 RBAC ticket did
not include the required top-level `Status:` line.

## Goal

Restore the ticket/worklog metadata contract for T227 without changing runtime
behavior or overstating the foundation-only PR as complete.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

Use `bun run validate:agent-contract` as the regression gate.

## Required Subagents

None.

## TDD Requirements

Run `bun run validate:agent-contract` first and confirm it fails on the missing
T227 status line.

## Implementation Requirements

1. Add `Status: IN_PROGRESS` to the T227 ticket.
2. Add matching `Status: IN_PROGRESS` metadata to the T227 worklog.
3. Do not edit RBAC runtime/source files.

## Validation Commands

- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] Agent-contract validation fails before implementation for the expected T227 ticket.
- [x] T227 ticket metadata includes `Status: IN_PROGRESS`.
- [x] T227 worklog metadata includes `Status: IN_PROGRESS`.
- [x] Agent-contract/docs validation passes.
- [x] Worklog complete.

## Worklog

Update `docs/worklog/T328-rbac-t227-status-contract-repair.md`.
