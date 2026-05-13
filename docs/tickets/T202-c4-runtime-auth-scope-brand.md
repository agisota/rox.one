# T202 - C4 runtime/auth storage scope brand

## Context

We are building a white-label fork of Craft Agents OSS into Agent Workbench Suite.

Relevant product goals:

- managed web/cloud app
- user/team workspaces
- multi-agent workflows
- validation gates
- TDD-first implementation

## Goal

Introduce the C4 storage scope runtime detector and auth-owned branded scope producer so storage scopes can be trusted at call sites while the single-user runtime continues to resolve to the existing flat layout.

## Required UI

None.

## Required Data/API

- Add `storage-scope-runtime.ts` with `isMultiTenantActivated()`, `__setMultiTenantForTests()`, and `__resetMultiTenantForTests()`.
- Add `storage-scope-auth.ts` with private brand symbol, `BrandedWorkspaceScope`, `DEFAULT_LOCAL_SCOPE`, `deriveScopeFromAuth`, and `MultiTenantForgeryError`.
- Keep `storage-scope.ts` as the unbranded union owner and re-export the branded public API without exporting the brand symbol or applier.
- Update the storage barrel re-exports.

## Required Automations

Emit structured audit signals through the existing shared logger:

- `scope.factory.downgraded`
- `scope.factory.forgery_rejected`

## Required Subagents

Read-only explorers are required for:

- config/workspace storage surface
- backend/server RPC scope harness
- caller migration surface

## TDD Requirements

Before implementation:

1. Add `storage-scope-runtime.test.ts`.
2. Add `storage-scope-auth.test.ts`.
3. Extend `storage-scope.test.ts` only after the auth/runtime foundation exists.
4. Run targeted tests and confirm the expected missing-module/export failures before implementation.

## Implementation Requirements

Implement the minimal auth/runtime scope foundation from the locked C4 design. Do not export the private brand symbol or the `brand()` applier. Do not add production dependencies.

## Validation Commands

- `bun test packages/shared/src/config/__tests__/storage-scope-runtime.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun run typecheck`

## Acceptance Criteria

- [x] `DEFAULT_LOCAL_SCOPE` is branded, frozen, and resolves as the canonical single-user scope.
- [x] `ROX_MULTI_TENANT=1` is the only env value that activates multi-tenant mode.
- [x] Runtime mode reads are memoized and test overrides reset cleanly.
- [x] Single-user runtime returns `DEFAULT_LOCAL_SCOPE` and emits `scope.factory.downgraded` when applicable.
- [x] Multi-tenant runtime permits only `session.permittedWorkspaces`.
- [x] Forgery throws `MultiTenantForgeryError` and emits `scope.factory.forgery_rejected`.
- [x] The brand symbol and `brand()` applier are not exported.
- [x] Tests pass.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T202-c4-runtime-auth-scope-brand.md`.
