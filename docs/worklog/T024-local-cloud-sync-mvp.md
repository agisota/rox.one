# T024 Explicit Local-Cloud Sync MVP

## 1. Task summary

Implement a deterministic local-cloud sync MVP that uses explicit snapshot/push/pull operations, fake local/cloud stores, conflict detection, and no silent overwrites. This ticket does not implement transparent background sync or real cloud I/O.

## 2. Repo context discovered

- `docs/tickets/T024-local-cloud-sync-mvp.md` is a placeholder ticket, so acceptance criteria come from the backlog prompt and `cloud-sync-architect`.
- Existing `packages/server-core/src/handlers/rpc/transfer.ts` is chunked payload transfer for RPC calls, not workspace sync state.
- Existing `packages/shared/src/sessions/bundle.ts` serializes session directories for remote workspace transfer, not bidirectional workspace sync.
- T022 introduced a generic object-storage seam; T023 introduced managed cloud workspace metadata. T024 needs the sync planning/apply layer above those seams.
- 2026-05-05 integration closure: managed workspace HTTP routes existed for workspace create/list, but no `/sync/*` routes existed. `apps/electron/src/main/account-api.ts` already proxies `/api/account*`, so backend route wiring is sufficient for the local app account API surface.

## 3. Files inspected

- `docs/tickets/T024-local-cloud-sync-mvp.md`
- `.agents/skills/cloud-sync-architect/SKILL.md`
- `packages/server-core/src/handlers/rpc/transfer.ts`
- `packages/server-core/src/handlers/rpc/transfer.test.ts`
- `packages/shared/src/sessions/bundle.ts`
- `packages/shared/src/utils/__tests__/bundle-files.test.ts`
- `packages/server-core/src/storage/object-storage.ts`
- `packages/server-core/src/webui/account-cloud-workspaces.ts`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server/src/index.ts`
- `packages/server-core/package.json`

## 4. Tests added first

- `packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts`
  - explicit push creates cloud files and is idempotent after base snapshot update
  - push rejects local-vs-cloud divergent edits without overwriting cloud
  - pull applies cloud deletions only when local is unchanged from base
  - pull rejects cloud deletion when local has diverged
  - traversal/absolute/backslash paths are rejected before snapshot use
- 2026-05-05 integration tests:
  - `packages/server-core/src/sync/__tests__/workspace-sync-service.test.ts`
    - push stores files in the managed workspace cloud store
    - operation IDs are idempotent and do not replay changed payloads
    - pull returns the local file set after cloud application
    - divergent cloud/local edits raise `WorkspaceSyncConflictError`
  - `packages/server-core/src/webui/__tests__/account-http.test.ts`
    - `/api/account/workspaces/:workspaceId/sync/status` requires auth and routes through the injected service after workspace access checks
    - `/sync/push` routes actor/workspace/storage-prefix context to the service
    - `/sync/operations` is readable for accessible workspaces
    - team workspace viewers can read sync status but cannot run write sync actions

## 5. Expected failing test output

`bun test packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts`

```text
error: Cannot find module '../local-cloud-sync' from '.../packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts'

0 pass
1 fail
1 error
```

This is the expected red state: tests reference the explicit sync engine before implementation.

2026-05-05 integration red state:

- `bun test packages/server-core/src/sync/__tests__/workspace-sync-service.test.ts`
  - failed with `Cannot find module '../workspace-sync-service'`
- `bun test packages/server-core/src/webui/__tests__/account-http.test.ts --timeout 20000`
  - new sync route tests failed with the expected 404 responses because `/api/account/workspaces/:workspaceId/sync/*` routes were not wired yet

## 6. Implementation changes

- Added `packages/server-core/src/sync/local-cloud-sync.ts`.
- Added `SyncFileStore` abstraction and `InMemorySyncFileStore` fake provider.
- Added `LocalCloudSyncEngine` with `captureSnapshot`, `pushLocalToCloud`, and `pullCloudToLocal`.
- Added SHA-256 snapshot entries with deterministic path ordering.
- Added base/current diffing for write/delete operations.
- Added conflict preflight before applying writes/deletes.
- Added `LocalCloudSyncConflictError` and `LocalCloudSyncPathError`.
- Added sync path validation for traversal, absolute paths, backslashes, empty paths, and dot paths.
- Added `packages/server-core/src/sync/workspace-sync-service.ts`.
- Added `WorkspaceSyncService` and `InMemoryWorkspaceSyncService` above the pure engine.
- Added workspace-scoped base snapshots, cloud stores, operation records, and operation-id idempotency.
- Added `WorkspaceSyncConflictError` / `WorkspaceSyncValidationError` for HTTP-safe conflict and bad-request mapping.
- Added `packages/server-core/src/sync/index.ts` and package export `@craft-agent/server-core/sync`.
- Added `/api/account/workspaces/:workspaceId/sync/status`, `/sync/push`, `/sync/pull`, and `/sync/operations`.
- Reused account session boundaries and managed workspace access checks before sync service invocation.
- Enforced team workspace sync write permissions: owner/admin/member can push/pull; viewer is read-only.
- Wired the standalone server to use the in-memory sync service when hosted accounts are enabled.

## 7. Validation commands run

- `bun test packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `bun run validate:docs`
- `git diff --check`
- `bun run electron:build`
- `bun test packages/server-core/src/sync/__tests__/workspace-sync-service.test.ts`
- `bun test packages/server-core/src/webui/__tests__/account-http.test.ts --timeout 20000`
- `bun test packages/server-core/src/sync/__tests__/workspace-sync-service.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts --timeout 20000`
- `bun run --filter @craft-agent/server-core typecheck`
- `bun run --filter @craft-agent/server typecheck`
- `bun run validate:agent-contract`
- `bun test packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts packages/server-core/src/sync/__tests__/workspace-sync-service.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts --timeout 20000`
- `bun run typecheck:all`
- `bun run lint`
- `bun run electron:smoke`

## 8. Passing test output summary

- Local-cloud sync unit tests: 5 pass, 0 fail, 26 assertions.
- Workspace sync service tests: 3 pass, 0 fail, 9 assertions.
- Account HTTP tests with sync endpoints: 21 pass, 0 fail, 153 assertions.
- Combined sync/account targeted run: 29 pass, 0 fail, 188 assertions.
- Server-core TypeScript: passed.
- Standalone server TypeScript: passed.
- Shared TypeScript: passed.
- Electron TypeScript: passed.
- Full monorepo TypeScript (`bun run typecheck:all`): passed.
- Lint (`bun run lint`): passed.
- Docs validation: passed.
- Agent contract validation: passed (`11 skills, 48 tickets, 7 required docs`).
- Whitespace diff check: passed.

## 9. Build output summary

`bun run electron:build` passed:

- main process bundle verified
- preload bundles verified
- renderer production build completed
- resources/assets copied

Vite emitted existing large chunk/deprecated Jotai plugin warnings only.

`bun run electron:smoke` passed after rebuilding Electron bundles. The app reached `App initialized successfully`, opened the ROX server, then exited via the smoke `exit-on-ready` path.

## 10. Remaining risks

- Engine and HTTP integration are still process-local/in-memory; object storage persistence, leases, compare-and-swap, and operation-log durability remain in the `T018-T023` cloud/storage lane.
- No filesystem watcher or automatic background sync is implemented; sync remains explicit push/pull.
- No rename detection; renames appear as delete plus write.
- No multi-writer locking or atomic cloud transaction is implemented.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Explicit snapshot/push/pull MVP | Pass | `LocalCloudSyncEngine.captureSnapshot`, `pushLocalToCloud`, `pullCloudToLocal` |
| Idempotent sync after base snapshot update | Pass | Unit test push then push with `nextBaseSnapshot` produces no operations |
| Conflict detection prevents silent overwrite | Pass | Divergent local/cloud writes throw `LocalCloudSyncConflictError` and preserve target |
| Cloud deletions are handled explicitly | Pass | Pull test deletes unchanged local file when cloud deleted it |
| Path traversal rejected | Pass | Unit test covers `..`, absolute, backslash, empty, and dot paths |
| Managed workspace sync API exists | Pass | Account HTTP tests cover status, push, operations, auth, and team viewer write denial |
| Operation ID replay is idempotent | Pass | `workspace-sync-service.test.ts` replays `op-1` and preserves the original payload |
| Team workspace sync write RBAC is enforced | Pass | Viewer can read sync status and receives 403 on push |
| No real cloud/network calls in tests | Pass | Tests use only `InMemorySyncFileStore` |
