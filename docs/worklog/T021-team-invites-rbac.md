# T021 Team Invites / RBAC

## 1. Task summary

Add a minimal team organization, invite, and RBAC backing contract for the existing account cabinet organization endpoints.

## 2. Repo context discovered

- `docs/tickets/T021-team-invites-rbac.md` is a stub ticket, so scope is derived from existing account/team surfaces.
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx` already calls:
  - `GET /api/account/organizations`
  - `POST /api/account/organizations`
  - `POST /api/account/organizations/join`
- T017 intentionally left organization creation/join as explicit `501` until a backing team model exists.
- `packages/server-core/src/webui/account-cabinet.ts` already defines `AccountCabinetOrganization`.
- T020 added explicit cloud session boundary and user-scoped workspace IDs, but no team invite/RBAC model.

## 3. Files inspected

- `docs/tickets/T021-team-invites-rbac.md`
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/webui/account-cabinet.ts`
- `packages/server-core/src/webui/account-session-boundary.ts`
- `packages/server-core/src/webui/__tests__/account-http.test.ts`

## 4. Tests added first

- `packages/server-core/src/webui/__tests__/account-teams.test.ts`
- Extended `packages/server-core/src/webui/__tests__/account-http.test.ts`

## 5. Expected failing test output

`bun test packages/server-core/src/webui/__tests__/account-teams.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`

Expected red result:

```text
error: Cannot find module '../account-teams'
0 pass
2 fail
2 errors
```

## 6. Implementation changes

- Added `packages/server-core/src/webui/account-teams.ts` with:
  - `AccountTeamStore` interface.
  - `InMemoryAccountTeamStore` fake/test adapter.
  - `owner`, `admin`, `member`, `viewer` roles.
  - owner/admin-only invite creation.
  - single-use invite consumption.
  - per-user organization listing.
- Added `createAccountCabinetOrganizationsFromTeams()` to map team records into the existing account cabinet organization response shape.
- Added optional `accountTeamStore` injection to `createWebuiHandler()`.
- Wired account organization endpoints:
  - `GET /api/account/organizations` lists current-user organizations when a store is injected.
  - `POST /api/account/organizations` creates an owner organization when a store is injected.
  - `POST /api/account/organizations/join` joins by single-use invite code when a store is injected.
- Preserved explicit `501` behavior when no team store is configured.

## 7. Validation commands run

- `bun test packages/server-core/src/webui/__tests__/account-teams.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `bun run validate:docs`
- `git diff --check`
- `bun run electron:build`

## 8. Passing test output summary

- Targeted team/account tests: `16 pass`, `0 fail`, `88 expect() calls`.
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
- Existing Vite chunk-size and Jotai Babel deprecation warnings remain; no T021-specific build failure.

## 10. Remaining risks

- `InMemoryAccountTeamStore` is process-local and intended as a fake/test adapter until durable team persistence is added.
- No UI exists yet for creating invite codes; tests use the store directly to verify invite/RBAC semantics.
- Workspace-sharing and collaboration features are still deferred to T035/T036.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Team organizations are user-scoped | PASS | Unit and HTTP tests verify unrelated teams are absent. |
| Invite creation is RBAC protected | PASS | Unit test denies non-owner/non-admin invite creation. |
| Invite join is single-use and tenant-safe | PASS | Unit and HTTP tests verify one successful join and reused-code `400`. |
| HTTP organization create/join works only with backing store | PASS | HTTP tests inject `InMemoryAccountTeamStore` for create/join success. |
| Existing no-store behavior remains explicit | PASS | Existing account HTTP test still asserts `501` for no backing team store. |

## 12. 2026-05-05 status reconciliation

Fresh gate: `bun test packages/server-core/src/webui/__tests__/account-ledger.test.ts packages/server-core/src/webui/__tests__/account-events.test.ts packages/server-core/src/webui/__tests__/account-session-boundary.test.ts packages/server-core/src/webui/__tests__/account-teams.test.ts packages/server-core/src/webui/__tests__/account-cloud-workspaces.test.ts packages/server-core/src/storage/__tests__/object-storage.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts --timeout 20000`

Result: `52 pass`, `0 fail`, `253 expect() calls`.

Decision: close T021 as the team invite/RBAC MVP contract. Durable team persistence and richer team UI are documented follow-up risks.
