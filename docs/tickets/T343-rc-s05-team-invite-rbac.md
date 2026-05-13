# T343 - RC Scenario S05: Team Invite → Shared Workspace → RBAC Check

Status: Todo

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.
Phase 20 of the master roadmap runs the ten release-candidate scenarios end-to-end
on a clean Electron build and captures pass/fail evidence.

This ticket covers **RC Scenario 5** from `plan.md §16`:

> Team invite → shared workspace → RBAC check.

The scenario exercises the RBAC system (T224/T225/T226/T227/T228), the team
invite flow (T021/T035), and the shared workspace access control. An owner sends
an invite, the invited user accepts and accesses the shared workspace, and
attempts to perform actions above their assigned role are rejected by the policy
engine.

## Goal

Verify that the RBAC policy engine enforces role boundaries during a live
multi-user workspace session: an owner can invite a viewer, the viewer can read
the workspace, and the viewer's attempt to write or administer is denied with a
clear error — not silently ignored or allowed.

## Required UI

- Team settings screen with invite form (T021/T227)
- Email or in-app invite acceptance flow
- Shared workspace landing page
- RBAC denial feedback in the UI (error state or locked UI affordance)

## Required Data/API

- `POST /rpc/roles.grant` — owner grants viewer role
- `GET /rpc/roles.list` — list current role bindings
- `POST /rpc/workspace.write` — write attempt (must fail for viewer)
- `POST /rpc/roles.revoke` — owner revokes access; viewer loses workspace entry
- Policy engine `canRead / canWrite / canAdmin` pure functions (T224)

## Required Automations

- Invite accepted → role binding created in `role_grants` table
- Role revocation invalidates active session workspace membership within one
  request
- RBAC denial emits an audit event at `auth.rbac.deny` severity

## Required Subagents

None for this validation ticket.

## TDD Requirements

1. Integration test: owner invites viewer → viewer accesses workspace → asserts
   read succeeds.
2. Integration test: viewer attempts workspace write → asserts 403 deny response.
3. Integration test: owner revokes viewer role → viewer's next request to the
   workspace returns 403.
4. Property test (T243): randomly forged scope attempts must be rejected by the
   brand registry before reaching RBAC.

## Implementation Requirements

No new implementation. This is an RC validation scenario.
Any regressions found should be filed as blocking tickets before Phase 20 can
close.

## Validation Commands

```bash
# Smoke run via E2E harness
bun run e2e:smoke -- --scenario s05-team-invite-rbac

# RBAC integration tests
bun test packages/server-core/src/handlers/rpc/__tests__/roles*.test.ts
bun test packages/shared/src/auth/__tests__/policy*.test.ts

# Scope forgery property tests
bun test packages/shared/src/**/__tests__/scope-forgery*.test.ts

# Agent contract gate
bun run validate:agent-contract
```

## Acceptance Criteria

- [ ] Owner can send an invite from the Team settings screen
- [ ] Invited user can accept and land on the shared workspace
- [ ] Viewer role allows read operations in the shared workspace
- [ ] Viewer role denies write operations with a clear error or locked UI
- [ ] Revoking the role removes workspace access within one subsequent request
- [ ] RBAC denial audit event is emitted and queryable
- [ ] Screenshot evidence captured and referenced in
      `docs/release/2026-05-14-rc-evidence.md`
- [ ] Pass/fail status updated in the RC evidence table (row S05)

## Worklog

Update `docs/worklog/T343-rc-s05-team-invite-rbac.md` with run log, screenshots,
and any blocker ticket references.
