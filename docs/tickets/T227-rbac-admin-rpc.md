# T227 - RBAC admin RPC handlers

Status: IN_PROGRESS

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.

Relevant product goals:

- local desktop app
- managed web/cloud app
- user/team workspaces
- prompt modes
- multi-agent workflows
- validation gates
- TDD-first implementation

T226 landed the `RbacResolver` indirection between the RPC scope helpers and
the T225 policy engine. T227 introduces the admin-side RPC surface that
operators use to manage roles and grants:

- `roles.list` — read the role catalog (universally readable; the catalog is
  not sensitive).
- `roles.create` — define a custom role. Owner-gated.
- `roles.grant` — bind a role to (actorKind, actorId) on a (scopeKind,
  scopeId). Owner-gated.
- `roles.revoke` — remove a grant (idempotent). Owner-gated, and invalidates
  the resolver's cache for the affected user.

The mutating handlers require the caller to hold an `owner` role on the
target scope or on `global`. A custom-role create that collides with a
system role id is rejected. Revocation is idempotent: removing a grant that
does not exist returns `{revoked: false}` without erroring.

This cycle introduces a `RoleStore` interface (parallel to T226's
`GrantStore`) for custom roles. The default `InMemoryRoleStore` is used by
tests and any host that does not yet ship persisted storage. A
`HandlerDeps.roleStore?: RoleStore` field is added. When absent the
mutating handlers respond with `{error: 'rbac-not-configured'}`.

T226's `RbacResolver` is extended with two new methods:

- `ownerGrantsForUser(userId)` — returns the user's `owner`-roleId grants.
  Used by the handlers to check whether the caller is an owner of the
  target scope.
- `invalidateUser(userId)` — cache-bust hook called after revoke. The
  current resolver has no cache so this is a stub today; T227 documents the
  contract that future caching layers must observe.

The `GrantStore` interface is extended with `grant(grant)` and
`revoke(grant)` mutation methods, both implemented by `InMemoryGrantStore`.

## Goal

Land the four RPC handlers above with their owner-gated mutation guards,
the `RoleStore` interface plus `InMemoryRoleStore` fake, the `GrantStore`
mutation methods, the resolver cache-busting hook, and the handler
registration wire-in. C.4 invariants and the T226 resolver wire stay
intact.

## Required UI

None. Admin UI ships in T228.

## Required Data/API

- `RoleStore` interface: `list()` and `create(role)` (async).
- `InMemoryRoleStore` — default in-memory fake; rejects ids that collide
  with `SYSTEM_ROLES`.
- `GrantStore` interface mutation methods: `grant(grant)` and
  `revoke(grant)` (async). `revoke` returns `true` if a grant was removed,
  `false` if nothing matched.
- `InMemoryGrantStore` implementation of the mutation methods, keyed by
  `actorId`.
- `RbacResolver.ownerGrantsForUser(userId)` — returns the subset of the
  user's grants whose `roleId === 'owner'`.
- `RbacResolver.invalidateUser(userId)` — no-op stub today; documented
  contract for future caching layers.
- `HandlerDeps.roleStore?: RoleStore` — optional. Default `undefined`.
- RPC channels under the `roles` namespace:
  - `roles:list`
  - `roles:create`
  - `roles:grant`
  - `roles:revoke`

### Permission rules

Mutating handlers (`roles.create`, `roles.grant`, `roles.revoke`):

- Caller must have `ctx.userId`. Anonymous callers receive
  `{error: 'permission-denied', reason: 'no-user'}`.
- Caller must have `deps.rbacResolver` wired. If absent,
  `{error: 'rbac-not-configured'}`.
- For `roles.grant` / `roles.revoke`, caller must hold an `owner` grant on
  the target scope (scopeKind + scopeId match) or a `global` `owner` grant.
- For `roles.create`, caller must hold a `global` `owner` grant (custom
  roles are global by definition).
- Mutating handlers also require `deps.roleStore` (for `roles.create`) and
  `deps.grantStore` is not exposed directly; the handlers call through the
  resolver's underlying `GrantStore` provided as `deps.grantStore?:
  GrantStore`.

`roles.list` is universally allowed: the catalog is not sensitive.

### Argument validation

- `roles.create`: `Role.id` must be non-empty and must not match any
  `SYSTEM_ROLES.id`. Returns `{error: 'role-id-conflict'}` on collision.
- `roles.grant`: `actorKind ∈ {'user','team'}`,
  `scopeKind ∈ {'workspace','org','global'}`, `roleId` must exist (in
  `SYSTEM_ROLES` or in the role store). Returns
  `{error: 'invalid-argument', reason}` on invalid input.
- `roles.revoke`: same shape as grant. Idempotent.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Before implementation:

1. Write unit tests in
   `packages/shared/src/auth/__tests__/role-store.test.ts` covering:
   - Empty `InMemoryRoleStore` returns `SYSTEM_ROLES` from `list()`.
   - Custom role created → `list()` includes the new role.
   - Creating a role whose id collides with a system role throws.
2. Write unit tests in
   `packages/shared/src/auth/__tests__/rbac-resolver.test.ts` (extending
   the T226 file) covering:
   - `InMemoryGrantStore.grant(g)` adds the grant and exposes it via
     `grantsForUser`.
   - `InMemoryGrantStore.revoke(g)` returns `true` when the grant was
     present and `false` otherwise; subsequent `grantsForUser` reflects the
     removal.
   - `RbacResolver.ownerGrantsForUser(userId)` returns only `owner`-roleId
     grants.
   - `RbacResolver.invalidateUser(userId)` runs without error and does not
     mutate the underlying store (no-op stub contract).
3. Write integration tests in
   `packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`
   covering, for each of the four handlers:
   - Happy path: caller with `owner` grant on the target scope succeeds.
   - Permission denied: caller with `editor` grant (or any non-owner) on
     the target scope is rejected.
   - No grants at all: caller is rejected.
   - Global owner: caller with a `global` `owner` grant can mutate any
     scope.
   - `roles.list` returns `SYSTEM_ROLES` even for callers with no grants.
   - `roles.create` rejects custom role id matching a system role id.
   - `roles.grant` validates `actorKind`/`scopeKind`/`roleId`.
   - `roles.revoke` returns `{revoked: false}` when nothing matched.
   - After `roles.revoke`, `resolver.permittedWorkspacesForUser(affected)`
     reflects the change (resolver was invalidated).
4. Run tests and confirm they fail because the handlers do not exist yet.

## Implementation Requirements

- Add `packages/shared/src/auth/role-store.ts` exporting `RoleStore` and
  `InMemoryRoleStore`.
- Extend `GrantStore` interface with `grant(grant)` and `revoke(grant)`;
  implement them in `InMemoryGrantStore`.
- Extend `RbacResolver` with `ownerGrantsForUser(userId)` and
  `invalidateUser(userId)`.
- Add `packages/server-core/src/handlers/rpc/roles.ts` exporting
  `registerRolesCoreHandlers(server, deps)`.
- Extend `HandlerDeps` with optional `roleStore?: RoleStore` and
  `grantStore?: GrantStore` fields. Both default to `undefined`.
- Wire the new module into
  `packages/server-core/src/handlers/rpc/index.ts` so
  `registerCoreRpcHandlers` calls `registerRolesCoreHandlers`.
- Add channel names under `RPC_CHANNELS.roles` in
  `packages/shared/src/protocol/channels.ts`.
- Wire the new module into `packages/shared/src/auth/index.ts` and add a
  subpath export entry `./auth/role-store` in
  `packages/shared/package.json`.
- Do not edit T228 (admin UI), T229 (RBAC E2E), or T230 (ADR
  `0009-rbac-policy.md`).

## Validation Commands

- `bun test packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`
- `bun test packages/shared/src/auth/__tests__/`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-rbac-wire.test.ts`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [ ] `roles.list` returns `SYSTEM_ROLES` plus any custom roles from the
      store.
- [ ] `roles.create` is owner-gated, rejects system-id collisions, and
      adds the custom role to the store.
- [ ] `roles.grant` is owner-gated, validates argument shape, and calls
      `grantStore.grant`.
- [ ] `roles.revoke` is owner-gated, idempotent, and calls
      `resolver.invalidateUser(grant.actorId)` after a successful removal.
- [ ] Global owner can mutate any scope.
- [ ] `RoleStore` unit tests pass.
- [ ] Extended `GrantStore` mutation tests pass.
- [ ] Resolver `ownerGrantsForUser` + `invalidateUser` tests pass.
- [ ] RPC integration tests pass.
- [ ] T226 `workspace-rbac-wire.test.ts` regression remains green.
- [ ] C.4 `workspace-scope.test.ts` regression remains green.
- [ ] `validate:rebrand` exits 0.
- [ ] Worklog complete.
- [ ] Commit created.

## Out of scope for this cycle

T228 (admin UI), T229 (RBAC E2E), and T230 (ADR `0009-rbac-policy.md`) are
explicitly deferred to subsequent cycles. T227 only introduces the admin
RPC handlers, the role store, the grant-store mutation hooks, and the
resolver cache-busting contract. Persisted (DB-backed) implementations of
`RoleStore` and `GrantStore` defer to future Lane M phases.

## Worklog

Update `docs/worklog/T227-rbac-admin-rpc.md`.
