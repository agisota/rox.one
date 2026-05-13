# T331 - RBAC T227 completion status repair

Status: DONE

## Context

PR #75 completed the T227 roles RPC handler slice, but the rebrand follow-up
branch still carried the PR #74 metadata repair that marked the T227
ticket/worklog `IN_PROGRESS`.

## Goal

Bring T227 ticket/worklog metadata and acceptance checkboxes in line with the
merged PR #75 completion evidence without changing runtime behavior.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

Use T227's existing role/RBAC tests plus the agent-contract validator.

## Required Subagents

None.

## TDD Requirements

Run a status-contract check first and confirm the T227 ticket/worklog are not
yet marked `DONE`.

## Implementation Requirements

1. Change the T227 ticket/worklog status metadata to `DONE`.
2. Check the T227 acceptance boxes that PR #75 satisfied.
3. Update T328 wording so its PR #74 `IN_PROGRESS` repair is clearly historical.
4. Do not edit RBAC runtime/source files.

## Validation Commands

- `bun test packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`
- `bun test packages/shared/src/auth/__tests__/`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-rbac-wire.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] Status-contract check fails before implementation for the expected T227 metadata.
- [x] T227 ticket and worklog metadata are `Status: DONE`.
- [x] T227 ticket acceptance boxes match the green PR #75 worklog evidence.
- [x] T328 no longer states that T227 is still incomplete as current fact.
- [x] T227 targeted tests and docs validators pass.
- [x] Worklog complete.

## Worklog

Update `docs/worklog/T331-rbac-t227-completion-status-repair.md`.
