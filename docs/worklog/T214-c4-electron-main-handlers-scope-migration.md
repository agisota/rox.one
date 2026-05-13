# T214 - C4 Electron main handlers scope migration

## 1. Task summary

Audit Electron main handler storage calls and make the current headless/global
storage decisions explicit while preserving multi-tenant storage isolation.

## 2. Repo context discovered

- Read-only explorer found Electron main handler storage calls only in
  `apps/electron/src/main/handlers/system.ts` and
  `apps/electron/src/main/handlers/settings.ts`.
- The current callsites persist machine-wide settings: Git Bash path,
  update-dismissal version, notification enablement, and power keep-awake.
- `apps/electron/src/main/handlers/workspace.ts` carries workspace/window
  context but does not persist through storage submodules.
- No direct `deriveScopeFromAuth()` use exists in Electron main handlers yet.
- Server-core workspace RPC handlers now own the tenant-bound workspace storage
  migration from T213.

## 3. Files inspected

- `AGENTS.md`
- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
- `docs/tickets/T213-c4-workspace-rpc-full-scope-migration.md`
- `docs/worklog/T213-c4-workspace-rpc-full-scope-migration.md`
- `docs/tickets/TEMPLATE.md`
- `docs/tickets/README.md`
- `apps/electron/src/main/handlers/system.ts`
- `apps/electron/src/main/handlers/settings.ts`
- `apps/electron/src/main/handlers/workspace.ts`
- `apps/electron/src/main/handlers/browser.ts`
- `apps/electron/src/main/handlers/index.ts`
- `apps/electron/src/main/handlers/handler-deps.ts`
- `apps/electron/src/main/handlers/__tests__/registration.test.ts`
- `apps/electron/src/main/handlers/__tests__/registration-profiles.test.ts`
- `apps/electron/src/main/handlers/__tests__/settings-default-thinking.test.ts`
- `packages/shared/src/config/storage-scope-auth.ts`
- `packages/shared/src/config/storage-scope-runtime.ts`
- `packages/shared/src/config/storage-settings.ts`
- `packages/shared/src/config/storage-internal.ts`
- `packages/server-core/src/transport/types.ts`

## 4. Tests added first

- Added
  `apps/electron/src/main/handlers/__tests__/electron-global-storage-scope.test.ts`.
- The test documents the named Electron global storage scope constant and
  reason string.
- It statically rejects direct `DEFAULT_LOCAL_SCOPE` references in
  `system.ts`, `settings.ts`, `workspace.ts`, and `browser.ts`.
- It keeps an exact inventory of storage calls that intentionally use
  `ELECTRON_GLOBAL_STORAGE_SCOPE`.
- It runs `update.DISMISS`, `notification.SET_ENABLED`, and
  `power.SET_KEEP_AWAKE` under multi-tenant runtime and asserts they write the
  flat `CRAFT_CONFIG_DIR/config.json` rather than
  `CRAFT_CONFIG_DIR/tenants/W42/config.json`.

## 5. Expected failing test output

Before implementation:

```text
bun test apps/electron/src/main/handlers/__tests__/electron-global-storage-scope.test.ts

error: Cannot find module '../storage-scope' from '.../electron-global-storage-scope.test.ts'

0 pass
1 fail
1 error
```

After adding the helper and replacements, the first adjacent handler batch
exposed a test mock ordering gap:

```text
SyntaxError: Export named 'powerSaveBlocker' not found in module '.../node_modules/electron/index.js'.
```

The production code was already correct; the test now mocks
`../../power-manager` so the scope regression does not depend on which
Electron mock another handler test registered first.

## 6. Implementation changes

- Added
  `apps/electron/src/main/handlers/storage-scope.ts` with
  `ELECTRON_GLOBAL_STORAGE_SCOPE` and
  `ELECTRON_GLOBAL_STORAGE_SCOPE_REASON`.
- Replaced all direct handler-level `DEFAULT_LOCAL_SCOPE` storage arguments in
  `apps/electron/src/main/handlers/system.ts` with
  `ELECTRON_GLOBAL_STORAGE_SCOPE`.
- Replaced `settings.ts` power keep-awake persistence with
  `ELECTRON_GLOBAL_STORAGE_SCOPE`.
- Left tenant-bound server-core workspace RPC behavior untouched.
- Confirmed no session-carrying Electron main handler storage callsites exist
  in this phase; `workspace.ts` and `browser.ts` do not call the shared
  storage submodules.

## 7. Validation commands run

- `bun install --frozen-lockfile`
- `bun test apps/electron/src/main/handlers/__tests__/electron-global-storage-scope.test.ts`
- `bun test apps/electron/src/main/handlers/__tests__/electron-global-storage-scope.test.ts apps/electron/src/main/handlers/__tests__/registration.test.ts apps/electron/src/main/handlers/__tests__/registration-profiles.test.ts apps/electron/src/main/handlers/__tests__/settings-default-thinking.test.ts`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`
- `bun run build`
- `bun test`

## 8. Passing test output summary

- Targeted T214 scope test:

```text
4 pass
0 fail
14 expect() calls
```

- Adjacent Electron handler batch:

```text
11 pass
0 fail
33 expect() calls
```

- `bun run validate:agent-contract`:

```text
[agent-contract] ok: 11 skills, 171 tickets, 7 required docs
```

- `bun run validate:docs`:

```text
[agent-contract] ok: 11 skills, 171 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated .../docs/architecture/sync-v2-design.md
```

- `bun run typecheck`, `bun run lint`, and `git diff --check` passed.
- Full suite:

```text
5053 pass
13 skip
0 fail
1 snapshots, 12658 expect() calls
Ran 5066 tests across 450 files. [68.50s]
```

## 9. Build output summary

`bun run build` passed. It built Electron main, preload, renderer, resources,
and assets. Vite reported existing large chunk warnings, then completed with
resource copy output including:

```text
Copied resources/ -> dist/resources/
Copied powershell-parser.ps1 -> dist/resources/
```

## 10. Remaining risks

- T214 has no session-carrying Electron main storage callsites. Future Electron
  main storage handlers must choose `deriveScopeFromAuth()` for tenant data or
  `ELECTRON_GLOBAL_STORAGE_SCOPE` for documented machine-wide preferences.
- The new global scope helper intentionally aliases `DEFAULT_LOCAL_SCOPE`
  because Git Bash, update-dismissal, notification enablement, and keep-awake
  are machine-local UI/runtime preferences.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Every Electron main handler storage callsite is mapped | Pass | Explorer output plus exact call inventory in `electron-global-storage-scope.test.ts` |
| Session-carrying Electron main storage handlers are migrated or proven absent | Pass | `workspace.ts` and `browser.ts` have no shared storage calls; tests reject direct handler `DEFAULT_LOCAL_SCOPE` |
| Headless/global settings use explicit documented global scope helper | Pass | `storage-scope.ts` helper and static call inventory pass |
| Multi-tenant tests prove global settings stay flat | Pass | Runtime test writes flat config and leaves tenant config unchanged |
| Targeted Electron handler tests pass | Pass | Targeted T214 test and adjacent handler batch pass |
| Full relevant validation passes or blockers documented | Pass | Full `bun test`, build, lint, typecheck, docs, agent-contract, and diff checks pass |
| Worklog complete | Pass | This file contains all 11 required sections |
| Commit created | Pass | This task will be committed with the T214 changes |
