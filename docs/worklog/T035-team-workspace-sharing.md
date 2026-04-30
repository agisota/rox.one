# T035 - Team Workspace Sharing

## 1. Task summary

Implement the minimal account-side team workspace sharing boundary: owners/admins can create team-visible managed cloud workspaces, team members can list/access those workspace IDs through the account session boundary, and outsiders are denied by default.

## 2. Repo context discovered

- T021 added teams, invites, and RBAC through `InMemoryAccountTeamStore`.
- T023 added private managed cloud workspace metadata through `InMemoryManagedCloudWorkspaceStore`.
- T032 added team/spaces UI and hosted-auth contracts, but managed cloud workspaces were still user-owned only.
- `/api/account/me` builds the cloud session boundary from `AccountStore.listWorkspaceIds`.
- RPC workspace ownership still ultimately checks `AccountStore`, so T035 adds shared workspace IDs to the WebUI session boundary while preserving explicit owner grants for creators.
- Standalone server bootstrap did not inject team/cloud workspace stores, so account runtime routes could silently fall back to empty/501 behavior.

## 3. Files inspected

- `docs/tickets/T035-team-workspace-sharing.md`
- `docs/worklog/T021-team-invites-rbac.md`
- `docs/worklog/T023-managed-cloud-workspace.md`
- `docs/worklog/T024-local-cloud-sync-mvp.md`
- `docs/worklog/T032-rox-composer-account-spaces.md`
- `packages/server-core/src/webui/account-cloud-workspaces.ts`
- `packages/server-core/src/webui/account-teams.ts`
- `packages/server-core/src/webui/account-session-boundary.ts`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/webui/__tests__/account-cloud-workspaces.test.ts`
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
- `packages/server/src/index.ts`
- `packages/server-core/src/webui/index.ts`

## 4. Tests added first

- Extended `packages/server-core/src/webui/__tests__/account-cloud-workspaces.test.ts`:
  - `createTeamWorkspace` creates `visibility: "team"` metadata with `teamId`.
  - team workspace storage prefixes use `teams/<teamId>/workspaces/<workspaceId>/`.
  - `listTeamWorkspaces()` returns only matching team workspaces.
  - team workspace DTOs are defensive copies.
- Extended `packages/server-core/src/webui/__tests__/account-http.test.ts`:
  - owner creates a team workspace.
  - invited team member sees the workspace in `/api/account/workspaces`.
  - member session boundary includes the shared workspace id.
  - member cannot create team workspace.
  - outsider cannot list team workspaces and sees no shared workspace in account workspace list.

## 5. Expected failing test output

`bun test packages/server-core/src/webui/__tests__/account-cloud-workspaces.test.ts`

```text
TypeError: store.createTeamWorkspace is not a function
```

`bun test packages/server-core/src/webui/__tests__/account-http.test.ts --test-name-pattern "shares team cloud workspaces"`

```text
TypeError: undefined is not an object
```

The first failure was expected because the managed workspace store had no team-workspace API. The second failure exposed that the new test initially used the wrong response shape for the existing `/api/account/teams` create route; the test was corrected to use the existing `{ teams: [...] }` response before implementing team workspace routes.

## 6. Implementation changes

- Extended `ManagedCloudWorkspace` with:
  - `teamId: string | null`
  - `visibility: "private" | "team"`
- Added `createTeamWorkspace()` and `listTeamWorkspaces()` to `ManagedCloudWorkspaceStore`.
- Team workspace records now use storage prefix `teams/<teamId>/workspaces/<workspaceId>/`.
- `/api/account/workspaces` now returns private workspaces plus workspaces shared with the current user's teams.
- Added `/api/account/teams/:teamId/workspaces`:
  - `GET` lists shared workspaces for team members only.
  - `POST` creates shared workspaces for owners/admins only.
  - outsiders get `403`.
  - missing cloud workspace store returns `501`.
- `/api/account/me` now includes both owned workspace IDs and team-shared workspace IDs in the cloud session boundary.
- Exported in-memory team/workspace stores from the WebUI package surface.
- Wired standalone server bootstrap to create in-memory team and cloud workspace stores when account DB mode is enabled.

## 7. Validation commands run

- `bun test packages/server-core/src/webui/__tests__/account-cloud-workspaces.test.ts`
- `bun test packages/server-core/src/webui/__tests__/account-http.test.ts --test-name-pattern "shares team cloud workspaces"`
- `bun test packages/server-core/src/webui/__tests__/account-http.test.ts --test-name-pattern "shares team cloud workspaces|managed cloud workspaces|teams, spaces"`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun test packages/server-core/src/webui/__tests__/account-cloud-workspaces.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts packages/server-core/src/webui/__tests__/account-teams.test.ts`
- `bun test packages/server/src/__tests__/smoke.test.ts`
- `bun run typecheck:all`
- `bun run electron:build`

- `git diff --check`

## 8. Passing test output summary

- Account cloud workspace tests: 6 pass, 0 fail, 14 expectations.
- Focused HTTP sharing test: 1 pass, 0 fail, 8 expectations.
- Account HTTP + team + workspace suite: 28 pass, 0 fail, 160 expectations.
- Server smoke suite: 4 pass, 0 fail, 5 expectations.
- `typecheck:all`: passed.
- `git diff --check`: passed.

## 9. Build output summary

`bun run electron:build` passed:

- main process bundle verified,
- preload bundles verified,
- renderer production build completed,
- resources/assets copied.

Existing warnings remain: Vite outDir notice, deprecated Jotai Babel plugin warnings, and large chunk warnings.

## 10. Remaining risks

- Team/workspace stores wired into the standalone server are still in-memory. Durable Postgres team/workspace sharing is still needed before production persistence.
- RPC account ownership still uses `AccountStore.isWorkspaceOwner`; the team-shared workspace ID appears in the WebUI session boundary, but deeper RPC write/read paths may need explicit team-aware ownership hooks.
- There is no dedicated account UI for creating/listing team managed cloud workspaces yet; T032 UI covers teams/spaces/storage but not this new `/workspaces` route.
- Real sync of workspace files/artifacts remains in T024/T025 scope and is not added here.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Team-visible managed workspace metadata exists | Pass | `createTeamWorkspace()` tests assert `visibility: "team"` and `teamId` |
| Team workspace storage prefix is scoped | Pass | Tests assert `teams/<teamId>/workspaces/<workspaceId>/` |
| Team member can discover shared workspace | Pass | HTTP test lists workspace through `/api/account/workspaces` |
| Session boundary includes team-shared workspace IDs | Pass | HTTP test asserts `/api/account/me` contains shared workspace ID |
| Outsider denied by default | Pass | HTTP test asserts team route `403` and empty workspace list |
| Members cannot create team workspaces | Pass | HTTP test asserts member create returns `403` |
| Runtime account server wires sharing stores | Pass | `packages/server/src/index.ts` injects stores when account DB mode is enabled |
| No real cloud/S3/provider calls in tests | Pass | Tests use in-memory stores only |
