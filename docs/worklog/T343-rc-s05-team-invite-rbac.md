# T343 - RC Scenario S05: Team Invite RBAC

## 1. Task Summary

Validate RC Scenario S05: owner invites a viewer, the viewer gets shared
workspace read access, write/admin actions are denied, revocation removes access,
and RBAC denial/audit behavior is covered.

## 2. Repo Context Discovered

`T343` is a validation-only Phase 20 ticket. It says to file blocking tickets for
regressions instead of changing runtime behavior in this ticket.

The shared RC smoke harness registers S01 through S04 after T355, but
`s05-team-invite-rbac` was not registered. T356 registered the scenario against
current Bun-compatible RBAC/team invite coverage.

The targeted RBAC integration, policy engine, and scope-forgery commands listed
in T343 pass on current main. Additional current account-team invite and RBAC
settings state coverage also passes under Bun-compatible tests.

## 3. Files Inspected

- `docs/tickets/T343-rc-s05-team-invite-rbac.md`
- `docs/release/2026-05-14-rc-evidence.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- `packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`
- `packages/server-core/src/handlers/rpc/__tests__/roles-audit.test.ts`
- `packages/server-core/src/handlers/rpc/__tests__/roles-rate-limit.test.ts`
- `packages/shared/src/auth/__tests__/policy-engine.test.ts`
- `packages/shared/src/auth/__tests__/policy-engine.edge-cases.test.ts`
- `packages/shared/src/auth/__tests__/scope-forgery.property.test.ts`
- `packages/server-core/src/webui/__tests__/account-teams.test.ts`
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
- `packages/server-core/src/webui/__tests__/team-chat-http.test.ts`
- `apps/electron/src/renderer/components/settings/rbac/__tests__/team-management-state.test.ts`
- `apps/electron/src/renderer/components/settings/rbac/__tests__/roles-panel-state.test.ts`
- `apps/electron/src/renderer/components/settings/rbac/__tests__/roles-panel.test.tsx`

## 4. Tests Added First

No code test was added in this validation-only ticket. The red validation check
is the required S05 smoke command.

## 5. Expected Failing Test Output

Command:

```bash
bun run e2e:smoke -- --scenario s05-team-invite-rbac
```

Observed failure:

```text
[e2e-smoke] Unsupported scenario "s05-team-invite-rbac". Supported scenarios: s01-registration, s02-prompt-pipeline, s03-mission-checkpoint, s04-arena-swarm-vdi
error: script "e2e:smoke" exited with code 1
```

## 6. Implementation Changes

- Marked `T343` as `Status: Blocked`.
- Filed blocker ticket `T356-rc-s05-smoke-harness-registration.md`.
- Updated the RC evidence table row for S05 to `Blocked`.
- Added the blocker to the RC evidence blocker table.

No runtime files were changed.

After T356, the S05 smoke command reaches the harness and passes current
deterministic team invite/RBAC coverage:

```text
[e2e-smoke] pass s05-team-invite-rbac
161 pass
0 fail
9819 expect() calls
```

## 7. Validation Commands Run

```bash
bun run e2e:smoke -- --scenario s05-team-invite-rbac
bun test packages/server-core/src/handlers/rpc/__tests__/roles*.test.ts
bun test packages/shared/src/auth/__tests__/policy*.test.ts
bun test packages/shared/src/**/__tests__/scope-forgery*.test.ts
bun test packages/server-core/src/webui/__tests__/account-teams.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts packages/server-core/src/webui/__tests__/team-chat-http.test.ts apps/electron/src/renderer/components/settings/rbac/__tests__/team-management-state.test.ts apps/electron/src/renderer/components/settings/rbac/__tests__/roles-panel-state.test.ts apps/electron/src/renderer/components/settings/rbac/__tests__/roles-panel.test.tsx
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s05-team-invite-rbac
bun run validate:agent-contract
```

## 8. Passing Test Output Summary

- Roles RPC integration/audit/rate-limit tests: 48 pass, 0 fail, 126
  expectations.
- Policy engine tests: 45 pass, 0 fail, 81 expectations.
- Scope-forgery property tests: 6 pass, 0 fail, 9347 expectations.
- Adjacent account-team invite and RBAC settings state tests: 62 pass, 0 fail,
  265 expectations.
- `bun run e2e:smoke -- --scenario s05-team-invite-rbac`: 161 pass, 0 fail,
  9819 expectations.
- `bun test scripts/__tests__/e2e-smoke-harness.test.ts`: 6 pass, 0 fail, 25
  expectations.
- `bun run validate:agent-contract`: ok, 11 skills, 311 tickets, 7 required
  docs.

## 9. Build Output Summary

No build was run because this ticket made no runtime/source changes.

## 10. Remaining Risks

- S05 has not produced packaged Electron UI screenshots or browser-console
  evidence.
- The passing tests prove deterministic account/RBAC behavior, not a full
  packaged multi-user UI run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Owner can send an invite from the Team settings screen | Partial | Account-team and RBAC state tests pass; packaged UI smoke pending |
| Invited user can accept and land on shared workspace | Partial | `account-http` invite tests pass; packaged UI smoke pending |
| Viewer role allows read operations | Partial | Policy and account/team tests pass; packaged UI smoke pending |
| Viewer role denies write operations | Partial | Policy, team-chat HTTP, and account/team tests pass; packaged UI smoke pending |
| Revoking role removes access within one request | Partial | Roles revoke tests pass; packaged UI smoke pending |
| RBAC denial audit event is emitted and queryable | Partial | Roles audit tests pass; packaged UI smoke pending |
| Screenshot evidence captured and referenced | Blocked | No screenshot captured in current deterministic test harness |
| RC evidence row S05 updated | Pass | `docs/release/2026-05-14-rc-evidence.md` row S05 is `Blocked` |
| Initial blocking ticket filed | Pass | `T356-rc-s05-smoke-harness-registration.md` |
| S05 deterministic harness path repaired | Pass | T356 registers S05 and `e2e:smoke` passes 161 tests |
