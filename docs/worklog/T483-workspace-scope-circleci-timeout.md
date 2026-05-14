# T483 - Workspace scope CircleCI timeout stabilization

Status: DONE
Phase: CI validation repair
Ticket: docs/tickets/T483-workspace-scope-circleci-timeout.md

## 1. Task summary

Stabilize the C4 workspace-scope RPC wiring test that timed out on PR #218
CircleCI validate build 156 without changing the runtime handler behavior or
weakening the storage-isolation assertions.

## 2. Repo context discovered

CircleCI validate build 156 failed one C4 workspace-scope test after 5006ms:
`theme.GET_ALL_WORKSPACE_THEMES rejects multi-tenant workspace forgery`. The
neighboring single-user and permitted multi-tenant variants passed, and the
forgery test failed by timeout rather than an assertion mismatch.

The test file builds 54 scenarios by launching a fresh `bun run` runner process
per case. The runner isolates module-level multi-tenant state and then asserts
flat, tenant, or forgery behavior for each registered workspace RPC handler.

Read-only test-engineer analysis confirmed the target handler derives scope
before theme iteration and the reported forgery case should throw
`MultiTenantForgeryError`; the hosted failure is process-spawn/test-timeout
contention.

## 3. Files inspected

- `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `packages/server-core/src/handlers/rpc/workspace.ts`
- `packages/shared/src/config/storage-scope-auth.ts`
- CircleCI validate build 156 artifact `validation-logs/test-units.log`

## 4. Tests added first

No assertion was added because the hosted artifact is already a failing test for
this exact file. The required behavior remains covered by the existing 54
workspace-scope scenarios.

## 5. Expected failing test output

CircleCI validate build 156 provided the RED evidence:

```text
(fail) workspace.ts scope wiring (C4) > theme.GET_ALL_WORKSPACE_THEMES rejects multi-tenant workspace forgery [5006.01ms]
  ^ this test timed out after 5000ms.
```

## 6. Implementation changes

- Imported `setDefaultTimeout` from `bun:test` in the C4 workspace-scope test
  file.
- Set an explicit 30s timeout budget for the file.
- Kept all 54 C4 scenarios and expectations unchanged.

## 7. Validation commands run

- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun test ./packages/session-tools-core/src/handlers/transform-data.test.ts ./packages/session-tools-core/src/handlers/transform-data-spawn-retry.isolated.ts`
- `bun run validate:docs`
- `git diff --check origin/main...HEAD && git diff --check`
- `bun run typecheck`
- `bun run typecheck:all`
- `bun run lint`
- `bun run test:units`
- `bun run build`

## 8. Passing test output summary

The complete workspace-scope file passed locally after the timeout
stabilization: 54 pass, 0 fail, 54 expect calls, 8.32s.

The neighboring transform-data PR #218 repair tests also passed: 12 pass, 0
fail, 29 expect calls. Docs validation passed with 450 tickets and 7 required
docs. Whitespace checks, `bun run typecheck`, `bun run typecheck:all`, and
`bun run lint` passed; lint reported the existing 7 warnings and 0 errors.

The CircleCI-equivalent local unit gate passed: regular suite 6918 pass, 13
skip, 0 fail, 1 snapshot, 27593 expect calls across 566 files; discovered
isolated suites passed, including transform-data with 4 pass, 0 fail.

## 9. Build output summary

No build is expected for this test-only change by itself, but the broader PR
build gate was rerun and passed. The Electron build completed main, preload,
renderer, resources, and assets stages, transformed 5660 renderer modules, and
verified the 236.3 MB SDK native binary copy.

## 10. Remaining risks

PR #218 merged into `main` at `660daad5` after hosted repo-controlled checks
passed. The only remaining hosted failure was the GitHub macOS ARM64 package
job, which failed before job steps because of the known account
billing/spending-limit condition; CircleCI `mac-arm-build` passed for the same
head SHA. R.11 remains blocked and not complete.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Hosted RED evidence identifies a C4 workspace-scope timeout rather than an assertion failure | PASS | CircleCI build 156 artifact shows only the timeout for the target C4 case |
| Workspace-scope timeout budget is explicit and test-only | PASS | `workspace-scope.test.ts` now calls `setDefaultTimeout(30_000)` |
| The complete workspace-scope file passes locally without skipped cases | PASS | 54 pass, 0 fail, 54 expect calls |
| Fresh PR #218 hosted repo-controlled checks pass, excluding known GitHub macOS ARM64 billing/spending-limit failure | PASS | PR #218 merged at `660daad5`; repo-controlled hosted checks passed, with only the known GitHub macOS ARM64 package billing/spending-limit failure excluded |
| No destructive R.11 action is performed | PASS | No destructive R.11 command is recorded for T483 |
