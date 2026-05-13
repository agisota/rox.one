# T356 - RC S05 Smoke Harness Registration

## 1. Task Summary

Register the S05 RC smoke harness scenario so
`T343-rc-s05-team-invite-rbac` can be rerun reproducibly through the shared
Phase 20 smoke command.

## 2. Repo Context Discovered

The root `e2e:smoke` script exists after T352, with S02 through S04 registered
by T353, T354, and T355. `scripts/e2e-smoke.ts` still did not register
`s05-team-invite-rbac`, so T343 failed with an unsupported-scenario message.

The required RBAC integration, policy, and scope-forgery tests already pass.
Current adjacent account-team invite and RBAC settings state tests are
Bun-compatible when passed as explicit paths.

## 3. Files Inspected

- `docs/tickets/T343-rc-s05-team-invite-rbac.md`
- `docs/tickets/T356-rc-s05-smoke-harness-registration.md`
- `docs/worklog/T343-rc-s05-team-invite-rbac.md`
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

Added a failing S05 harness/path contract to
`scripts/__tests__/e2e-smoke-harness.test.ts`.

## 5. Expected Failing Test Output

```text
error: Unsupported scenario "s05-team-invite-rbac". Supported scenarios: s01-registration, s02-prompt-pipeline, s03-mission-checkpoint, s04-arena-swarm-vdi
```

## 6. Implementation Changes

- Registered `s05-team-invite-rbac` in `scripts/e2e-smoke.ts`.
- Routed S05 to current roles RPC, role audit, role rate-limit, policy engine,
  scope-forgery, account-team invite, team chat, and RBAC settings state tests.
- Marked `T356` as `Status: DONE`.
- Updated T343 worklog and RC evidence to show the harness registration is
  complete while packaged multi-user screenshots remain pending.

## 7. Validation Commands Run

```bash
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s05-team-invite-rbac
bun run e2e:smoke -- --scenario s01-registration
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
git diff --check
```

## 8. Passing Test Output Summary

- Initial S05 harness contract failed for the expected unsupported-scenario
  reason, then passed after implementation: 6 pass, 0 fail, 25 expectations.
- `bun run e2e:smoke -- --scenario s05-team-invite-rbac`: pass, 161 tests, 0
  fail, 9819 expectations.
- `bun run e2e:smoke -- --scenario s01-registration`: still exits code 78 with
  the expected `darwin` host-environment blocker on this Linux host.
- `bun run validate:agent-contract`: ok, 11 skills, 311 tickets, 7 required
  docs.
- `bun run validate:docs`, `bun run validate:rebrand`, `bun run
  validate:roadmap`, and `git diff --check` passed.

## 9. Build Output Summary

No build was run. The change is a smoke harness registration and does not change
runtime application code.

## 10. Remaining Risks

- S05 still needs packaged Electron multi-user screenshots and browser-console
  evidence before T343 can move to `DONE`.
- The S05 harness currently uses deterministic server/shared/renderer tests
  rather than a packaged multi-user UI run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Harness contract test fails before implementation for unsupported S05 | Pass | Initial harness test exited 1 with unsupported S05 |
| `s05-team-invite-rbac` is listed in supported scenarios | Pass | Harness test passes and `e2e:smoke` runs S05 |
| S05 smoke runs current roles RPC and role audit/rate-limit tests | Pass | `e2e:smoke` S05 includes roles tests and passes |
| S05 smoke runs current policy engine and scope-forgery tests | Pass | `e2e:smoke` S05 includes auth tests and passes |
| S05 smoke runs current account-team invite and RBAC settings state tests | Pass | `e2e:smoke` S05 includes account/settings tests and passes |
| Existing S01 Linux host-blocker behavior is unchanged | Pass | S01 still exits 78 on Linux with explicit darwin requirement |
| Worklog captures red/green evidence | Pass | This worklog records the failing and passing commands |
