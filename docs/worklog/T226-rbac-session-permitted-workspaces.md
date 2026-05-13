# T226 - RBAC session permittedWorkspaces wiring

## 1. Task summary

Land the runtime wire-in that produces `session.permittedWorkspaces` from
the T225 RBAC policy engine. Adds an `RbacResolver` indirection between the
RPC scope helpers and the pure-function engine, leaves persisted grant
storage / admin RPC / admin UI / E2E / ADR to T227-T230.

## 2. Repo context discovered

- T225 landed `permittedWorkspaces(grants)` in
  `packages/shared/src/auth/policy-engine.ts` together with the
  `PERMITTED_WORKSPACES_GLOBAL_SENTINEL` (`'*'`) marker for global readers.
  T225's worklog explicitly handed the sentinel handling off to T226.
- Two production call sites build the `permittedWorkspaces` array today,
  both from `AccountStore.listWorkspaceIds(userId)`:
  - `packages/server-core/src/handlers/rpc/workspace.ts` →
    `deriveWorkspaceScope`.
  - `packages/server-core/src/handlers/rpc/storage-scope.ts` →
    `deriveRpcWorkspaceScope`.
  Both forward the array into `deriveScopeFromAuth` in
  `packages/shared/src/config/storage-scope-auth.ts` (C.4).
- `deriveScopeFromAuth` rejects requested workspace ids that are not in the
  permitted set via `MultiTenantForgeryError`. The sentinel was not yet
  understood — the array was treated as a literal id list.
- `SessionManager.buildSessionStorageScopeAuth` in
  `packages/server-core/src/sessions/SessionManager.ts` is a separate single-
  user bootstrap that always returns `[workspace.id]`. It does not flow
  through the multi-tenant code path and stays unchanged in T226.
- The C.4 regression suite
  (`packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`)
  spawns a sub-`bun` runner that uses an inline `accountStore.listWorkspaceIds`
  fake. The wire-in keeps that fake's behaviour exercised by leaving the
  fall-back path intact when `HandlerDeps.rbacResolver` is absent.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
  (Phase 2 §2 cluster).
- `docs/tickets/T225-rbac-policy-engine.md`.
- `docs/worklog/T225-rbac-policy-engine.md`.
- `docs/tickets/TEMPLATE.md` and `docs/worklog/README.md`.
- `packages/shared/src/auth/policy-engine.ts`,
  `packages/shared/src/auth/roles-schema.ts`,
  `packages/shared/src/auth/index.ts`,
  `packages/shared/package.json`.
- `packages/shared/src/config/storage-scope-auth.ts`.
- `packages/server-core/src/handlers/handler-deps.ts`.
- `packages/server-core/src/handlers/rpc/storage-scope.ts`.
- `packages/server-core/src/handlers/rpc/workspace.ts`.
- `packages/server-core/src/accounts/types.ts` (`AccountStore.listWorkspaceIds`).
- `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`.
- `packages/server-core/src/handlers/rpc/__tests__/server-core-rpc-storage-scope.test.ts`.
- `packages/shared/src/config/__tests__/storage-scope-auth.test.ts`.
- `packages/server-core/src/sessions/SessionManager.ts` (confirmed not in
  scope).
- `.swarm/master-roadmap-log.md`.

## 4. Tests added first

- `packages/shared/src/auth/__tests__/rbac-resolver.test.ts` covering:
  - Empty `InMemoryGrantStore` → `permittedWorkspacesForUser` returns `[]`.
  - Single workspace viewer grant → returns the matching id.
  - Global owner grant → returns the T225 sentinel `['*']`.
  - User isolation: `u2` does not see `u1`'s grants; per-user lookups return
    only the requested user's grants.
  - Multiple workspace grants → deduplicated union of scope ids; the same
    workspace granted through multiple roles → single entry.
  - `InMemoryGrantStore` ignores team-actor grants (out of scope for T226).
  - Resolver works with a caller-provided async `GrantStore` (covers the
    interface contract for T227's eventual database implementation).
- `packages/server-core/src/handlers/rpc/__tests__/workspace-rbac-wire.test.ts`
  — integration-style coverage of the RPC wire-in:
  - When `HandlerDeps.rbacResolver` is provided, `deriveRpcWorkspaceScope`
    consults the resolver and does not call `accountStore.listWorkspaceIds`.
  - When `rbacResolver` is absent, the helper falls back to
    `accountStore.listWorkspaceIds` exactly as before (C.4 contract).
  - `MultiTenantForgeryError` semantics are preserved when the resolver
    returns a workspace set that does not include the requested id.
  - The global sentinel (`'*'`) emitted by the policy engine is honored by
    `deriveScopeFromAuth` and grants access to any workspace.
  - Single-user runtime (`multiTenant=false`) returns `DEFAULT_LOCAL_SCOPE`
    regardless of the resolver wiring.

## 5. Expected failing test output

```
bun test v1.3.13 (bf2e2cec)

packages/shared/src/auth/__tests__/rbac-resolver.test.ts:

# Unhandled error between tests
-------------------------------
error: Cannot find module '../rbac-resolver' from '/tmp/rox-m2-t226/packages/shared/src/auth/__tests__/rbac-resolver.test.ts'
-------------------------------


 0 pass
 1 fail
 1 error
Ran 1 test across 1 file. [44.00ms]
```

```
bun test v1.3.13 (bf2e2cec)

packages/server-core/src/handlers/rpc/__tests__/workspace-rbac-wire.test.ts:

error: rbac wire runner failed with exit 1
stderr:
error: Cannot find module '/tmp/rox-m2-t226/packages/shared/src/auth/rbac-resolver.ts'

 0 pass
 5 fail
Ran 5 tests across 1 file. [191.00ms]
```

## 6. Implementation changes

- Added `packages/shared/src/auth/rbac-resolver.ts` exporting:
  - `GrantStore` interface — single async method
    `grantsForUser(userId): Promise<ReadonlyArray<RoleGrant>>`.
  - `InMemoryGrantStore` — seeded constructor, indexes grants by `actorId`,
    filters out `team` actor grants because team RBAC is deferred.
  - `RbacResolver` — wraps a `GrantStore` and delegates to the pure-function
    `permittedWorkspaces` policy engine.
- Wired the new module into `packages/shared/src/auth/index.ts` and added
  the `./auth/rbac-resolver` subpath export in `packages/shared/package.json`.
- Extended `HandlerDeps` in
  `packages/server-core/src/handlers/handler-deps.ts` with optional
  `rbacResolver?: RbacResolver` field. Defaults to `undefined`, so existing
  hosts have zero behavioural change.
- Centralised the permitted-workspaces resolution into a single helper
  `resolvePermittedWorkspaces(deps, userId)` in
  `packages/server-core/src/handlers/rpc/storage-scope.ts`. Resolution order:
  1. If `deps.rbacResolver` is provided → consult RBAC.
  2. Else if `deps.accountStore` is provided → fall back to
     `listWorkspaceIds(userId)`.
  3. Else (anonymous) → `[]`.
- Replaced the inline `permittedWorkspaces` build in both
  `deriveRpcWorkspaceScope` (storage-scope.ts) and `deriveWorkspaceScope`
  (workspace.ts) with a call to `resolvePermittedWorkspaces` so the two
  sites stay in lockstep.
- Taught `deriveScopeFromAuth` in
  `packages/shared/src/config/storage-scope-auth.ts` to recognise the T225
  `PERMITTED_WORKSPACES_GLOBAL_SENTINEL`. When the permitted array includes
  `'*'`, the forgery check is short-circuited and the request is allowed
  regardless of the literal workspace id. This is the consumer-side half of
  the sentinel contract T225 declared and that T225's worklog explicitly
  deferred to T226.

## 7. Validation commands run

- `bun test packages/shared/src/auth/__tests__/rbac-resolver.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-rbac-wire.test.ts`
- `bun test packages/shared/src/auth/__tests__/policy-engine.test.ts`
- `bun test packages/shared/src/auth/__tests__/roles-schema.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/server-core-rpc-storage-scope.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun test packages/pi-agent-server/src/__tests__/storage-scope-bootstrap.test.ts`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

| Suite | Result |
| --- | --- |
| `rbac-resolver.test.ts` | 10 pass / 0 fail / 12 expect |
| `workspace-rbac-wire.test.ts` | 5 pass / 0 fail / 19 expect |
| `policy-engine.test.ts` | 27 pass / 0 fail / 39 expect |
| `roles-schema.test.ts` | 14 pass / 0 fail / 29 expect |
| `workspace-scope.test.ts` (C.4 regression) | 54 pass / 0 fail / 54 expect |
| `server-core-rpc-storage-scope.test.ts` | 5 pass / 0 fail / 13 expect |
| `storage-scope-auth.test.ts` | 13 pass / 0 fail / 23 expect |
| `storage-scope.test.ts` + `storage-scope-bootstrap.test.ts` | 27 pass / 0 fail / 44 expect (combined) |

`validate:rebrand` exits 0. `git diff --check` exits 0.

## 9. Build output summary

No build was run. T226 is a wire-in plus a small new module — the full
build is exercised in T227 when the admin RPC handlers land.

## 10. Remaining risks

- `InMemoryGrantStore` is the only `GrantStore` implementation today, and
  it has zero grants seeded by any production host. Multi-tenant runtimes
  that adopt the resolver before T227 lands will therefore see every
  authenticated user receive an empty `permittedWorkspaces` array and every
  workspace request rejected with `MultiTenantForgeryError`. The wire-in
  guards against this by keeping the resolver opt-in (no resolver in
  `HandlerDeps` → existing `AccountStore` fall-back), but operators must
  explicitly stage T227 before injecting the resolver.
- `deriveScopeFromAuth` now imports from `../auth/policy-engine.ts` to
  pick up the sentinel constant. This introduces a one-way dependency
  `config -> auth`; both packages were already siblings under
  `packages/shared/src/`, so no circular-import risk surfaces, but the
  reverse direction (`auth -> config`) should remain forbidden if future
  RBAC features need additional cross-cutting state.
- The wire-in still calls a single grant store per user lookup. T227's
  Postgres-backed implementation should add caching to avoid N+1 round-
  trips in the scope helpers; a follow-up ticket should land that cache.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `RbacResolver` returns the T225 policy-engine output for the user | Green | `rbac-resolver.test.ts` cases for empty/single/global/multi grants |
| `InMemoryGrantStore` indexes grants by `actorId` and ignores team actors | Green | `rbac-resolver.test.ts` user-isolation and actor-filtering cases |
| `HandlerDeps.rbacResolver` is optional; default behaviour is unchanged | Green | `workspace-rbac-wire.test.ts` "falls back to AccountStore" case |
| When the resolver is provided, the RPC scope helpers source `session.permittedWorkspaces` from RBAC grants | Green | `workspace-rbac-wire.test.ts` "uses the resolver and bypasses AccountStore" case |
| C.4 `workspace-scope.test.ts` regression remains green | Green | 54 pass / 0 fail |
| Resolver unit tests pass | Green | 10 pass / 0 fail |
| Integration wire-in tests pass | Green | 5 pass / 0 fail |
| `validate:rebrand` exits 0 | Green | Section 7 |
| Worklog complete | Green | All 11 sections present |
| Commit created | Green | Atomic commits per Lore protocol |
