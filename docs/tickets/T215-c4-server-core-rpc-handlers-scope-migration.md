# T215 - C4 server-core RPC handlers scope migration

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

Audit and migrate the remaining non-workspace server-core RPC handler storage
calls so workspace-addressed handlers derive authenticated branded scope and
genuinely app/admin-global settings use a documented global local scope helper.

## Required UI

None.

## Required Data/API

- Preserve existing single-user behavior while `ROX_MULTI_TENANT` is disabled.
- In multi-tenant mode, route workspace settings reads/writes through
  `deriveScopeFromAuth()`.
- Keep app-wide preferences, session drafts, Git Bash path, network proxy, and
  LLM connection registry operations global/local unless a handler actually
  carries tenant-bound workspace semantics.
- Any future storage call in these RPC handlers must avoid direct
  `DEFAULT_LOCAL_SCOPE` use and choose either authenticated scope derivation or
  the explicit global storage helper.

## Required Automations

None.

## Required Subagents

Use read-only mapping before implementation.

## TDD Requirements

Before implementation:

1. Add regression coverage for `system.ts`, `settings.ts`, and
   `llm-connections.ts` storage scope decisions.
2. Confirm the test fails because the explicit RPC storage scope helper does
   not exist and/or the handlers still pass direct `DEFAULT_LOCAL_SCOPE`.
3. Include multi-tenant behavior coverage showing workspace settings read from
   tenant-prefixed config while global settings stay in flat local config.

## Implementation Requirements

- Add a small server-core RPC global storage scope helper plus a shared
  `deriveRpcWorkspaceScope()` helper.
- Replace direct `DEFAULT_LOCAL_SCOPE` call arguments in the target RPC
  handler files with either the global helper or a derived authenticated scope.
- Do not migrate admin/app-global preferences or LLM registry data into tenant
  storage in this ticket.
- Do not modify Electron main handlers in this ticket.

## Validation Commands

- `bun test packages/server-core/src/handlers/rpc/__tests__/server-core-rpc-storage-scope.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/server-core-rpc-storage-scope.test.ts packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `cd packages/server-core && bunx tsc --noEmit`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`
- `bun run build`
- `bun test`

## Acceptance Criteria

- [x] Every target server-core RPC handler storage callsite is mapped in the
      worklog.
- [x] Workspace settings handlers derive authenticated workspace scope.
- [x] Genuinely global server-core RPC settings use an explicit documented
      global storage scope helper.
- [x] Multi-tenant tests prove workspace settings read tenant-prefixed storage.
- [x] Multi-tenant tests prove global settings stay in flat local config.
- [x] Targeted server-core RPC handler tests pass.
- [x] Full relevant validation passes or blockers are documented.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T215-c4-server-core-rpc-handlers-scope-migration.md`.
