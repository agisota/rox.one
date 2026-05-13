# T329 - RBAC resolver test typecheck repair

Status: DONE
Phase: M.2 validation repair
Ticket: docs/tickets/T329-rbac-resolver-test-typecheck-repair.md

## 1. Task summary

Repair strict TypeScript failures in the T227 RBAC resolver unit tests after
rebasing onto PR #74.

## 2. Repo context discovered

`bun run typecheck` failed in `packages/shared/src/auth/__tests__/rbac-resolver.test.ts`
at two `result[0]` assertions. The tests already asserted array length, but
TypeScript still treats indexed access as possibly undefined.

## 3. Files inspected

- `packages/shared/src/auth/__tests__/rbac-resolver.test.ts`
- `docs/tickets/T227-rbac-admin-rpc.md`
- `docs/worklog/T227-rbac-admin-rpc.md`

## 4. Tests added first

No new test file was needed. The existing root typecheck is the failing
regression gate.

## 5. Expected failing test output

`bun run typecheck` failed with:

```text
src/auth/__tests__/rbac-resolver.test.ts(194,12): error TS2532: Object is possibly 'undefined'.
src/auth/__tests__/rbac-resolver.test.ts(211,12): error TS2532: Object is possibly 'undefined'.
```

## 6. Implementation changes

Replaced the two `result[0]` field assertions with assertions over mapped
arrays, preserving the same behavioral expectation while avoiding unsafe
indexed access.

## 7. Validation commands run

- `bun run typecheck` (red)
- `bun test packages/shared/src/auth/__tests__/rbac-resolver.test.ts`
- `bun run typecheck`
- `git diff --check`

## 8. Passing test output summary

- `bun test packages/shared/src/auth/__tests__/rbac-resolver.test.ts`:
  22 pass, 0 fail, 28 expects.
- `bun run typecheck`: completed successfully.
- `git diff --check`: clean.

## 9. Build output summary

Not run for this test-only repair. The branch-level build is run separately
after all current repairs are committed.

## 10. Remaining risks

This ticket changes tests only; it does not validate the still-pending T227
role-admin handler implementation.

## 11. Acceptance criteria matrix

- [x] Typecheck fails before implementation for the expected test assertions.
- [x] RBAC resolver unit test assertions avoid unsafe indexed access.
- [x] Typecheck passes.
- [x] RBAC resolver unit tests pass.
- [x] Worklog complete.
