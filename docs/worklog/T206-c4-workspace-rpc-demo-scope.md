# T206 - C4 workspace RPC demo scope

## 1. Task summary

Wire `workspace.ts` `workspaces.GET` through `deriveScopeFromAuth()` and add the server-core integration test for single-user, tenant, and forgery behavior.

## 2. Repo context discovered

- `RequestContext` does not have a `session` object; it carries `userId`, `sessionId`, `clientId`, and `workspaceId`.
- `accountStore.listWorkspaceIds(userId)` is the current source for owned workspace ids in server-core handlers.
- `workspaces.GET` currently reads `sessionManager.getWorkspaces()`, which delegates to the flat `DEFAULT_LOCAL_SCOPE` store.

## 3. Files inspected

- `packages/server-core/src/handlers/rpc/workspace.ts`
- `packages/server-core/src/transport/types.ts`
- `packages/server-core/src/handlers/rpc/account-ownership.ts`
- `packages/server-core/src/handlers/session-manager-interface.ts`
- `packages/shared/src/config/storage-scope-auth.ts`
- `packages/shared/src/config/storage-workspaces.ts`
- Existing RPC tests in `packages/server-core/src/handlers/rpc/*.test.ts`

## 4. Tests added first

- Added `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`.
- The test harness registers `registerWorkspaceCoreHandlers()` against a synthetic `RpcServer`, writes flat and tenant fixture config under a temp `ROX_CONFIG_DIR`, and invokes `RPC_CHANNELS.workspaces.GET` directly.
- Cases cover single-user flat, single-user requested-workspace downgrade, multi-tenant permitted tenant read, multi-tenant forgery rejection, and multi-tenant null-workspace flat read.

## 5. Expected failing test output

Before implementation, `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts` failed with 0 pass / 5 fail because the handler still called `sessionManager.getWorkspaces()`:

- `error: workspaces.GET must read through the C4 scoped storage path`
- forgery case received the sentinel `Error` instead of `MultiTenantForgeryError`

## 6. Implementation changes

- Added a private `deriveWorkspaceScope(deps, ctx)` helper in `workspace.ts` that adapts the actual `RequestContext` shape into `deriveScopeFromAuth()`.
- The helper uses `ctx.userId`, `ctx.sessionId ?? ctx.clientId`, `ctx.workspaceId`, and `deps.accountStore.listWorkspaceIds(ctx.userId)` when an account store is present.
- Rewired `RPC_CHANNELS.workspaces.GET` from `sessionManager.getWorkspaces()` to `getWorkspaces(scope)`.
- Added `// TODO(C4): use deriveScopeFromAuth when ready` above sibling `DEFAULT_LOCAL_SCOPE` storage calls in `workspace.ts`.

## 7. Validation commands run

- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts` (expected fail before implementation)
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts`
- `cd packages/server-core && bunx tsc --noEmit`
- `git diff --check`
- `rg -n "DEFAULT_LOCAL_SCOPE|TODO\\(C4\\)|deriveScopeFromAuth|getWorkspaces\\(scope\\)" packages/server-core/src/handlers/rpc/workspace.ts`

## 8. Passing test output summary

- `workspace-scope.test.ts`: 5 pass, 0 fail.
- Combined RPC/auth/runtime test run: 24 pass, 0 fail, 43 expects.
- Server-core typecheck: passed.
- `git diff --check`: passed.

## 9. Build output summary

Not run for this RPC demo ticket. Full build remains part of the final C4 validation gate.

## 10. Remaining risks

- Remaining `workspace.ts` handlers are intentionally marked for follow-up C4 migrations.
- ADR 0007 and final lint/full-test/build gates remain pending.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `workspaces.GET` derives scope from auth context | Pass | `workspace.ts` uses `deriveWorkspaceScope()` and `getWorkspaces(scope)` |
| Single-user runtime returns flat config data | Pass | `workspace-scope.test.ts` |
| Multi-tenant permitted workspace reads tenant config data | Pass | `workspace-scope.test.ts` tenant fixture |
| Multi-tenant forgery rejects | Pass | `workspace-scope.test.ts` expects `MultiTenantForgeryError` |
| Sibling TODO markers added | Pass | `rg` shows TODO marker before sibling default-scope calls |
| Integration test passes | Pass | 5 pass, 0 fail |
| Typecheck passes | Pass | `cd packages/server-core && bunx tsc --noEmit` |
| Worklog complete | Pass | This 11-section worklog is updated with evidence |
| Commit created | Pass | This ticket commit |
