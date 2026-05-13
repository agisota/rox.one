# T339 - RC Scenario S01: Registration → Multi-Tenant Login Flow

Status: Blocked

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.
Phase 20 of the master roadmap runs the ten release-candidate scenarios end-to-end
on a clean Electron build and captures pass/fail evidence.

This ticket covers **RC Scenario 1** from `plan.md §16`:

> Register → login → account persists after restart.

The scenario exercises the full authentication lifecycle: new-user registration
via the ROX ID screen (T073), session encryption via Electron `safeStorage`
(T063), and persistence verification across an app restart. The C.4 multi-tenant
storage isolation (ADR 0007) must route every post-login storage call through the
tenant-scoped branch when `ROX_MULTI_TENANT=1` is set.

## Goal

Verify that a freshly created user account survives an Electron restart and that
all storage writes during the session are correctly tenant-scoped. The session
cookie must not leak to disk in plaintext, and a second user (different tenant)
must not see the first user's workspace data.

## Required UI

- ROX ID registration screen (T073)
- Login screen with credential form
- "You're logged in" home screen or workspace landing
- App restart sequence (quit + relaunch)

## Required Data/API

- `POST /api/account/register` — ROX ID account creation
- `POST /api/account/login` — session token exchange
- `GET /api/account/me` — session hydration on restart
- Electron `safeStorage.encryptString` / `decryptString` wrapping `session.enc`
- Tenant-scoped storage root via `deriveScopeFromAuth` (ADR 0007)

## Required Automations

- Session is persisted to `$userData/session.enc` post-login (T063)
- App restart auto-hydrates session; no re-login prompt appears
- Logout clears `session.enc`; next restart shows login screen

## Required Subagents

None for this validation ticket. Exploration was done in T063/T073.

## TDD Requirements

1. Smoke test: launch clean Electron build → register → verify home screen → quit
   → relaunch → verify still logged in → quit.
2. Negative test: corrupt `session.enc` → verify app shows login screen and does
   not crash.
3. Multi-tenant isolation test: register two accounts (two tenant IDs) → verify
   their storage roots are distinct directory prefixes.
4. Run tests and confirm expected behavior.

## Implementation Requirements

No new implementation. This is an RC validation scenario.
Any regressions found should be filed as blocking tickets before Phase 20 can
close.

## Validation Commands

```bash
# Smoke run via E2E harness
bun run e2e:smoke -- --scenario s01-registration

# Full session persistence unit tests
bun test apps/electron/src/main/__tests__/account-session*.test.ts

# Agent contract gate
bun run validate:agent-contract

# Docs gate
bun run validate:docs
```

## Acceptance Criteria

- [ ] New user can complete registration flow on a clean Electron build
- [ ] Post-login home screen is visible without errors
- [ ] App restart (quit + relaunch) shows the user as still logged in
- [ ] `$userData/session.enc` is present and non-empty after login
- [ ] `session.enc` is absent or invalid-on-decrypt after explicit logout
- [ ] Storage writes are routed to the tenant-scoped prefix when
      `ROX_MULTI_TENANT=1` is set
- [ ] Two distinct registered accounts cannot read each other's workspace data
- [ ] Screenshot evidence captured and referenced in
      `docs/release/2026-05-14-rc-evidence.md`
- [ ] Pass/fail status updated in the RC evidence table (row S01)

## Worklog

Update `docs/worklog/T339-rc-s01-multi-tenant-registration.md` with run log,
screenshots, and any blocker ticket references.

## Current Blocker

- `T352-rc-e2e-smoke-harness-script.md` — the required
  `bun run e2e:smoke -- --scenario s01-registration` command currently exits
  with `Script not found "e2e:smoke"`, so the S01 Electron smoke cannot start.
