# T023 Managed Cloud Workspace Model

## 1. Task summary

Implement a minimal managed cloud workspace metadata model for account-mode ROX ONE workspaces. The model must be explicit, deny-by-default, current-user scoped, and safe to build later sync/provisioning work on without pretending that real cloud infrastructure exists.

## 2. Repo context discovered

- `docs/tickets/T023-managed-cloud-workspace.md` is a placeholder ticket, so acceptance criteria come from the backlog prompt and the cloud/security project skills.
- T020 added local-vs-cloud session boundaries and workspace id ownership checks.
- `AccountStore` already has `grantWorkspaceOwner`, `isWorkspaceOwner`, and `listWorkspaceIds`, backed by `rox_workspace_owners` in the Postgres store.
- T021 added optional account-scoped stores for teams and wired account endpoints through `createWebuiHandler` options.
- There is no managed cloud workspace metadata store or account API for creating/listing account cloud workspaces.

## 3. Files inspected

- `docs/tickets/T023-managed-cloud-workspace.md`
- `.agents/skills/cloud-sync-architect/SKILL.md`
- `.agents/skills/security-rbac-reviewer/SKILL.md`
- `packages/server-core/src/accounts/types.ts`
- `packages/server-core/src/accounts/postgres-store.ts`
- `packages/server-core/src/webui/account-session-boundary.ts`
- `packages/server-core/src/webui/__tests__/account-session-boundary.test.ts`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/webui/__tests__/account-http.test.ts`

## 4. Tests added first

- `packages/server-core/src/webui/__tests__/account-cloud-workspaces.test.ts`
  - creates an active private cloud workspace with normalized metadata and storage prefix
  - grants/list access only to the owner
  - rejects empty names and cross-user access
  - returns defensive copies
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
  - creates a managed cloud workspace via account session and grants ownership
  - lists only current user's managed cloud workspaces
  - rejects unauthenticated workspace creation

## 5. Expected failing test output

`bun test packages/server-core/src/webui/__tests__/account-cloud-workspaces.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`

```text
error: Cannot find module '../account-cloud-workspaces' from '.../packages/server-core/src/webui/__tests__/account-cloud-workspaces.test.ts'
error: Cannot find module '../account-cloud-workspaces' from '.../packages/server-core/src/webui/__tests__/account-http.test.ts'

0 pass
2 fail
2 errors
```

This is the expected red state: tests reference the new managed cloud workspace model before implementation.

## 6. Implementation changes

- Added `packages/server-core/src/webui/account-cloud-workspaces.ts`.
- Added `ManagedCloudWorkspaceStore` and `InMemoryManagedCloudWorkspaceStore`.
- Added explicit `ManagedCloudWorkspace` metadata: `id`, normalized name, slug, owner, status, visibility, storage bucket/prefix, timestamps, and archive marker.
- Added deny-by-default `getWorkspaceForUser` behavior through `ManagedCloudWorkspaceAccessError`.
- Added defensive copies for workspace metadata and nested storage metadata.
- Added optional `accountCloudWorkspaceStore` to `createWebuiHandler` options.
- Added account-only `GET /api/account/workspaces` and `POST /api/account/workspaces`.
- `POST /api/account/workspaces` creates managed metadata and explicitly grants owner access through `AccountStore.grantWorkspaceOwner`.

## 7. Validation commands run

- `bun test packages/server-core/src/webui/__tests__/account-cloud-workspaces.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `bun run validate:docs`
- `git diff --check`
- `bun run electron:build`

## 8. Passing test output summary

- Managed cloud workspace/account HTTP tests: 19 pass, 0 fail, 95 assertions.
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

- Store is in-memory only; durable Postgres workspace metadata is still needed before production cloud workspace persistence.
- Workspace creation plus owner grant is not transactional in this seam; a durable implementation should create metadata and ownership in one transaction.
- No actual cloud provisioning, sync, object upload, signed URL, or workspace file replication is implemented in this ticket.
- Team/shared workspace access is still user-owner only and deferred to T035/T036.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Managed cloud workspace metadata model exists | Pass | `ManagedCloudWorkspace` and `ManagedCloudWorkspaceStore` |
| Create/list operations are account-session scoped | Pass | HTTP tests use account session cookie; unauthenticated creation returns 401 |
| Owner grant is explicit | Pass | HTTP test asserts `store.isWorkspaceOwner(userId, workspace.id)` after creation |
| Cross-user reads are denied by default | Pass | Unit test rejects `getWorkspaceForUser` for another user and HTTP list returns only current user |
| No real cloud provisioning or paid API calls | Pass | In-memory store only; no external provider imports or calls |

## 12. 2026-05-05 status reconciliation

Fresh gate: `bun test packages/server-core/src/webui/__tests__/account-ledger.test.ts packages/server-core/src/webui/__tests__/account-events.test.ts packages/server-core/src/webui/__tests__/account-session-boundary.test.ts packages/server-core/src/webui/__tests__/account-teams.test.ts packages/server-core/src/webui/__tests__/account-cloud-workspaces.test.ts packages/server-core/src/storage/__tests__/object-storage.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts --timeout 20000`

Result: `52 pass`, `0 fail`, `253 expect() calls`.

Decision: close T023 as the managed cloud workspace metadata/API MVP. Durable metadata, transactional create+grant, actual provisioning, and signed object URLs remain production follow-up risks.
