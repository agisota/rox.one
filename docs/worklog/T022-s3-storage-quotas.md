# T022 S3-Compatible Storage Adapter / Quotas

## 1. Task summary

Implement a generic S3-compatible object storage seam for Agent Workbench cloud storage with tenant-scoped keys, default user/team quotas, pre-write quota checks, and path traversal protection. Tests must use an in-memory fake adapter and must not call real S3 or external services.

## 2. Repo context discovered

- `docs/tickets/T022-s3-storage-quotas.md` is a placeholder ticket, so the active acceptance criteria come from the backlog prompt and local storage/security skills.
- There is no existing server-core object storage or S3 quota module.
- Prior account/cloud tickets T017-T021 added focused `packages/server-core/src/webui/*` pure modules with in-memory test doubles and Bun tests.
- Existing shared storage modules are local filesystem workspace/session/status config storage and are not a cloud object-storage adapter.

## 3. Files inspected

- `docs/tickets/T022-s3-storage-quotas.md`
- `packages/server-core/src/webui/account-ledger.ts`
- `packages/server-core/src/webui/__tests__/account-ledger.test.ts`
- `packages/server-core/src/webui/account-teams.ts`
- `packages/server-core/src/webui/__tests__/account-teams.test.ts`
- `.agents/skills/storage-quota-architect/SKILL.md`
- `.agents/skills/security-rbac-reviewer/SKILL.md`

## 4. Tests added first

- `packages/server-core/src/storage/__tests__/object-storage.test.ts`
  - asserts user/team default quotas are 1GiB and 10GiB
  - rejects writes that exceed quota before the adapter stores the object
  - supports overwrite accounting without double-counting the replaced object
  - rejects traversal, absolute paths, empty paths, and backslash paths
  - isolates same logical path across user and team tenant prefixes

## 5. Expected failing test output

`bun test packages/server-core/src/storage/__tests__/object-storage.test.ts`

```text
error: Cannot find module '../object-storage' from '.../packages/server-core/src/storage/__tests__/object-storage.test.ts'

0 pass
1 fail
1 error
```

This is the expected red state: tests reference the new object-storage contract before implementation.

## 6. Implementation changes

- Added `packages/server-core/src/storage/object-storage.ts`.
- Added generic `ObjectStorageAdapter` interface with `putObject`, `getObject`, `listObjects`, and `deleteObject`; no AWS SDK or provider-specific dependency.
- Added `InMemoryObjectStorageAdapter` for deterministic tests and fake-provider integration.
- Added `QuotaObjectStorageService` for tenant-scoped logical object operations.
- Added `users/<id>/` and `teams/<id>/` key prefixes with tenant id validation.
- Added path validation that rejects absolute paths, traversal segments, empty segments, dot paths, and backslash paths.
- Added quota accounting that subtracts an overwritten object's old size before checking the replacement write.
- Added `ObjectStorageQuotaExceededError` and `ObjectStoragePathError`.

## 7. Validation commands run

- `bun test packages/server-core/src/storage/__tests__/object-storage.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `bun run validate:docs`
- `git diff --check`
- `bun run electron:build`

## 8. Passing test output summary

- Storage unit tests: 4 pass, 0 fail, 17 assertions.
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

- Adapter is an in-process contract and fake implementation only; real MinIO/S3 client wiring is deferred to the cloud workspace/sync tickets.
- Quota accounting is list-based and not concurrency-safe; persistent storage needs atomic reservation or server-side transaction semantics before multi-writer production use.
- No signed URL or protected document URL model is implemented in this ticket.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Generic object storage adapter, not AWS-only | Pass | `ObjectStorageAdapter` interface; no provider SDK imports |
| Default user quota is 1GiB | Pass | Unit test asserts `DEFAULT_USER_STORAGE_QUOTA_BYTES === 1024 ** 3` |
| Default team quota is 10GiB | Pass | Unit test asserts `DEFAULT_TEAM_STORAGE_QUOTA_BYTES === 10 * 1024 ** 3` |
| Quota checked before upload completes | Pass | Over-quota write rejects and adapter has no stored object for rejected key |
| Path traversal rejected | Pass | Unit test covers `..`, absolute, backslash, empty, and dot paths |
| User/team tenant isolation enforced | Pass | Unit test writes same logical path across two users and one team, then deletes one user object without affecting others |
| No real S3/API calls in tests | Pass | Tests use `InMemoryObjectStorageAdapter` only |

## 12. 2026-05-05 status reconciliation

Fresh gate: `bun test packages/server-core/src/webui/__tests__/account-ledger.test.ts packages/server-core/src/webui/__tests__/account-events.test.ts packages/server-core/src/webui/__tests__/account-session-boundary.test.ts packages/server-core/src/webui/__tests__/account-teams.test.ts packages/server-core/src/webui/__tests__/account-cloud-workspaces.test.ts packages/server-core/src/storage/__tests__/object-storage.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts --timeout 20000`

Result: `52 pass`, `0 fail`, `253 expect() calls`.

Decision: close T022 as the S3-compatible quota seam and fake-provider contract. Real MinIO/S3 client wiring and atomic multi-writer quota reservations remain production follow-up risks.
