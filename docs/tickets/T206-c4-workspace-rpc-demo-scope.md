# T206 - C4 workspace RPC demo scope

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.

Relevant product goals:

- managed web/cloud app
- user/team workspaces
- validation gates
- TDD-first implementation

## Goal

Wire one read-only webui RPC handler in `packages/server-core/src/handlers/rpc/workspace.ts` through `deriveScopeFromAuth()` end-to-end and add the required C4 integration test.

## Required UI

None.

## Required Data/API

- Use the `workspaces.GET` handler as the demo caller.
- Derive a branded storage scope from request auth context and `ctx.workspaceId`.
- Keep sibling handlers on `DEFAULT_LOCAL_SCOPE` but mark them with `// TODO(C4): use deriveScopeFromAuth when ready`.
- Do not modify `apps/electron/src/main/handlers/*`.

## Required Automations

None beyond existing audit emission in `deriveScopeFromAuth()`.

## Required Subagents

Use existing explorer output for `workspace.ts` handler mapping. No additional subagent required unless the RPC harness is unclear.

## TDD Requirements

Before implementation:

1. Add `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`.
2. Run it and confirm multi-tenant permitted/forgery cases fail against the current default-scope handler.

## Implementation Requirements

The handler must preserve single-user behavior and only route workspace tenant storage when `ROX_MULTI_TENANT=1` is active through the test override.

## Validation Commands

- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts`
- `cd packages/server-core && bunx tsc --noEmit`

## Acceptance Criteria

- [x] `workspaces.GET` derives a branded scope from request auth context and `ctx.workspaceId`.
- [x] Single-user runtime returns flat config data.
- [x] Multi-tenant permitted workspace reads tenant config data.
- [x] Multi-tenant forgery rejects with `MultiTenantForgeryError`.
- [x] Sibling `workspace.ts` default-scope calls have `// TODO(C4): use deriveScopeFromAuth when ready` markers.
- [x] Integration test passes.
- [x] Typecheck passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T206-c4-workspace-rpc-demo-scope.md`.
