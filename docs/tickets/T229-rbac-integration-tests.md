# T229 - RBAC end-to-end integration test

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

T224-T227 landed the M.2 RBAC backend: roles schema (T224), pure-function
policy engine (T225), `RbacResolver` wired into `session.permittedWorkspaces`
via `deriveScopeFromAuth` (T226), and the admin RPC handlers (`roles.list`,
`roles.create`, `roles.grant`, `roles.revoke`) with owner-gated mutation
guards plus `invalidateUser` cache-bust contract (T227). T228 lands the
admin UI in a parallel cycle.

T229 is the stopping-condition test for Phase 2 (per the master roadmap):
prove the full lifecycle end-to-end by composing the admin RPC handlers
with the workspace-read path that the resolver feeds. The lifecycle:

```
invite user u1 → grant 'editor' role on workspace W1 → u1 can read W1 →
revoke grant → u1 can no longer read W1
```

This ticket adds the e2e integration test only. The backend is already
wired; T229 does not change production code. If T229 surfaces a real
backend bug, that is a T226 / T227 regression and is logged separately.

## Goal

Land a single integration test file
(`packages/server-core/src/handlers/rpc/__tests__/rbac-e2e.test.ts`)
covering the five scenarios below. The test exercises the full chain:
`InMemoryGrantStore` → `RbacResolver` → `roles.grant` RPC →
`deriveRpcWorkspaceScope` → `workspaces.GET` RPC, plus the symmetric
revoke path. Each scenario boots fresh stores so cases are independent.

## Required UI

None. The lifecycle is exercised through RPC handlers only; UI parity
lands in T228.

## Required Data/API

No production code changes. The test reuses:

- `RbacResolver`, `InMemoryGrantStore`, `InMemoryRoleStore` from
  `@rox-one/shared/auth`.
- `registerRolesCoreHandlers` from
  `packages/server-core/src/handlers/rpc/roles.ts`.
- `registerWorkspaceCoreHandlers` from
  `packages/server-core/src/handlers/rpc/workspace.ts` (the
  `workspaces.GET` handler, which calls `deriveWorkspaceScope` which
  calls `resolvePermittedWorkspaces` which calls
  `RbacResolver.permittedWorkspacesForUser`).
- Multi-tenant runtime toggles
  (`__setMultiTenantForTests`, `__resetMultiTenantForTests`) from
  `packages/shared/src/config/storage-scope-runtime.ts`.
- Child-process spawn harness pattern from `workspace-scope.test.ts` /
  `workspace-rbac-wire.test.ts` so each scenario runs in an isolated
  `ROX_CONFIG_DIR` and multi-tenant flag state.

### Scenarios

- **A — happy path lifecycle**:
  1. `u-admin` (global owner grant seeded) calls `roles.grant({roleId:
     'editor', actorKind:'user', actorId:'u1', scopeKind:'workspace',
     scopeId:'W1'})` → succeeds.
  2. `u1` calls `workspaces.GET` with `ctx.workspaceId='W1'` → returns
     workspace data including `W1`.
  3. `u-admin` calls `roles.revoke` with the same grant → `{revoked:true}`.
  4. `u1` calls `workspaces.GET` with `ctx.workspaceId='W1'` → throws
     `MultiTenantForgeryError`.

- **B — non-owner cannot grant**:
  1. As `u-editor` (only an `editor` grant on W1), call `roles.grant`
     → `{error:'permission-denied', reason:'no-owner-grant'}`.

- **C — global owner can grant anywhere**:
  1. As `u-admin` (global owner), call `roles.grant` for workspace `W2`
     where the admin has no workspace-scoped grant → `{ok:true}`.

- **D — idempotent revoke**:
  1. Call `roles.revoke` for a grant that was never created → no throw,
     `{revoked:false}`.

- **E — invalidation after revoke**:
  1. Grant `u1` `editor` on `W1`. Resolver returns `['W1']`.
  2. Revoke that grant.
  3. Resolver returns `[]` immediately after revoke (no caching staleness).

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Before implementation:

1. Write `packages/server-core/src/handlers/rpc/__tests__/rbac-e2e.test.ts`
   covering all five scenarios above.
2. Run the new test and confirm a clear baseline (file did not exist
   prior; scenarios pass once the test scaffolding is correctly wired).
3. Confirm `roles.test.ts`, `workspace-scope.test.ts`, and
   `workspace-rbac-wire.test.ts` remain green (no production-code
   changes).

## Implementation Requirements

- No production code changes. T229 only adds the integration test.
- The test file uses the same child-process spawn pattern as
  `workspace-rbac-wire.test.ts` so multi-tenant runtime toggles and
  fixture roots are isolated per scenario.
- The runner imports the production handler registrars and wires a fake
  `RpcServer` that captures handlers into a `Map<channel, handler>`.
- If the test surfaces a real backend bug (e.g. resolver doesn't
  actually invalidate, scope helper bypasses resolver), STOP and report
  rather than silently patching backend code in this ticket.

## Validation Commands

- `bun test packages/server-core/src/handlers/rpc/__tests__/rbac-e2e.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-rbac-wire.test.ts`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [ ] Scenario A (happy path lifecycle) passes.
- [ ] Scenario B (non-owner denial) passes.
- [ ] Scenario C (global owner override) passes.
- [ ] Scenario D (idempotent revoke) passes.
- [ ] Scenario E (invalidation after revoke) passes.
- [ ] T227 `roles.test.ts` regression remains green.
- [ ] C.4 `workspace-scope.test.ts` regression remains green.
- [ ] T226 `workspace-rbac-wire.test.ts` regression remains green.
- [ ] `validate:rebrand` exits 0.
- [ ] Worklog complete.
- [ ] Commit created.

## Out of scope for this cycle

T228 (admin UI), T230 (ADR `0009-rbac-policy.md`), and DB-backed
`RoleStore`/`GrantStore` implementations are explicitly deferred. T229
adds the e2e test only; backend changes (if any are required) are
delegated to a separate ticket per the no-silent-fix rule.

## Worklog

Update `docs/worklog/T229-rbac-integration-tests.md`.
