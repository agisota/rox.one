# T347 - Auth integrity-pass type contract repair

Status: DONE

## Context

After rebasing onto current `origin/main` through #135, `bun run typecheck`
failed in the auth integrity-pass test added by the security integrity pass.
The test used stale policy-resource field names and a loose string helper for
role-grant validation codes.

## Goal

Restore the shared package typecheck by aligning the integrity-pass test with
the existing typed public auth APIs.

## Required UI

None.

## Required Data/API

No runtime API changes.

## Required Automations

Use `bun run typecheck` as the red/green gate and run the targeted integrity
test after the type repair.

## Required Subagents

None. The compiler errors point directly at the stale test contract.

## TDD Requirements

Use the failing `bun run typecheck` output as the red check.

## Implementation Requirements

- Type the local invalid-grant helper with `RoleGrantValidationCode`.
- Use the current `PolicyResource` shape: `scopeKind` and `scopeId`.
- Do not change auth runtime code.

## Validation Commands

- `bun run typecheck`
- `bun test packages/shared/src/auth/__tests__/integrity-pass.test.ts`
- `bun test`
- `git diff --check`

## Acceptance Criteria

- [x] Typecheck fails before implementation for the expected stale integrity-pass test typing.
- [x] Auth runtime files remain unchanged.
- [x] Targeted integrity-pass test passes.
- [x] Full validation matrix passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T347-auth-integrity-pass-type-contract-repair.md`.
