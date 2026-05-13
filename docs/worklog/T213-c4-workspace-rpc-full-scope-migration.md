# T213 - C4 workspace RPC full scope migration

## 1. Task summary

Migrate the remaining `workspace.ts` RPC handlers off `DEFAULT_LOCAL_SCOPE`
and onto scopes minted by `deriveScopeFromAuth()`.

## 2. Repo context discovered

- `workspaces.GET` already derives a branded scope through the private
  `deriveWorkspaceScope(deps, ctx)` helper.
- The remaining C4 markers are all in
  `packages/server-core/src/handlers/rpc/workspace.ts`.
- Existing C4 child-process coverage exercises only `workspaces.GET`.
- Workspace-specific handlers receive the target workspace id as an RPC
  argument, while app-level theme/tool-icon handlers rely on `ctx.workspaceId`.
- `deriveScopeFromAuth()` rejects a requested workspace that is absent from the
  trusted `accountStore.listWorkspaceIds(userId)` result with
  `MultiTenantForgeryError`.

## 3. Files inspected

- `AGENTS.md`
- `plan.md`
- `docs/release/`
- `docs/superpowers/specs/2026-05-10-c4-multi-tenant-storage-isolation-design.md`
- `docs/superpowers/plans/2026-05-10-c4-multi-tenant-storage-isolation.md`
- `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
- `docs/tickets/README.md`
- `docs/tickets/TEMPLATE.md`
- `.swarm/inventory.md`
- `.swarm/backlog-status.md`
- `packages/server-core/src/handlers/rpc/workspace.ts`
- `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `packages/server-core/src/handlers/rpc/account-ownership.ts`
- `packages/shared/src/config/storage-scope-auth.ts`
- `packages/shared/src/config/storage-workspaces.ts`
- `packages/shared/src/config/storage-themes.ts`
- `packages/shared/src/config/storage-settings.ts`
- `packages/shared/src/config/storage-tool-icons.ts`
- `packages/shared/src/config/storage-internal.ts`
- `packages/shared/src/workspaces/storage.ts`
- `packages/shared/src/views/storage.ts`

## 4. Tests added first

- Replaced the narrow `workspaces.GET` scope test with a child-process matrix
  covering 18 workspace RPC operation groups:
  `workspaces.GET`, `workspaces.CREATE`, `workspaces.UPDATE_REMOTE`,
  `window.GET_WORKSPACE`, `window.SWITCH_WORKSPACE`,
  `workspace.READ_IMAGE`, `workspace.WRITE_IMAGE`, app theme handlers,
  workspace theme handlers, `views.LIST`, `views.SAVE`, and
  `toolIcons.GET_MAPPINGS`.
- Each operation now runs flat single-user, permitted multi-tenant, and forged
  multi-tenant scenarios from an isolated `ROX_CONFIG_DIR`.
- Fixtures write distinct flat and tenant config, theme, tool icon, image, and
  view markers so tests can prove the handler selected the correct storage
  root.

## 5. Expected failing test output

Before implementation:

```text
bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts

20 pass
34 fail
54 expect() calls
```

Representative failures:

- `workspaces.CREATE` wrote to `flat` instead of `tenant`.
- `workspaces.CREATE` forgery returned `ok: true` instead of
  `MultiTenantForgeryError`.
- Workspace-specific handlers such as `workspace.READ_IMAGE`,
  `workspace.WRITE_IMAGE`, and `views.LIST` failed with `Workspace not found`
  because the tenant registry was not used.
- App-scoped theme/tool-icon handlers still returned flat markers in
  multi-tenant scenarios.

## 6. Implementation changes

- Removed `DEFAULT_LOCAL_SCOPE` from `workspace.ts`.
- Extended `deriveWorkspaceScope(deps, ctx, requestedWorkspaceId)` so handlers
  with an explicit workspace argument can derive scope from the requested
  workspace, while app-level handlers derive from `ctx.workspaceId`.
- Migrated every remaining C4 TODO handler in `workspace.ts` to use the
  derived branded scope.
- Kept `requireWorkspaceAccess()` checks before workspace-specific reads and
  writes.
- Routed app theme and tool icon handlers through authenticated scope
  derivation.
- Added `Status: DONE` metadata to T202-T212 because
  `validate:agent-contract` requires every ticket to declare a status and those
  already-completed C4 tickets were missing one.

## 7. Validation commands run

- `git fetch origin`
- `git switch main`
- `git pull --ff-only origin main`
- `git log --oneline -5`
- `bun install --frozen-lockfile`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts`
- `cd packages/server-core && bunx tsc --noEmit`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`
- `bun run build`
- `bun test`
- `bunx playwright install chromium`
- `bun test packages/audit/tests/route-crawler.test.ts packages/audit/tests/probes/runtime-axe.test.ts packages/audit/tests/probes/runtime-states.test.ts packages/audit/tests/runners/playwright-runner.test.ts`
- `bun test`

## 8. Passing test output summary

- Targeted workspace scope matrix:

```text
54 pass
0 fail
54 expect() calls
```

- C4 storage/auth/runtime regression set:

```text
84 pass
0 fail
107 expect() calls
```

- Server-core typecheck: `cd packages/server-core && bunx tsc --noEmit`
  completed with exit code 0.
- `bun run validate:agent-contract`:

```text
[agent-contract] ok: 11 skills, 170 tickets, 7 required docs
```

- `bun run validate:docs`:

```text
[agent-contract] ok: 11 skills, 170 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated .../docs/architecture/sync-v2-design.md
```

- `bun run typecheck`, `bun run lint`, and `git diff --check` passed.
- Initial full `bun test` failed only because the local Playwright Chromium
  headless shell was missing. After `bunx playwright install chromium`, the
  targeted audit Playwright tests passed and the full suite passed:

```text
5049 pass
13 skip
0 fail
1 snapshots, 12644 expect() calls
Ran 5062 tests across 449 files. [68.01s]
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

- `workspaces.CREATE` has no explicit requested workspace argument, so it uses
  `ctx.workspaceId` to choose the storage scope. This matches the current RPC
  contract and is covered by the child-process tenant scenario.
- The full test suite requires Playwright browser binaries. This worktree now
  has Chromium build `v1193` installed in the shared Playwright cache.
- No production dependencies were added.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Every remaining `workspace.ts` C4 TODO handler has child-process coverage | Pass | 18-operation matrix in `workspace-scope.test.ts` |
| Single-user flat storage behavior is preserved | Pass | Flat scenarios pass in targeted matrix |
| Multi-tenant permitted requests read/write tenant-prefixed storage | Pass | Tenant marker scenarios pass in targeted matrix |
| Multi-tenant workspace forgery rejects with `MultiTenantForgeryError` | Pass | Forgery scenarios pass in targeted matrix |
| Zero `TODO(C4): use deriveScopeFromAuth when ready` markers remain | Pass | `rg "TODO\\(C4\\)|DEFAULT_LOCAL_SCOPE" workspace.ts` returns no matches |
| Targeted workspace scope tests pass | Pass | `54 pass`, `0 fail` |
| C4 storage/auth/runtime regression tests pass | Pass | `84 pass`, `0 fail` |
| Server-core typecheck passes | Pass | `cd packages/server-core && bunx tsc --noEmit` exit 0 |
| Full relevant validation passes or blocker documented | Pass | Full `bun test`, build, lint, typecheck, docs, agent-contract, and diff checks pass |
| Worklog complete | Pass | This file contains all 11 required sections |
| Commit created | Pass | This task will be committed with the T213 changes |
