# T205 - C4 explicit local scope caller migration

## 1. Task summary

Migrate the design-approved headless/no-session caller files to pass `DEFAULT_LOCAL_SCOPE` explicitly to shared storage submodule calls.

## 2. Repo context discovered

- T204 narrowed storage submodules to `BrandedWorkspaceScope` while retaining `DEFAULT_LOCAL_SCOPE` defaults.
- Because defaults remain, omitted-scope callers do not fail typecheck; this ticket enforces the design's explicitness contract mechanically.
- The C4 design explicitly excludes `apps/electron/src/main/handlers/*`.

## 3. Files inspected

- `packages/shared/src/agent/{diagnostics,session-scoped-tools,base-agent,claude-agent}.ts`
- `packages/shared/src/agent/backend/factory.ts`
- `packages/shared/src/auth/state.ts`
- `packages/shared/src/credentials/manager.ts`
- `packages/shared/src/config/{watcher,validators,proxy-env,preferences}.ts`
- `packages/shared/src/workspaces/storage.ts`
- `apps/electron/src/main/{index,onboarding,network-proxy,browser-pane-manager}.ts`
- `apps/electron/src/main/{power-manager,auto-update}.ts`
- `packages/server/src/index.ts`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/handlers/rpc/workspace.ts` for comparison only; demo wiring is a separate ticket.

## 4. Tests added first

No new runtime tests are expected for this mechanical caller migration. The pre-implementation check is typecheck and caller mapping.

## 5. Expected failing test output

None for this mechanical migration. T204 intentionally retained `DEFAULT_LOCAL_SCOPE` defaults in storage submodules, so omitted caller scopes are not compile failures yet.

Pre-edit evidence:

- `bun run typecheck`: passed.
- Structural local/workspace scope literal scan found only tests and excluded Electron handler tests, not production caller migration files.

## 6. Implementation changes

- Added/imported `DEFAULT_LOCAL_SCOPE` in approved caller migration files.
- Passed `DEFAULT_LOCAL_SCOPE` explicitly to storage submodule calls in shared agent, auth, credentials, config watcher/validators/proxy/preferences, workspace storage, Electron main-process non-handler files, standalone server bootstrap, and webui HTTP bootstrap.
- Left `packages/server-core/src/handlers/rpc/workspace.ts` unchanged for this ticket because its storage calls already passed `DEFAULT_LOCAL_SCOPE`; the next ticket wires the demo handler and TODO markers.
- Did not modify `apps/electron/src/main/handlers/*`.

## 7. Validation commands run

- `bun run typecheck`
- `cd packages/shared && bunx tsc --noEmit`
- `cd packages/server-core && bunx tsc --noEmit`
- `cd packages/server && bunx tsc --noEmit`
- `cd apps/electron && bunx tsc --noEmit`
- `git diff --check`
- Caller scan for omitted scoped-storage calls in the approved migration paths.

## 8. Passing test output summary

- Root `bun run typecheck`: passed.
- Shared package typecheck: passed.
- Server-core package typecheck: passed.
- Server package typecheck: passed.
- Electron package typecheck: passed.
- `git diff --check`: passed.

## 9. Build output summary

Not run for this mechanical caller migration. Full build remains part of the final C4 validation gate.

## 10. Remaining risks

- `workspace.ts` still needs the one demo `deriveScopeFromAuth` path and TODO markers.
- Server-core integration test, ADR 0007, and final lint/full-test/build gates remain pending.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Approved caller files pass `DEFAULT_LOCAL_SCOPE` explicitly | Pass | Caller scan and diff across approved migration files |
| Out-of-scope Electron handler files untouched | Pass | `git diff --name-only` contains no `apps/electron/src/main/handlers/*` |
| Typecheck passes | Pass | Root plus shared/server-core/server/electron typechecks passed |
| Worklog complete | Pass | This 11-section worklog is updated with evidence |
| Commit created | Pass | This ticket commit |
