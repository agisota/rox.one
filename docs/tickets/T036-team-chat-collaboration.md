# T036-team-chat-collaboration

Status: DONE

## Context

Team members need a discussion space around workspace artifacts:

- messages;
- mentions;
- file/spec/task/artifact references;
- agent run references;
- labels;
- workspace filters;
- strict team membership/RBAC.

Existing team primitives live in `packages/server-core/src/webui/account-teams.ts`.
This ticket should extend that account/team surface without weakening existing
auth, workspace, billing, storage, or Experience Layer behavior.

## Goal

Implement the first safe Team Chat collaboration truth layer:

- create a deterministic in-memory team chat store for tests and local embedded mode;
- validate message body, references, labels, and optional workspace scope;
- enforce team message RBAC:
  - owners/admins/members can read and write;
  - viewers can read;
  - viewers can write only when an explicit team chat policy allows it;
  - non-members are denied by the HTTP/team-membership boundary;
- expose the store through the webui account team surface;
- keep UI implementation for a later screen slice unless this ticket can add it
  without crossing shared-shell ownership.

## Required Data/API

Message schema:

- `messageId`;
- `teamId`;
- `workspaceId` optional;
- `authorUserId`;
- `body`;
- `refs`;
- `labels`;
- `createdAt`.

Refs:

- `workspace`;
- `spec`;
- `task`;
- `artifact`;
- `agent_run`;
- `file`;

## Required Tests

- unit/service tests for message creation, filtering, validation, copying, and RBAC;
- HTTP/API tests when the endpoint is wired;
- no real email, payment, S3, browser, or LLM providers.

Required loop:

1. Inspect repo context.
2. Write tests or validation checks first.
3. Confirm expected failure.
4. Implement minimal change.
5. Run targeted checks.
6. Run full relevant validation.
7. Update matching worklog.
8. Commit.
