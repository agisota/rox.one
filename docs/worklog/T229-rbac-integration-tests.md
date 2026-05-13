# T229 - RBAC end-to-end integration test

## 1. Task summary

Land the M.2 Phase 2 stopping-condition test:
`packages/server-core/src/handlers/rpc/__tests__/rbac-e2e.test.ts`. The
test exercises the full RBAC lifecycle end-to-end across the production
chain `InMemoryGrantStore` → `RbacResolver` → `roles.grant`/`roles.revoke`
RPC → `deriveWorkspaceScope` → `workspaces.GET`. Five scenarios cover
the happy-path lifecycle, non-owner denial, global-owner override,
idempotent revoke, and resolver invalidation. No production code
changes; T229 is a pure test slice.

## 2. Repo context discovered

- T224-T227 landed the M.2 RBAC backend:
  - T224 (`packages/shared/src/auth/roles-schema.ts`) defines `Role`,
    `RoleGrant`, `SYSTEM_ROLES`.
  - T225 (`packages/shared/src/auth/policy-engine.ts`) is the pure
    `permittedWorkspaces(grants)` evaluator with the `'*'` global
    sentinel.
  - T226 (`packages/shared/src/auth/rbac-resolver.ts` +
    `packages/server-core/src/handlers/rpc/storage-scope.ts`) wires the
    resolver into `deriveScopeFromAuth`. The local
    `deriveWorkspaceScope` helper inside
    `packages/server-core/src/handlers/rpc/workspace.ts` calls
    `resolvePermittedWorkspaces` first.
  - T227 (`packages/server-core/src/handlers/rpc/roles.ts`) is the
    admin RPC surface: `roles.list`, `roles.create`, `roles.grant`,
    `roles.revoke` with owner-gated mutation guards and an
    `invalidateUser` cache-bust hook called after a successful revoke.
- The `deriveScopeFromAuth` forgery rejection runs against
  `session.permittedWorkspaces`. With multi-tenant runtime on and no
  permitted workspaces, `workspaces.GET` ctx with `workspaceId='W1'`
  throws `MultiTenantForgeryError` before any disk read.
- The child-process spawn harness pattern in
  `workspace-scope.test.ts` and `workspace-rbac-wire.test.ts` is the
  established pattern for isolating multi-tenant runtime singletons
  (`isMultiTenantActivated` is process-memoized). T229 follows the
  same shape so scenarios cannot leak runtime state.
- `filterOwnedWorkspaces` and `requireWorkspaceAccess` still consult
  `deps.accountStore` (the C.4 baseline). When no `accountStore` is
  wired, both no-op, so the e2e test exercises the resolver-only path
  by leaving `deps.accountStore` undefined.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
  (Phase 2 §4 cluster, T229 stopping condition line 191).
- `docs/tickets/TEMPLATE.md`, `docs/tickets/T227-rbac-admin-rpc.md`,
  `docs/worklog/T227-rbac-admin-rpc.md`.
- `packages/shared/src/auth/rbac-resolver.ts`,
  `packages/shared/src/auth/roles-schema.ts`,
  `packages/shared/src/auth/policy-engine.ts`,
  `packages/shared/src/auth/role-store.ts`,
  `packages/shared/src/auth/index.ts`.
- `packages/shared/src/config/storage-scope-auth.ts`,
  `packages/shared/src/config/storage-scope-runtime.ts`,
  `packages/shared/src/config/storage-workspaces.ts`.
- `packages/server-core/src/handlers/rpc/workspace.ts`,
  `packages/server-core/src/handlers/rpc/roles.ts`,
  `packages/server-core/src/handlers/rpc/storage-scope.ts`,
  `packages/server-core/src/handlers/rpc/account-ownership.ts`,
  `packages/server-core/src/handlers/handler-deps.ts`.
- `packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`
  (T227 RPC integration pattern).
- `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
  (C.4 multi-tenant integration pattern; child-process spawn harness).
- `packages/server-core/src/handlers/rpc/__tests__/workspace-rbac-wire.test.ts`
  (T226 wire-in pattern; child-process spawn with `RbacResolver` graph).

## 4. Tests added first

- `packages/server-core/src/handlers/rpc/__tests__/rbac-e2e.test.ts`
  with five `describe` scenarios. Each scenario runs in an isolated
  `ROX_CONFIG_DIR` and `__setMultiTenantForTests(true)` state via
  `bun run <runnerPath>` so the process-memoized
  `isMultiTenantActivated()` cannot leak between cases.
  - **A — happy path lifecycle**: u-admin (seeded global owner) grants
    editor on W1 to u1 → u1 reads W1 successfully → u-admin revokes →
    u1 reads W1 throws `MultiTenantForgeryError`.
  - **B — non-owner denial**: u-editor (seeded with editor on W1)
    calls `roles.grant` → `{error:'permission-denied',
    reason:'no-owner-grant'}`.
  - **C — global-owner override**: u-admin grants on W2 even with no
    W2-scoped grant → `{ok:true}`.
  - **D — idempotent revoke**: revoking a never-created grant returns
    `{ok:true, revoked:false}` (no throw).
  - **E — invalidation**: grant editor on W1 to u1 → resolver returns
    `['W1']`; revoke → resolver returns `[]` immediately.

## 5. Expected failing test output

The e2e test file did not exist before this ticket. The expected
"failing" baseline is therefore "file not found":

```
bun test v1.3.13 (...)
error: Cannot find file 'packages/server-core/src/handlers/rpc/__tests__/rbac-e2e.test.ts'
```

Because the backend (T224-T227) is already in place, the test passes on
first wire-up. If a scenario had failed, the failure would have been a
backend regression — see Section 10.

## 6. Implementation changes

- Added `packages/server-core/src/handlers/rpc/__tests__/rbac-e2e.test.ts`
  (the only test). The test uses `spawnSync('bun', ['run', runnerPath])`
  to isolate multi-tenant runtime state per scenario. The runner:
  - Imports the production `registerRolesCoreHandlers` and
    `registerWorkspaceCoreHandlers` registrars and a real
    `RbacResolver` over a shared `InMemoryGrantStore` seeded with a
    single global-owner grant for `u-admin`.
  - Writes workspace fixtures for `W1` and `W2` under
    `<configRoot>/tenants/<workspaceId>/config.json` so the
    multi-tenant `getWorkspaces` path can read the workspace record
    after the resolver permits the scope.
  - Captures handlers into a `Map<channel, handler>` via a fake
    `RpcServer`, then drives the lifecycle by calling the handlers
    with `RequestContext` objects bound to `u-admin`, `u1`, `u-editor`,
    etc.
  - Reports per-step outcomes as JSON on stdout so the parent harness
    can assert against named steps.
- Added `docs/tickets/T229-rbac-integration-tests.md` (TEMPLATE.md
  shape).
- This worklog (11 sections).

No production code modified. The backend was already wired by T224-T227
and the test passed on the first run, so no implementation iteration
was required.

## 7. Validation commands run

- `bun test packages/server-core/src/handlers/rpc/__tests__/rbac-e2e.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-rbac-wire.test.ts`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

```
$ bun test packages/server-core/src/handlers/rpc/__tests__/rbac-e2e.test.ts
bun test v1.3.13 (bf2e2cec)
 5 pass
 0 fail
 23 expect() calls
Ran 5 tests across 1 file. [906.00ms]

$ bun test packages/server-core/src/handlers/rpc/__tests__/roles.test.ts
 30 pass / 0 fail / 34 expect() calls

$ bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts
 54 pass / 0 fail / 54 expect() calls

$ bun test packages/server-core/src/handlers/rpc/__tests__/workspace-rbac-wire.test.ts
 5 pass / 0 fail / 19 expect() calls

$ bun run validate:rebrand
rebrand validation passed: no forbidden tokens outside the allowlist

$ git diff --check
(clean)
```

## 9. Build output summary

No build was run. T229 is a pure test addition with zero production
code changes; the full build is exercised in T228 when the admin UI
lands.

## 10. Remaining risks

- The five scenarios all assert against the in-memory store. A future
  Postgres-backed `GrantStore` must preserve the same revoke semantics
  (exact-field equality matching) or the lifecycle test will start
  failing after the migration. The contract is captured in T227's
  Section 10 and remains the right place to formalise it.
- `RbacResolver.invalidateUser` is a documented no-op today. The
  scenario E assertion ("resolver returns `[]` immediately after
  revoke") only holds because `InMemoryGrantStore.revoke` removes the
  grant synchronously and the resolver always re-reads the store on
  `permittedWorkspacesForUser`. The first caching layer that lands
  MUST override `invalidateUser` or scenario E will regress.
- The e2e test exercises only `workspaces.GET`. Other workspace-scoped
  channels (theme.GET_*, views.LIST, …) inherit the same
  `deriveWorkspaceScope` path so they are covered transitively, but a
  future ticket may want to parametrise scenario A across the channel
  matrix the way `workspace-scope.test.ts` does for C.4.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Scenario A (happy path lifecycle) passes | Green | rbac-e2e.test.ts run, 5/5 |
| Scenario B (non-owner denial) passes | Green | rbac-e2e.test.ts run, 5/5 |
| Scenario C (global owner override) passes | Green | rbac-e2e.test.ts run, 5/5 |
| Scenario D (idempotent revoke) passes | Green | rbac-e2e.test.ts run, 5/5 |
| Scenario E (invalidation after revoke) passes | Green | rbac-e2e.test.ts run, 5/5 |
| T227 roles.test.ts regression remains green | Green | 30/30 pass |
| C.4 workspace-scope.test.ts regression remains green | Green | 54/54 pass |
| T226 workspace-rbac-wire.test.ts regression remains green | Green | 5/5 pass |
| `validate:rebrand` exits 0 | Green | Section 8 |
| Worklog complete | Green | All 11 sections present |
| Commit created | Green | Atomic commit per Lore protocol |
