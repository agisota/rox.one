# T204 - C4 storage submodule scope enforcement

Status: DONE

## Context

We are building a white-label fork of Craft Agents OSS into Agent Workbench Suite.

Relevant product goals:

- managed web/cloud app
- user/team workspaces
- validation gates
- TDD-first implementation

## Goal

Wire the eight shared storage submodules through `getConfigDirForScope()` and narrow their scoped function parameters to `BrandedWorkspaceScope`, so unbranded scope literals fail at storage call sites and tenant-prefixed runtime paths work through real storage APIs.

## Required UI

None.

## Required Data/API

- Change scoped public storage submodule parameters from `WorkspaceScope` to `BrandedWorkspaceScope`.
- Route submodule path helpers through `getConfigDirForScope(_scope)`.
- Preserve default `DEFAULT_LOCAL_SCOPE` parameters for this slice.
- Propagate `_scope` through internal calls between storage submodules.

## Required Automations

None beyond existing resolver audit events from T203.

## Required Subagents

Storage explorer output from T202 applies. No additional subagent is needed for this mechanical enforcement ticket.

## TDD Requirements

Before implementation:

1. Extend `packages/shared/src/config/__tests__/storage-scope.test.ts` with a storage-drafts tenant-path regression.
2. Add a compile-time `@ts-expect-error` check showing unbranded scope literals cannot be passed to a storage submodule.
3. Run targeted test and typecheck, confirming the expected failures before implementation.

## Implementation Requirements

Do not change single-user layout. Do not remove default parameters yet. Do not touch out-of-scope Electron handlers.

## Validation Commands

- `bun test packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope-runtime.test.ts`
- `bun run typecheck`

## Acceptance Criteria

- [x] `setSessionDraft` with a branded workspace scope writes under `tenants/<workspaceId>/drafts.json`.
- [x] Unbranded scope literals fail typecheck at storage submodule call sites.
- [x] All eight scoped storage submodules accept `BrandedWorkspaceScope`.
- [x] Direct storage-root path helpers use `getConfigDirForScope()`.
- [x] Existing auth/runtime/resolver tests still pass.
- [x] Tests pass.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T204-c4-storage-submodule-scope-enforcement.md`.
