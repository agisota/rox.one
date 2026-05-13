# T226 - RBAC session permittedWorkspaces wiring

Status: DONE

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

T225 landed `permittedWorkspaces(grants)` as a pure function in
`packages/shared/src/auth/policy-engine.ts`. T226 wires that function into the
runtime path that produces `session.permittedWorkspaces` — the array that
`deriveScopeFromAuth` (C.4) consumes when deciding whether a multi-tenant
request may touch a tenant workspace.

Today two RPC helpers build `permittedWorkspaces` from
`AccountStore.listWorkspaceIds(userId)`:

- `packages/server-core/src/handlers/rpc/workspace.ts` → `deriveWorkspaceScope`
- `packages/server-core/src/handlers/rpc/storage-scope.ts` → `deriveRpcWorkspaceScope`

T226 inserts an `RbacResolver` indirection between those helpers and the
policy engine. When a resolver is wired into `HandlerDeps`, the call sites
read `permittedWorkspaces` from RBAC grants. When no resolver is wired (the
current default), behaviour is bit-identical to the pre-change path — the
helpers still call `AccountStore.listWorkspaceIds(userId)` and forward the
result to `deriveScopeFromAuth`. This swap replaces C.4's "always permit"
stub for the multi-tenant path without forcing every host to ship a real
grant store yet.

## Goal

Land a `RbacResolver` class (in `packages/shared/src/auth/rbac-resolver.ts`)
that:

- Accepts a `GrantStore` interface (read-only, async).
- Exposes `permittedWorkspacesForUser(userId)` returning the policy-engine
  output.
- Ships with an `InMemoryGrantStore` fake suitable for tests and for single-
  user runtimes that have no persisted grants yet.

Wire the resolver into the two RPC scope helpers above as an optional
dependency on `HandlerDeps`. When the resolver is present, the helpers use
its output. When it is absent, the fall-back path is unchanged. The
existing C.4 `deriveScopeFromAuth` invariants — single-user flat storage,
permitted multi-tenant routing, `MultiTenantForgeryError` for non-permitted
ids — remain intact.

## Required UI

None.

## Required Data/API

- `GrantStore.grantsForUser(userId)` → `ReadonlyArray<RoleGrant>` (async).
- `InMemoryGrantStore` implementing `GrantStore`, seeded with an optional
  initial grant array, indexed by `actorId`, ignoring `team` actors for now.
- `RbacResolver(grantStore).permittedWorkspacesForUser(userId)` →
  `ReadonlyArray<string>`, delegating to the T225 `permittedWorkspaces`
  helper.
- `HandlerDeps.rbacResolver?: RbacResolver` — optional. Default `undefined`.

## Required Automations

None.

## Required Subagents

None. T224 + T225 already landed the schema and engine; T226 is wire-in only.

## TDD Requirements

Before implementation:

1. Write unit tests in
   `packages/shared/src/auth/__tests__/rbac-resolver.test.ts` covering:
   - Empty `GrantStore` → `permittedWorkspacesForUser` returns `[]`.
   - Single workspace grant → returns the matching scope id.
   - Global grant → returns the T225 sentinel `['*']`.
   - User isolation: grants for `u1` do not leak to `u2`.
   - Multiple workspace grants → deduplicated union of scope ids.
2. Write integration tests in
   `packages/server-core/src/handlers/rpc/__tests__/workspace-rbac-wire.test.ts`
   covering:
   - When `HandlerDeps.rbacResolver` is provided, the workspace RPC helper
     populates `session.permittedWorkspaces` from the resolver.
   - When the resolver is absent, the existing `AccountStore.listWorkspaceIds`
     path is preserved (C.4 backwards compatibility).
   - The `MultiTenantForgeryError` semantics survive the wire-in.
3. Run tests and confirm they fail because the resolver module does not yet
   exist.
4. Implement the minimum module + wire-in needed to make them pass without
   regressing the C.4 `workspace-scope.test.ts` suite.

## Implementation Requirements

- Add `packages/shared/src/auth/rbac-resolver.ts` exporting `GrantStore`,
  `InMemoryGrantStore`, and `RbacResolver`.
- Wire the new module into `packages/shared/src/auth/index.ts` and add a
  subpath export entry in `packages/shared/package.json`
  (`./auth/rbac-resolver`).
- Extend `HandlerDeps` with an optional `rbacResolver?: RbacResolver` field.
- Modify `deriveWorkspaceScope` in
  `packages/server-core/src/handlers/rpc/workspace.ts` and
  `deriveRpcWorkspaceScope` in
  `packages/server-core/src/handlers/rpc/storage-scope.ts` so that when
  `deps.rbacResolver` is provided, the helper sources the
  `permittedWorkspaces` array from
  `deps.rbacResolver.permittedWorkspacesForUser(ctx.userId)`. Otherwise the
  pre-change `AccountStore.listWorkspaceIds(ctx.userId)` path is preserved.
- Do not edit `roles.list`/`roles.create`/`roles.grant` RPC handlers (T227),
  any admin UI (T228), the integration suite (T229), or the ADR (T230).

## Validation Commands

- `bun test packages/shared/src/auth/__tests__/rbac-resolver.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-rbac-wire.test.ts`
- `bun test packages/shared/src/auth/__tests__/policy-engine.test.ts`
- `bun test packages/shared/src/auth/__tests__/roles-schema.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [ ] `RbacResolver` returns the T225 policy-engine output for the user.
- [ ] `InMemoryGrantStore` indexes grants by `actorId` and ignores team actors.
- [ ] `HandlerDeps.rbacResolver` is optional; default behaviour is unchanged.
- [ ] When the resolver is provided, the RPC scope helpers source
      `session.permittedWorkspaces` from RBAC grants.
- [ ] C.4 `workspace-scope.test.ts` regression remains green.
- [ ] Resolver unit tests pass.
- [ ] Integration wire-in tests pass.
- [ ] `validate:rebrand` exits 0.
- [ ] Worklog complete.
- [ ] Commit created.

## Out of scope for this cycle

T227 (admin RPC for role CRUD), T228 (admin UI), T229 (RBAC E2E), and T230
(ADR `0009-rbac-policy.md`) are explicitly deferred to subsequent cycles.
T226 only introduces the resolver indirection and the optional wire-in.
Persisted grant storage and admin flows land later.

## Worklog

Update `docs/worklog/T226-rbac-session-permitted-workspaces.md`.
