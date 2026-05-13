# T215 - C4 server-core RPC handlers scope migration

## 1. Task summary

Audit non-workspace server-core RPC handler storage calls and make their
workspace-vs-global scope decisions explicit.

## 2. Repo context discovered

- `packages/server-core/src/handlers/rpc/workspace.ts` already derives branded
  workspace scope after T213.
- `packages/server-core/src/handlers/rpc/system.ts` still passes direct
  `DEFAULT_LOCAL_SCOPE` for Git Bash path persistence and local workspace
  lookup.
- `packages/server-core/src/handlers/rpc/settings.ts` still passes direct
  `DEFAULT_LOCAL_SCOPE` for app settings and uses flat storage for
  workspace-settings lookup.
- `packages/server-core/src/handlers/rpc/llm-connections.ts` still passes
  direct `DEFAULT_LOCAL_SCOPE` for the admin LLM connection registry and uses
  flat workspace lookup when setting workspace defaults.
- App/admin-global preferences should stay flat; workspace-addressed handlers
  should derive authenticated branded scope.

## 3. Files inspected

- `AGENTS.md`
- `plan.md`
- `.swarm/plan.md`
- `.swarm/backlog-status.md`
- `docs/superpowers/plans/2026-05-10-c4-multi-tenant-storage-isolation.md`
- `docs/superpowers/specs/2026-05-10-c4-multi-tenant-storage-isolation-design.md`
- `docs/tickets/T213-c4-workspace-rpc-full-scope-migration.md`
- `docs/worklog/T213-c4-workspace-rpc-full-scope-migration.md`
- `docs/tickets/T214-c4-electron-main-handlers-scope-migration.md`
- `docs/worklog/T214-c4-electron-main-handlers-scope-migration.md`
- `packages/server-core/src/handlers/rpc/workspace.ts`
- `packages/server-core/src/handlers/rpc/system.ts`
- `packages/server-core/src/handlers/rpc/settings.ts`
- `packages/server-core/src/handlers/rpc/llm-connections.ts`
- `packages/server-core/src/handlers/rpc/account-ownership.ts`
- `packages/server-core/src/handlers/utils.ts`
- `packages/server-core/src/transport/types.ts`
- `packages/shared/src/config/storage-scope-auth.ts`
- `packages/shared/src/config/storage-scope-runtime.ts`
- `packages/shared/src/config/storage-settings.ts`
- `packages/shared/src/config/storage-workspaces.ts`
- `packages/shared/src/workspaces/storage.ts`

## 4. Tests added first

- Added
  `packages/server-core/src/handlers/rpc/__tests__/server-core-rpc-storage-scope.test.ts`.
- Coverage documents the explicit server-core RPC global scope helper, blocks
  direct `DEFAULT_LOCAL_SCOPE` use in `system.ts`, `settings.ts`, and
  `llm-connections.ts`, proves multi-tenant workspace settings read tenant
  storage, rejects forged workspace settings reads before flat fallback, and
  proves app-level default thinking remains in flat config.
- The behavioral storage scenarios run in isolated Bun subprocesses so
  `CRAFT_CONFIG_DIR` and module-level config initialization cannot race with
  other test files in the full suite.

## 5. Expected failing test output

Initial red run before implementation:

```text
bun test packages/server-core/src/handlers/rpc/__tests__/server-core-rpc-storage-scope.test.ts
error: Cannot find module '../storage-scope'
0 pass
1 fail
1 error
```

## 6. Implementation changes

- Added `packages/server-core/src/handlers/rpc/storage-scope.ts` with:
  - `SERVER_CORE_RPC_GLOBAL_STORAGE_SCOPE` as the documented flat
    admin/global scope.
  - `SERVER_CORE_RPC_GLOBAL_STORAGE_SCOPE_REASON` for testable rationale.
  - `deriveRpcWorkspaceScope()` to derive branded scope from request auth and
    account-store workspace permissions.
- Updated `system.ts`:
  - Git Bash path persistence now uses the explicit global helper.
  - Local filesystem workspace guard derives scope before checking whether the
    addressed workspace is remote.
- Updated `settings.ts`:
  - App defaults, drafts, input, appearance, cache, tool, and proxy settings
    now use the explicit global helper.
  - Workspace settings get/update require workspace access and derive
    authenticated workspace scope before loading workspace config.
  - Workspace `defaultLlmConnection` validation still reads the admin/global
    LLM registry.
- Updated `llm-connections.ts`:
  - Admin LLM connection registry/default/refresh operations now use the
    explicit global helper.
  - Workspace default LLM updates require workspace access and derive
    authenticated workspace scope before locating the workspace.

## 7. Validation commands run

- `bun install --frozen-lockfile`
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

## 8. Passing test output summary

- Targeted:
  `5 pass`, `0 fail`, `13 expect() calls`.
- Adjacent C4 scope coverage:
  `59 pass`, `0 fail`, `67 expect() calls`.
- Full suite after isolating the new test fixture:
  `5058 pass`, `13 skip`, `0 fail`, `1 snapshots`, `12671 expect() calls`,
  `5071 tests`, `451 files`.
- One earlier full-suite run failed only in the new test because it mutated
  `CRAFT_CONFIG_DIR` in-process while other test files had initialized shared
  config state; the test was corrected to use subprocess isolation and the full
  suite then passed.

## 9. Build output summary

- `cd packages/server-core && bunx tsc --noEmit`: exit 0.
- `bun run validate:agent-contract`: ok, 11 skills, 172 tickets, 7 required docs.
- `bun run validate:docs`: ok, architecture docs and sync-v2 design validated.
- `bun run typecheck`: shared typecheck exit 0.
- `bun run lint`: ipc sends, Electron, shared, and UI lint exit 0.
- `git diff --check`: exit 0.
- `bun run build`: exit 0; Electron main/preload/renderer/resources/assets
  built successfully. Vite emitted existing large-chunk warnings only.

## 10. Remaining risks

- The LLM connection registry is currently treated as admin/global config for
  this C4 phase. Moving it to per-user or per-team storage is a future product
  decision because credentials, defaults, and live session auth refreshes depend
  on the current global registry.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Every target server-core RPC handler storage callsite is mapped | Pass | Section 2 maps `system.ts`, `settings.ts`, and `llm-connections.ts` |
| Workspace settings handlers derive authenticated workspace scope | Pass | `settings.ts` uses `deriveRpcWorkspaceScope()` for settings get/update |
| Global RPC settings use explicit documented global helper | Pass | `storage-scope.ts` exports `SERVER_CORE_RPC_GLOBAL_STORAGE_SCOPE` and target handlers use it |
| Multi-tenant workspace settings read tenant storage | Pass | Targeted test returns `tenant-model` under multi-tenant runtime |
| Multi-tenant global settings stay flat | Pass | Targeted test writes default thinking to flat config while tenant config remains `low` |
| Targeted server-core RPC handler tests pass | Pass | `5 pass`, `0 fail`; adjacent `59 pass`, `0 fail` |
| Full relevant validation passes or blocker documented | Pass | Full `bun test`: `5058 pass`, `13 skip`, `0 fail`; build/type/lint gates passed |
| Worklog complete | Pass | Sections 1-11 filled |
| Commit created | Pass | Commit created for T215 after final validation |
