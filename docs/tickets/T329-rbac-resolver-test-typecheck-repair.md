# T329 - RBAC resolver test typecheck repair

Status: DONE

## Context

After rebasing the rebrand follow-up branch onto PR #74, `bun run typecheck`
failed in the new T227 `rbac-resolver.test.ts` assertions because indexed
array access remained possibly undefined under strict TypeScript checking.

## Goal

Make the RBAC resolver test assertions typecheck cleanly without changing the
runtime RBAC implementation.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

Use `bun run typecheck` as the regression gate.

## Required Subagents

None.

## TDD Requirements

Run `bun run typecheck` first and confirm it fails on the expected
possibly-undefined indexed test assertions.

## Implementation Requirements

1. Replace unsafe indexed assertions with assertions over mapped values.
2. Do not edit RBAC runtime/source implementation.

## Validation Commands

- `bun run typecheck`
- `bun test packages/shared/src/auth/__tests__/rbac-resolver.test.ts`
- `git diff --check`

## Acceptance Criteria

- [x] Typecheck fails before implementation for the expected test assertions.
- [x] RBAC resolver unit test assertions avoid unsafe indexed access.
- [x] Typecheck passes.
- [x] RBAC resolver unit tests pass.
- [x] Worklog complete.

## Worklog

Update `docs/worklog/T329-rbac-resolver-test-typecheck-repair.md`.
