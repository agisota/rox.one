# T036-team-chat-collaboration

## 1. Task summary

Implement the first safe Team Chat collaboration layer for ROX ONE account teams:
message schema, deterministic in-memory store, workspace filtering, refs/labels,
and RBAC that allows viewers to read but blocks viewer writes unless policy
explicitly permits them.

## 2. Repo context discovered

- Team organization, invite, role, and team space primitives already exist in
  `packages/server-core/src/webui/account-teams.ts`.
- Team RBAC tests already exist in
  `packages/server-core/src/webui/__tests__/account-teams.test.ts`.
- Account cloud workspace metadata exists in
  `packages/server-core/src/webui/account-cloud-workspaces.ts`.
- WebUI auth/team routes are centralized in
  `packages/server-core/src/webui/http-server.ts`.
- Account events already provide a redaction-oriented in-memory event history in
  `packages/server-core/src/webui/account-events.ts`.

## 3. Files inspected

- `docs/tickets/T036-team-chat-collaboration.md`
- `packages/server-core/src/webui/account-teams.ts`
- `packages/server-core/src/webui/__tests__/account-teams.test.ts`
- `packages/server-core/src/webui/account-cloud-workspaces.ts`
- `packages/server-core/src/webui/account-events.ts`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/webui/index.ts`

## 4. Tests added first

- `packages/server-core/src/webui/__tests__/team-chat.test.ts`
  - message creation, refs, labels, workspace filtering, immutable copies;
  - owner/admin/member write policy;
  - viewer read and explicit viewer-write policy;
  - empty body, malformed refs, invalid labels.
- `packages/server-core/src/webui/__tests__/team-chat-http.test.ts`
  - authenticated owner writes team message;
  - viewer reads workspace-filtered team messages;
  - viewer write is denied;
  - non-member read is denied by team membership boundary.

## 5. Expected failing test output

First red run for the core store:

```text
error: Cannot find module '../team-chat'
0 pass
1 fail
```

First red run for HTTP wiring after the core store existed:

```text
Expected: 201
Received: 404
```

## 6. Implementation changes

- Added `packages/server-core/src/webui/team-chat.ts`.
- Added `InMemoryTeamChatStore`, `TeamChatStore`, message/ref schemas, role
  policy helpers, validation errors, and deep-copy behavior.
- Exported `InMemoryTeamChatStore` from `packages/server-core/src/webui/index.ts`.
- Added `accountTeamChatStore` to `createWebuiHandler` options.
- Added `/api/account/teams/:teamId/messages` GET/POST routes with account
  session, team membership, role policy, validation, and workspace filtering.

## 7. Validation commands run

- `bun test packages/server-core/src/webui/__tests__/team-chat.test.ts`
- `bun test packages/server-core/src/webui/__tests__/team-chat-http.test.ts`
- `bun test packages/server-core/src/webui/__tests__/account-teams.test.ts packages/server-core/src/webui/__tests__/team-chat.test.ts packages/server-core/src/webui/__tests__/team-chat-http.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run validate:agent-contract`

## 8. Passing test output summary

- Core team chat model: `3 pass`, `0 fail`, `19 expect() calls`.
- HTTP collaboration route: `1 pass`, `0 fail`, `7 expect() calls`.
- Combined account/team/chat targeted suite: `8 pass`, `0 fail`,
  `42 expect() calls`.
- `server-core` typecheck passed with no output.
- Agent contract validation passed: `ok: 11 skills, 48 tickets, 7 required docs`.

## 9. Build output summary

No full Electron rebuild was required for this server-core API slice. A fresh
Electron smoke/build had already passed immediately before this ticket.

## 10. Remaining risks

- Renderer Team Chat panel is still a follow-up UI slice.
- HTTP route currently supports process-local in-memory chat storage; durable
  database persistence remains a later cloud persistence task.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---:|---|
| Message schema exists | DONE | `team-chat.ts` |
| In-memory store supports create/list/filter | DONE | `team-chat.test.ts` |
| Owners/admins/members can write | DONE | `team-chat.test.ts` |
| Viewers can read | DONE | `team-chat.test.ts`, `team-chat-http.test.ts` |
| Viewers cannot write unless policy allows | DONE | `team-chat.test.ts`, `team-chat-http.test.ts` |
| Refs and labels validate | DONE | `team-chat.test.ts` |
| Account/team HTTP endpoint is session + membership protected | DONE | `team-chat-http.test.ts` |
| Worklog complete | DONE | This file |
