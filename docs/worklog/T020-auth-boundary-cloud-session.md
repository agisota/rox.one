# T020 Auth Boundary / Cloud Session Model

## 1. Task summary

Make the local-vs-cloud authentication boundary explicit and expose a safe cloud session model for account sessions.

## 2. Repo context discovered

- `docs/tickets/T020-auth-boundary-cloud-session.md` is a stub ticket, so scope is derived from existing account/session seams.
- `packages/server-core/src/webui/auth.ts` signs both legacy WebUI JWTs and account JWTs in the same cookie name.
- `packages/server-core/src/webui/http-server.ts` already branches `validateWebuiSession()` into `legacy` and `account`, but response models do not expose a durable boundary contract.
- `packages/server-core/src/accounts/types.ts` already has account roles plus `listWorkspaceIds(userId)` and workspace owner APIs.
- `packages/server-core/src/accounts/postgres-store.ts` persists workspace ownership in `rox_workspace_owners`.
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx` tolerates additional fields in `/api/account/me`, so adding a session-boundary field is backward-compatible.

## 3. Files inspected

- `docs/tickets/T020-auth-boundary-cloud-session.md`
- `packages/server-core/src/webui/auth.ts`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/accounts/types.ts`
- `packages/server-core/src/accounts/postgres-store.ts`
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx`

## 4. Tests added first

- `packages/server-core/src/webui/__tests__/account-session-boundary.test.ts`
- Extended `packages/server-core/src/webui/__tests__/account-http.test.ts`

## 5. Expected failing test output

`bun test packages/server-core/src/webui/__tests__/account-session-boundary.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`

Expected red result:

```text
error: Cannot find module '../account-session-boundary'
expect(received).toMatchObject(expected)
received value must be a non-null object
expect(received).toEqual(expected)
Received: undefined
9 pass
3 fail
1 error
```

## 6. Implementation changes

- Added `packages/server-core/src/webui/account-session-boundary.ts`.
- Added explicit `LocalSessionBoundary` for legacy/local auth:
  - `mode: 'local'`
  - `cloud: false`
  - no user, session, role, email, or workspace IDs.
- Added explicit `CloudSessionBoundary` for hosted account auth:
  - `mode: 'cloud'`
  - `cloud: true`
  - normalized email.
  - sorted/deduplicated workspace IDs.
- Added `canAccessCloudWorkspace()` with deny-by-default behavior; account role alone does not grant workspace access.
- Extended `/api/account/me`:
  - legacy sessions now return `sessionBoundary: createLocalSessionBoundary()`.
  - account sessions now return `sessionBoundary: createCloudSessionBoundary(identity, await accountStore.listWorkspaceIds(identity.userId))`.
- Updated account HTTP test fixture so workspace ownership is user-scoped instead of globally allowed.

## 7. Validation commands run

- `bun test packages/server-core/src/webui/__tests__/account-session-boundary.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `bun run validate:docs`
- `git diff --check`
- `bun run electron:build`

## 8. Passing test output summary

- Targeted auth/boundary tests: `14 pass`, `0 fail`, `75 expect() calls`.
- Server-core typecheck passed.
- Shared typecheck passed.
- Electron typecheck passed.
- Docs validation passed: `11 skills`, `41 tickets`, `7 required docs`, `4 docs`, `10 subsystem headings`.
- Diff whitespace check passed.

## 9. Build output summary

`bun run electron:build` passed:

- main process bundle built and verified.
- preload builds built and verified.
- renderer Vite build completed.
- resources and assets copied.
- Existing Vite chunk-size and Jotai Babel deprecation warnings remain; no T020-specific build failure.

## 10. Remaining risks

- This establishes the session boundary model but does not yet add team invite/RBAC policy; that belongs to T021.
- Cloud workspace access checks are available as pure policy, but not yet applied to future cloud workspace APIs because those APIs are not implemented yet.
- Session TTL and token signing remain the existing 24-hour cookie/JWT model.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Legacy/local sessions are not treated as cloud sessions | PASS | Boundary unit test and legacy `/api/account/me` HTTP test. |
| Cloud sessions include only authenticated user workspace IDs | PASS | HTTP test grants workspaces to two users and verifies only current-user IDs. |
| Workspace access is deny-by-default | PASS | Unit test denies local sessions, missing workspace IDs, and role-only admin access. |
| `/api/account/me` exposes the boundary without leaking other users | PASS | HTTP test verifies `workspace-other` is absent. |
| Existing account/session auth behavior remains compatible | PASS | Existing account HTTP suite remains green with `14 pass`. |

## 12. 2026-05-05 status reconciliation

Fresh gate: `bun test packages/server-core/src/webui/__tests__/account-ledger.test.ts packages/server-core/src/webui/__tests__/account-events.test.ts packages/server-core/src/webui/__tests__/account-session-boundary.test.ts packages/server-core/src/webui/__tests__/account-teams.test.ts packages/server-core/src/webui/__tests__/account-cloud-workspaces.test.ts packages/server-core/src/storage/__tests__/object-storage.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts --timeout 20000`

Result: `52 pass`, `0 fail`, `253 expect() calls`.

Decision: close T020 because the boundary is now applied by account, managed workspace, team workspace, and sync HTTP surfaces. Session TTL and token-signing policy remain unchanged existing behavior.
