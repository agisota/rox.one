# T024 Explicit Local-Cloud Sync MVP

## 1. Task summary

Implement a deterministic local-cloud sync MVP that uses explicit snapshot/push/pull operations, fake local/cloud stores, conflict detection, and no silent overwrites. This ticket does not implement transparent background sync or real cloud I/O.

## 2. Repo context discovered

- `docs/tickets/T024-local-cloud-sync-mvp.md` is a placeholder ticket, so acceptance criteria come from the backlog prompt and `cloud-sync-architect`.
- Existing `packages/server-core/src/handlers/rpc/transfer.ts` is chunked payload transfer for RPC calls, not workspace sync state.
- Existing `packages/shared/src/sessions/bundle.ts` serializes session directories for remote workspace transfer, not bidirectional workspace sync.
- T022 introduced a generic object-storage seam; T023 introduced managed cloud workspace metadata. T024 needs the sync planning/apply layer above those seams.

## 3. Files inspected

- `docs/tickets/T024-local-cloud-sync-mvp.md`
- `.agents/skills/cloud-sync-architect/SKILL.md`
- `packages/server-core/src/handlers/rpc/transfer.ts`
- `packages/server-core/src/handlers/rpc/transfer.test.ts`
- `packages/shared/src/sessions/bundle.ts`
- `packages/shared/src/utils/__tests__/bundle-files.test.ts`
- `packages/server-core/src/storage/object-storage.ts`
- `packages/server-core/src/webui/account-cloud-workspaces.ts`

## 4. Tests added first

- `packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts`
  - explicit push creates cloud files and is idempotent after base snapshot update
  - push rejects local-vs-cloud divergent edits without overwriting cloud
  - pull applies cloud deletions only when local is unchanged from base
  - pull rejects cloud deletion when local has diverged
  - traversal/absolute/backslash paths are rejected before snapshot use

## 5. Expected failing test output

`bun test packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts`

```text
error: Cannot find module '../local-cloud-sync' from '.../packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts'

0 pass
1 fail
1 error
```

This is the expected red state: tests reference the explicit sync engine before implementation.

## 6. Implementation changes

- Added `packages/server-core/src/sync/local-cloud-sync.ts`.
- Added `SyncFileStore` abstraction and `InMemorySyncFileStore` fake provider.
- Added `LocalCloudSyncEngine` with `captureSnapshot`, `pushLocalToCloud`, and `pullCloudToLocal`.
- Added SHA-256 snapshot entries with deterministic path ordering.
- Added base/current diffing for write/delete operations.
- Added conflict preflight before applying writes/deletes.
- Added `LocalCloudSyncConflictError` and `LocalCloudSyncPathError`.
- Added sync path validation for traversal, absolute paths, backslashes, empty paths, and dot paths.

## 7. Validation commands run

- `bun test packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `bun run validate:docs`
- `git diff --check`
- `bun run electron:build`

## 8. Passing test output summary

- Local-cloud sync unit tests: 5 pass, 0 fail, 26 assertions.
- Server-core TypeScript: passed.
- Shared TypeScript: passed.
- Electron TypeScript: passed.
- Docs validation: passed.
- Whitespace diff check: passed.

## 9. Build output summary

`bun run electron:build` passed:

- main process bundle verified
- preload bundles verified
- renderer production build completed
- resources/assets copied

Vite emitted existing large chunk/deprecated Jotai plugin warnings only.

## 10. Remaining risks

- Engine is pure/in-memory only; it is not wired to filesystem watchers, object storage, or managed workspace HTTP endpoints yet.
- No persisted sync state format is stored on disk or in cloud; callers must persist `nextBaseSnapshot`.
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
| No real cloud/network calls in tests | Pass | Tests use only `InMemorySyncFileStore` |
