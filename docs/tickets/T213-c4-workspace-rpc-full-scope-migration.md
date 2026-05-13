# T213 - C4 workspace RPC full scope migration

Status: DONE

## Context

We are building a white-label fork of Craft Agents OSS into Agent Workbench Suite.

Relevant product goals:

- managed web/cloud app
- user/team workspaces
- multi-tenant storage isolation
- validation gates
- TDD-first implementation

## Goal

Migrate every remaining `packages/server-core/src/handlers/rpc/workspace.ts`
storage call marked with `TODO(C4): use deriveScopeFromAuth when ready` to a
branded scope derived from trusted request auth context.

## Required UI

None.

## Required Data/API

- Preserve existing single-user behavior while `ROX_MULTI_TENANT` is disabled.
- In multi-tenant mode, route workspace RPC reads and writes through
  `deriveScopeFromAuth()`.
- Use handler workspace arguments as the requested workspace when the RPC
  carries one; otherwise use `ctx.workspaceId`.
- Remove every `TODO(C4): use deriveScopeFromAuth when ready` marker from
  `workspace.ts`.
- Do not modify Electron main handlers in this ticket.

## Required Automations

None beyond existing audit emission in `deriveScopeFromAuth()`.

## Required Subagents

Use a read-only backend/test-harness explorer for handler mapping before
implementation.

## TDD Requirements

Before implementation:

1. Extend `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`.
2. Add child-process integration scenarios for the remaining handler groups.
3. Confirm flat single-user behavior, tenant-prefixed behavior, and forgery
   rejection fail for the unmigrated handlers for the expected reason.

## Implementation Requirements

- Reuse the existing `deriveWorkspaceScope()` helper rather than introducing a
  second scope factory path.
- Keep account ownership checks in place.
- Do not weaken branded storage-scope enforcement.
- Keep changes tightly scoped to `workspace.ts`, its C4 scope test, and this
  ticket/worklog.

## Validation Commands

- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts`
- `cd packages/server-core && bunx tsc --noEmit`
- `bun test`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] Every remaining `workspace.ts` C4 TODO handler has child-process coverage.
- [x] Single-user flat storage behavior is preserved.
- [x] Multi-tenant permitted requests read/write tenant-prefixed storage.
- [x] Multi-tenant workspace forgery rejects with `MultiTenantForgeryError`.
- [x] Zero `TODO(C4): use deriveScopeFromAuth when ready` markers remain in
      `workspace.ts`.
- [x] Targeted workspace scope tests pass.
- [x] C4 storage/auth/runtime regression tests pass.
- [x] Server-core typecheck passes.
- [x] Full relevant validation passes or precise blockers are documented.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T213-c4-workspace-rpc-full-scope-migration.md`.
