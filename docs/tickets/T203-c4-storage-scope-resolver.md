# T203 - C4 storage scope path resolver

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.

Relevant product goals:

- managed web/cloud app
- user/team workspaces
- validation gates
- TDD-first implementation

## Goal

Add the C4 storage path resolver so branded local scopes keep the existing flat config directory and branded workspace scopes resolve to tenant-prefixed directories only when multi-tenant runtime is activated.

## Required UI

None.

## Required Data/API

- Add `getConfigDirForScope(scope: BrandedWorkspaceScope): string` to `storage-internal.ts`.
- Add `BrandedScopeBreachError` to `storage-internal.ts`.
- Keep `DEFAULT_LOCAL_SCOPE` resolving to `getConfigDir()`.
- Resolve workspace scopes to `<configDir>/tenants/<workspaceId>` only when `ROX_MULTI_TENANT=1` or the test override activates multi-tenant mode.
- Downgrade workspace scopes to `getConfigDir()` in single-user mode.

## Required Automations

Emit structured audit signals through the existing shared logger:

- `scope.runtime.workspace_downgraded`
- `scope.brand.cast_breach`

## Required Subagents

Storage explorer output from T202 applies. No additional subagent is needed for this narrow resolver ticket.

## TDD Requirements

Before implementation:

1. Extend `packages/shared/src/config/__tests__/storage-scope.test.ts`.
2. Run the extended test and confirm it fails because `getConfigDirForScope` and `BrandedScopeBreachError` do not exist yet.
3. Implement the minimal resolver and runtime breach check.

## Implementation Requirements

Do not change the single-user on-disk layout. Do not export the private brand symbol or brand applier from `storage-scope-auth.ts`.

## Validation Commands

- `bun test packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope-runtime.test.ts`
- `bun run typecheck`

## Acceptance Criteria

- [x] `DEFAULT_LOCAL_SCOPE` resolves to `getConfigDir()`.
- [x] Branded workspace scope resolves to `<configDir>/tenants/<workspaceId>` when multi-tenant mode is active.
- [x] Branded workspace scope downgrades to `getConfigDir()` when multi-tenant mode is inactive.
- [x] Unbranded scope-shaped objects throw `BrandedScopeBreachError`.
- [x] Cast-breach and downgrade audit events are observable.
- [x] Tests pass.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T203-c4-storage-scope-resolver.md`.
