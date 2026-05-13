# T339 - RC Scenario S01: Registration to Multi-Tenant Login Flow

## 1. Task Summary

Validate RC Scenario S01: clean registration, login persistence across restart,
encrypted account-session storage, logout clearing, and tenant-scoped storage
isolation with `ROX_MULTI_TENANT=1`.

## 2. Repo Context Discovered

`T339` is a validation-only Phase 20 ticket. Its own implementation section says
not to add runtime implementation in this ticket; regressions or missing harness
coverage must be filed as blocker tickets before Phase 20 can close.

The root `package.json` exposes `electron:smoke`,
`electron:ui-smoke:packaged:mac`, and `e2e:core`, but does not expose the
required `e2e:smoke` command named by the RC tickets.

## 3. Files Inspected

- `docs/tickets/T339-rc-s01-multi-tenant-registration.md`
- `docs/release/2026-05-14-rc-evidence.md`
- `package.json`
- `apps/electron/src/main/account-session-store.ts`
- `apps/electron/src/main/__tests__/account-session-persistence.test.ts`
- `apps/electron/src/main/__tests__/account-session-store.test.ts`
- `packages/shared/src/config/storage-scope.ts`
- `packages/shared/src/config/storage-scope-auth.ts`
- `packages/shared/src/config/storage-scope-runtime.ts`

## 4. Tests Added First

No code test was added because this is a validation-only ticket. The red
validation check is the required S01 smoke command from the ticket.

## 5. Expected Failing Test Output

Command:

```bash
bun run e2e:smoke -- --scenario s01-registration
```

Observed failure:

```text
error: Script not found "e2e:smoke"
```

This fails before Electron can launch, so it blocks the S01 smoke run rather
than proving a product runtime failure.

## 6. Implementation Changes

- Marked `T339` as `Status: Blocked`.
- Filed blocker ticket `T352-rc-e2e-smoke-harness-script.md`.
- Updated the RC evidence table row for S01 to `Blocked`.
- Added the blocker to the RC evidence blocker table.

No runtime files were changed.

## 7. Validation Commands Run

```bash
bun run e2e:smoke -- --scenario s01-registration
bun test apps/electron/src/main/__tests__/account-session*.test.ts
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
git diff --check
```

## 8. Passing Test Output Summary

- `bun test apps/electron/src/main/__tests__/account-session*.test.ts`: 10
  pass, 0 fail, 23 expectations.
- `bun run validate:agent-contract`: ok, 11 skills, 305 tickets, 7 required
  docs.
- `bun run validate:docs`: ok, architecture docs and sync-v2 design validated.
- `bun run validate:rebrand`: passed with no forbidden tokens outside the
  allowlist.
- `bun run validate:roadmap`: OK, 46 phases, 110 tickets across detail files.

## 9. Build Output Summary

No build was run because this ticket made no runtime/source changes and the S01
smoke did not reach a launchable Electron path.

## 10. Remaining Risks

- S01 has not validated the actual registration UI, restart hydration,
  screenshots, or cross-tenant isolation because the shared RC smoke harness
  entry point is missing.
- The account-session unit tests are green, but they are not a substitute for
  the required clean-build Electron smoke.
- `T352` must land before S01 can be re-run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| New user can complete registration flow on a clean Electron build | Blocked | Missing `e2e:smoke` script prevents smoke launch |
| Post-login home screen is visible without errors | Blocked | Missing `e2e:smoke` script prevents smoke launch |
| App restart shows the user as still logged in | Blocked | Missing `e2e:smoke` script prevents smoke launch |
| `$userData/session.enc` is present and non-empty after login | Blocked | Smoke not launchable; unit persistence coverage is green |
| `session.enc` is absent or invalid-on-decrypt after logout | Blocked | Smoke not launchable; unit logout/corrupt-session coverage is green |
| Storage writes route to tenant prefix with `ROX_MULTI_TENANT=1` | Blocked | Smoke not launchable |
| Two accounts cannot read each other's workspace data | Blocked | Smoke not launchable |
| Screenshot evidence referenced in RC evidence doc | Blocked | No screenshot possible before smoke harness exists |
| RC evidence row S01 updated | Pass | `docs/release/2026-05-14-rc-evidence.md` row S01 is `Blocked` |
| Blocking ticket filed | Pass | `T352-rc-e2e-smoke-harness-script.md` |
