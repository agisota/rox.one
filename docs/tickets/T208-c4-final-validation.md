# T208 - C4 final validation

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.

Relevant product goals:

- managed web/cloud app
- user/team workspaces
- validation gates
- TDD-first implementation

## Goal

Run the full C4 stopping-condition validation after the implementation and ADR commits.

## Required UI

None.

## Required Data/API

No production source changes are expected unless validation finds a regression. Test-only hardening is allowed when final validation exposes a C4 test isolation failure.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

This is a validation ticket. If a gate fails, write the failing output to the worklog, fix under this ticket only if the fix is inside C4 scope, then rerun the failed gate.

## Implementation Requirements

Verify:

- all targeted C4 tests
- root typecheck
- root lint
- full `bun test`
- root build
- worklog/ticket completeness
- no unrelated runtime files

## Validation Commands

- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope-runtime.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`

## Acceptance Criteria

- [x] Targeted C4 tests pass.
- [x] `bun run typecheck` passes.
- [x] `bun run lint` passes.
- [x] Full `bun test` passes.
- [x] `bun run build` passes.
- [x] Worklogs and tickets for C4 are complete.
- [x] No unrelated runtime files modified.
- [x] Commit created.

## Worklog

Update `docs/worklog/T208-c4-final-validation.md`.
