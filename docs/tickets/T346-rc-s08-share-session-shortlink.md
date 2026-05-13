# T346 - RC Scenario S08: Share Session → Public Shortlink Opens

Status: Blocked

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.
Phase 20 of the master roadmap runs the ten release-candidate scenarios end-to-end
on a clean Electron build and captures pass/fail evidence.

This ticket covers **RC Scenario 8** from `plan.md §16`:

> Share session → public shortlink opens.

The scenario exercises the Public Share Shortlink feature (T064/T084). A logged-in
user triggers the share action from a session or mission, a shortlink URL is
generated and copied to the clipboard, and opening that URL in a browser displays
the shared session content — without requiring the viewer to log in.

## Goal

Verify that the share flow produces a working public shortlink within one user
action, that the shortlink URL is well-formed and does not embed session tokens,
and that opening the URL in a clean browser context renders the shared content
without authentication.

## Required UI

- Share button or action in the session/mission view
- Share-status indicator (copying → copied → expired / failed / auth-required)
- Browser-accessible public viewer at the shortlink URL

## Required Data/API

- `POST /api/share/create` — creates the shortlink and returns the URL
- `GET /api/share/:shortId` — public viewer endpoint (no auth required)
- Shortlink payload must not contain session token or tenant-bearing secrets
- Retry and error-state handling in the share provider (T064/T084)

## Required Automations

- Share action copies the shortlink URL to the clipboard automatically
- Shortlink expiry is enforced server-side (configurable TTL)
- Share attempt against an unauthenticated state shows an "auth-required" error

## Required Subagents

None for this validation ticket.

## TDD Requirements

1. Integration test: share a session → assert shortlink URL is returned and
   follows the expected `https://<host>/s/<shortId>` pattern.
2. Security test: assert the shortlink payload (what `GET /api/share/:shortId`
   returns) contains no session token or workspace-scoped secret.
3. Integration test: open shortlink URL without session cookies → assert 200
   response and content renders.
4. Integration test: shortlink after TTL expiry → assert 410 Gone response.

## Implementation Requirements

No new implementation. This is an RC validation scenario.
Any regressions found should be filed as blocking tickets before Phase 20 can
close.

## Validation Commands

```bash
# Smoke run via E2E harness
bun run e2e:smoke -- --scenario s08-share-session-shortlink

# Shortlink provider and secret-leak coverage
bun test packages/server-core/src/sessions/share-provider.test.ts packages/server-core/src/sessions/share-errors.test.ts packages/server-core/src/sessions/session-share-provider.test.ts apps/electron/src/renderer/components/app-shell/__tests__/session-share-flow.test.ts

# Agent contract gate
bun run validate:agent-contract
```

## Acceptance Criteria

- [ ] Share action from a session view produces a shortlink URL
- [ ] URL pattern is well-formed (no embedded tokens)
- [ ] Share-status indicator transitions through `copying → copied` states
- [ ] Opening the shortlink URL in a browser (no auth) renders the shared content
- [ ] Shortlink payload contains no session token or tenant secret
- [ ] Expired shortlink returns 410 Gone
- [ ] Screenshot evidence captured and referenced in
      `docs/release/2026-05-14-rc-evidence.md`
- [ ] Pass/fail status updated in the RC evidence table (row S08)

## Worklog

Update `docs/worklog/T346-rc-s08-share-session-shortlink.md` with run log,
screenshots, and any blocker ticket references.
