# T026 File Manager Scopes

## Task summary

Add a checked file-manager scope model so file browsing/searching can be bounded to explicit workspace roots instead of accepting arbitrary server paths.

## Repo context discovered

- `packages/server-core/src/handlers/rpc/files.ts` owns `file:*` read handlers, `fs:search`, and `fs:listDirectory`.
- File reads already call `validateFilePath(path, getWorkspaceAllowedDirs(workspaceId))`.
- `fs:search` currently accepts a caller-provided `basePath` and walks it without path validation.
- `fs:listDirectory` validates path format but does not bind browsing to workspace scopes.
- `packages/server-core/src/handlers/utils.ts` provides `getWorkspaceAllowedDirs` and sensitive-file denial.
- Renderer surfaces include `FileViewer.tsx`, `SessionFilesSection.tsx`, `ServerDirectoryBrowser.tsx`, and `useDirectoryPicker.ts`.

## Files inspected

- `docs/tickets/T026-file-manager-scopes.md`
- `packages/server-core/src/handlers/rpc/files.ts`
- `packages/server-core/src/handlers/utils.ts`
- `packages/server-core/src/handlers/__tests__/validate-file-path.test.ts`
- `packages/session-tools-core/src/runtime/filesystem-isolation.ts`
- `apps/electron/src/renderer/components/files/FileViewer.tsx`
- `apps/electron/src/renderer/components/right-sidebar/session-files-watch.ts`
- `apps/electron/src/renderer/components/ServerDirectoryBrowser.tsx`
- `apps/electron/src/renderer/hooks/useDirectoryPicker.ts`

## Tests added first

- Added `packages/server-core/src/handlers/__tests__/file-manager-scopes.test.ts` before implementation.

## Expected failing test output

`bun test packages/server-core/src/handlers/__tests__/file-manager-scopes.test.ts` failed for the expected reason before implementation:

```text
error: Cannot find module '../file-manager-scopes' from '/Users/marklindgreen/Projects/rox/rox/packages/server-core/src/handlers/__tests__/file-manager-scopes.test.ts'
0 pass
1 fail
1 error
```

## Implementation changes

- Added `packages/server-core/src/handlers/file-manager-scopes.ts`.
- Added explicit scope construction for workspace root, working directory, and session attachments roots without implicit home/tmp access.
- Added scoped path validation with absolute-path checks, realpath-based symlink escape denial, sensitive-file denial, and cross-scope denial.
- Exported the scope helper from `@rox-agent/server-core/handlers`.
- Wired `fs:search` and `fs:listDirectory` through file-manager scopes when a workspace context exists. Non-workspace directory picker behavior still uses the existing path validator.

## Validation commands run

- `bun test packages/server-core/src/handlers/__tests__/file-manager-scopes.test.ts`
- `bun test packages/server-core/src/handlers/__tests__/file-manager-scopes.test.ts packages/server-core/src/handlers/__tests__/validate-file-path.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `bun run validate:docs`
- `git diff --check`
- `bun run electron:build`

## Passing test output summary

- Targeted scope test: `4 pass, 0 fail, 8 expect() calls`.
- Scope + existing path validator tests: `17 pass, 0 fail, 24 expect() calls`.
- Server-core typecheck passed.
- Shared and Electron typecheck passed.
- Docs validation passed.
- `git diff --check` passed.

## Build output summary

`bun run electron:build` passed. Main, preload, renderer, resources, and asset copy completed successfully. Renderer emitted the repo's existing large chunk warnings.

## Remaining risks

- `file:*` read/attachment handlers retain their existing broader `validateFilePath` behavior so attachment workflows are not broken in this ticket.
- File-manager scopes are server-side only; no dedicated scope browser UI was added yet.
- `fs:search` now surfaces file-manager access denial as an RPC error. The renderer still needs a dedicated UI treatment if product wants a custom localized denial state instead of the existing RPC error path.

## Worker F runtime/API closeout — 2026-05-05

### Дополнительный repo context

- `packages/server-core/src/handlers/rpc/files.ts` already routed `fs:search` and `fs:listDirectory` through `validateFileManagerBrowsePath`, but `fs:search` caught top-level validation errors and returned `[]`.
- That made denied scopes indistinguishable from a legitimate empty search result at the RPC boundary.

### Tests added first

- Added `packages/server-core/src/handlers/rpc/files.test.ts` handler integration coverage:
  - search inside the workspace scope must return a deterministic file result with canonicalized path;
  - denied search outside a workspace scope must reject with `Access denied: file path is outside file manager scopes`;
  - office handler coverage in the same file is recorded under T029.

### Expected failing output

`bun test packages/server-core/src/handlers/rpc/files.test.ts` failed before implementation for the expected reason:

```text
Expected promise that rejects
Received promise that resolved: Promise { <resolved> }
0 pass
2 fail
```

### Implementation changes

- Changed `fs:search` error handling so file-manager validation denials are rethrown instead of being collapsed to an empty search result.
- Preserved the previous empty-array fallback for non-access traversal/search errors.

### Validation commands run

- `bun test packages/server-core/src/handlers/rpc/files.test.ts`
- `bun test packages/server-core/src/handlers/rpc/files.test.ts packages/server-core/src/handlers/__tests__/file-manager-scopes.test.ts packages/server-core/src/services/office-document-adapter.test.ts`
- `bun run --filter @rox-agent/server-core typecheck`
- `bun run validate:agent-contract`

### Passing output summary

- Handler/runtime + existing scope/adapter tests: `10 pass, 0 fail, 25 expect() calls`.
- Server-core typecheck: pass.
- Agent contract validation: pass, `11 skills, 48 tickets, 7 required docs`.

## Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| File manager has explicit workspace scopes | Pass | `buildFileManagerScopes` test covers workspace and working-directory scopes |
| Broad home/tmp access is not implicitly added to scoped file manager browsing | Pass | Scope construction test expects only declared roots |
| Cross-scope, sensitive, and symlink-escape paths are denied | Pass | `file-manager-scopes.test.ts` covers sibling, `.env`, and symlink escape denial |
| RPC file browsing/searching uses scopes when workspace context exists | Pass | `packages/server-core/src/handlers/rpc/files.ts` routes `fs:search` and `fs:listDirectory` through `validateFileManagerBrowsePath` |
| Allowed workspace search returns scoped results | Pass | `packages/server-core/src/handlers/rpc/files.test.ts` expects a file under the workspace root to be returned with canonicalized path |
| Scope denial is visible at the RPC boundary | Pass | `packages/server-core/src/handlers/rpc/files.test.ts` expects `fs:search` to reject outside the declared workspace scope |
