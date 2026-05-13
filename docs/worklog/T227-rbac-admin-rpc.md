# T227 - RBAC admin RPC handlers

Status: DONE

## 1. Task summary

Land the four admin RPC handlers (`roles.list`, `roles.create`,
`roles.grant`, `roles.revoke`) with owner-gated mutation guards. Introduce
`RoleStore` + `InMemoryRoleStore`, extend `GrantStore` with `grant`/
`revoke` mutation methods, and add `RbacResolver.ownerGrantsForUser` plus
the `invalidateUser` cache-bust contract. Wire the handler module into the
core RPC registration entry point. T228 (admin UI), T229 (RBAC E2E), and
T230 (ADR) remain deferred.

## 2. Repo context discovered

- T226 landed the `RbacResolver` indirection
  (`packages/shared/src/auth/rbac-resolver.ts`) and the `InMemoryGrantStore`
  read-only fake. The resolver delegates to T225's pure-function
  `permittedWorkspaces` engine and is opt-in via
  `HandlerDeps.rbacResolver`.
- Existing RPC handlers register via the per-domain pattern in
  `packages/server-core/src/handlers/rpc/<domain>.ts`; the central
  `registerCoreRpcHandlers` in
  `packages/server-core/src/handlers/rpc/index.ts` invokes each registrar
  exactly once. T227 follows the same shape.
- Channels live under `packages/shared/src/protocol/channels.ts` in the
  `RPC_CHANNELS` constant; the `getAllChannelValues` helper feeds the
  routing tests.
- The single-process test harness pattern from
  `packages/server-core/src/handlers/rpc/system.open-url.test.ts` (handler
  registered into a fake `RpcServer`, invoked directly with a
  `RequestContext`) is suitable for T227. The spawn-sub-`bun` pattern from
  `workspace-rbac-wire.test.ts` is unnecessary because the handlers do not
  read filesystem fixtures.
- `HandlerDeps` already carries `rbacResolver?: RbacResolver` from T226.
  T227 adds `roleStore?: RoleStore` and `grantStore?: GrantStore`.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
  (Phase 2 §4 cluster, `T227-rbac-admin-rpc`).
- `docs/tickets/T226-rbac-session-permitted-workspaces.md` and worklog.
- `docs/tickets/TEMPLATE.md`.
- `packages/shared/src/auth/rbac-resolver.ts`,
  `packages/shared/src/auth/roles-schema.ts`,
  `packages/shared/src/auth/policy-engine.ts`,
  `packages/shared/src/auth/index.ts`,
  `packages/shared/package.json`.
- `packages/shared/src/protocol/channels.ts`.
- `packages/server-core/src/handlers/handler-deps.ts`.
- `packages/server-core/src/handlers/rpc/index.ts`,
  `packages/server-core/src/handlers/rpc/workspace.ts`,
  `packages/server-core/src/handlers/rpc/labels.ts`,
  `packages/server-core/src/handlers/rpc/storage-scope.ts`.
- `packages/server-core/src/handlers/rpc/system.open-url.test.ts` (test
  harness pattern).
- `packages/server-core/src/handlers/rpc/__tests__/workspace-rbac-wire.test.ts`
  (T226 regression).
- `packages/shared/src/auth/__tests__/rbac-resolver.test.ts` (T226 unit
  tests).
- `.swarm/master-roadmap-log.md`.

## 4. Tests added first

- `packages/shared/src/auth/__tests__/role-store.test.ts`:
  - Empty `InMemoryRoleStore.list()` returns `SYSTEM_ROLES`.
  - After `create({id: 'custom', name: 'Custom', systemManaged: false})`,
    `list()` includes the custom role.
  - `create({id: 'owner', ...})` throws because `owner` is a system role.
  - Custom role with empty `id` is rejected.
- `packages/shared/src/auth/__tests__/rbac-resolver.test.ts` extended with:
  - `InMemoryGrantStore.grant(g)` adds the grant; subsequent
    `grantsForUser` returns it.
  - `InMemoryGrantStore.revoke(g)` returns `true` when removed, `false`
    when nothing matched.
  - `RbacResolver.ownerGrantsForUser(userId)` returns only the user's
    `owner`-roleId grants, ignoring `editor`/`viewer` and team-actor
    grants.
  - `RbacResolver.invalidateUser(userId)` is a callable no-op (does not
    mutate store).
- `packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`:
  - Test harness uses an in-process fake `RpcServer` (same pattern as
    `system.open-url.test.ts`) wired to a real `RbacResolver` over an
    `InMemoryGrantStore`.
  - `roles.list`: returns `SYSTEM_ROLES` for callers with no grants;
    returns `SYSTEM_ROLES + custom` after a successful `roles.create`.
  - `roles.create`: rejects unauthorised callers
    (`permission-denied`), rejects system-id collisions
    (`role-id-conflict`), succeeds for global-owner.
  - `roles.grant`: rejects unauthorised callers, rejects invalid
    `actorKind`/`scopeKind`/`roleId`, succeeds for scope-owner and for
    global-owner.
  - `roles.revoke`: idempotent (`{revoked: false}` when no match), rejects
    unauthorised callers, succeeds for scope-owner; verifies
    `resolver.permittedWorkspacesForUser(affected)` reflects the change
    afterwards (invalidation hook fired).

## 5. Expected failing test output

```
bun test v1.3.13 (...)

packages/shared/src/auth/__tests__/role-store.test.ts:
error: Cannot find module '../role-store' from
'/tmp/rox-m2-t227/packages/shared/src/auth/__tests__/role-store.test.ts'

packages/server-core/src/handlers/rpc/__tests__/roles.test.ts:
error: Cannot find module '../roles' from
'/tmp/rox-m2-t227/packages/server-core/src/handlers/rpc/__tests__/roles.test.ts'

packages/shared/src/auth/__tests__/rbac-resolver.test.ts:
fail — InMemoryGrantStore has no `grant` method
fail — RbacResolver has no `ownerGrantsForUser` method
fail — RbacResolver has no `invalidateUser` method
```

## 6. Implementation changes

- Added `packages/shared/src/auth/role-store.ts` exporting `RoleStore` and
  `InMemoryRoleStore`. Custom roles are kept in a `Map<string, Role>` keyed
  by id; system-role-id collisions throw.
- Extended `packages/shared/src/auth/rbac-resolver.ts`:
  - `GrantStore` interface gains `grant(grant)` (returns `void`) and
    `revoke(grant)` (returns `boolean`).
  - `InMemoryGrantStore` implements both. Revocation matches grants by
    exact field equality (`roleId`, `actorKind`, `actorId`, `scopeKind`,
    `scopeId`).
  - `RbacResolver` gains `ownerGrantsForUser(userId)` filtering grants
    where `roleId === 'owner'`, and `invalidateUser(userId)` as a no-op
    stub with a docstring documenting the future caching contract.
- Added `RPC_CHANNELS.roles` namespace in
  `packages/shared/src/protocol/channels.ts`:
  - `roles:list`, `roles:create`, `roles:grant`, `roles:revoke`.
- Added `packages/server-core/src/handlers/rpc/roles.ts` exporting
  `registerRolesCoreHandlers(server, deps)`. The handlers:
  - Share an internal `requireOwner(deps, ctx, scopeKind, scopeId)` helper
    that returns `{ok: true}` for global owners or scope-matching owners,
    and `{ok: false, reason}` otherwise.
  - `roles.list` is unguarded (returns `SYSTEM_ROLES` plus custom roles).
  - `roles.create` requires a `global` owner grant and a configured
    `roleStore`. Rejects system-id collisions before delegating to
    `roleStore.create`.
  - `roles.grant` validates `actorKind`, `scopeKind`, and `roleId` (against
    `SYSTEM_ROLES` plus the role store) before calling
    `deps.grantStore.grant`. Owner-gated on the target scope.
  - `roles.revoke` calls `deps.grantStore.revoke`. If the revoke removed a
    grant, calls `deps.rbacResolver.invalidateUser(grant.actorId)`.
- Extended `HandlerDeps` in
  `packages/server-core/src/handlers/handler-deps.ts` with optional
  `roleStore?: RoleStore` and `grantStore?: GrantStore` fields.
- Wired the new module into
  `packages/server-core/src/handlers/rpc/index.ts` by calling
  `registerRolesCoreHandlers(server, deps)`.
- Wired `role-store.ts` into `packages/shared/src/auth/index.ts` via
  `export * from './role-store.ts'` and added the `./auth/role-store`
  subpath export in `packages/shared/package.json`.

## 7. Validation commands run

- `bun test packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`
- `bun test packages/shared/src/auth/__tests__/`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-rbac-wire.test.ts`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

See live run results in commit message body / PR description.

## 9. Build output summary

No build was run. T227 is an additive backend slice — the full build is
exercised in T228 when the admin UI lands.

## 10. Remaining risks

- The grant-store contract uses field equality for revoke matching. Hosts
  that ship a database-backed `GrantStore` later must implement the same
  semantics or revocation will silently no-op for already-stored grants
  that differ by an opaque DB id. A future ticket should formalise the
  contract (likely a `GrantId` opaque value).
- `RbacResolver.invalidateUser` is a documented no-op today. The first
  caching layer that lands (likely the Postgres-backed store) must
  override this to actually evict stale grants, or stale `permittedWorkspaces`
  arrays will persist across the invalidation boundary.
- The admin RPC channels are now part of the wire-format surface (`roles:list`,
  `roles:create`, `roles:grant`, `roles:revoke`). Future renaming requires
  a backwards-compatible alias and a migration window.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `roles.list` returns SYSTEM_ROLES plus custom roles | Green | `roles.test.ts` list cases |
| `roles.create` is owner-gated and rejects system-id collisions | Green | `roles.test.ts` create cases |
| `roles.grant` is owner-gated and validates arguments | Green | `roles.test.ts` grant cases |
| `roles.revoke` is owner-gated, idempotent, calls `invalidateUser` | Green | `roles.test.ts` revoke cases |
| Global owner can mutate any scope | Green | `roles.test.ts` global-owner cases |
| `RoleStore` unit tests pass | Green | `role-store.test.ts` |
| `GrantStore` mutation tests pass | Green | `rbac-resolver.test.ts` extended cases |
| Resolver `ownerGrantsForUser` + `invalidateUser` tests pass | Green | `rbac-resolver.test.ts` extended cases |
| T226 wire regression remains green | Green | `workspace-rbac-wire.test.ts` |
| C.4 regression remains green | Green | `workspace-scope.test.ts` |
| `validate:rebrand` exits 0 | Green | Section 7 |
| Worklog complete | Green | All 11 sections present |
| Commit created | Green | Atomic commits per Lore protocol |
