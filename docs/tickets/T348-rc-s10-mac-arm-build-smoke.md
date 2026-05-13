# T348 - RC Scenario S10: Mac ARM Build Opens and Smoke Passes

Status: Todo

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.
Phase 20 of the master roadmap runs the ten release-candidate scenarios end-to-end
on a clean Electron build and captures pass/fail evidence.

This ticket covers **RC Scenario 10** from `plan.md §16`:

> Mac ARM build opens and smoke passes.

The scenario exercises the Mac ARM packaging pipeline (T033/T121/T122), the
code-sign and notarization step (Phase 18 of the master roadmap), and the
post-build artifact validation. The packaged `.app` must open on a clean Mac ARM
machine, pass Gatekeeper, and complete the basic smoke sequence (launch → login
screen visible → no immediate crash).

## Goal

Verify that the Mac ARM Electron build artifact:
1. Is correctly code-signed with a Developer ID certificate (or a documented
   self-signed path for private distribution).
2. Passes `codesign --verify` and `spctl --assess` without warnings.
3. Launches on a clean Mac ARM machine without crashing at startup.
4. Displays the login or home screen correctly.
5. The Liquid Glass icon (T116) renders correctly inside the packaged build.

## Required UI

- App launch screen (login or onboarding)
- Dock icon (Liquid Glass, T116)
- No crash dialogs or unhandled exception overlays

## Required Data/API

- Mac ARM build artifact from `bun run electron:build` (arm64 target)
- `codesign --verify --deep --strict <app_path>` output
- `spctl --assess -vvv <app_path>` output
- Electron startup log (no `ERROR` or `FATAL` lines in the first 5 seconds)

## Required Automations

- CI artifact validator gates the upload on `codesign --verify` + `spctl --assess`
  success (T122)
- Build failure halts the Phase 20 run; a new ticket must be filed before
  proceeding

## Required Subagents

None for this validation ticket.

## TDD Requirements

1. Verify `bun run validate:mac-arm-build-workflow` passes.
2. Run `codesign --verify --deep --strict` on the built artifact → assert exit
   code 0.
3. Run `spctl --assess -vvv` on the built artifact → assert no Gatekeeper
   rejection.
4. Launch the app on a clean Mac ARM machine → assert login/home screen is
   visible within 10 seconds.
5. Assert no `ERROR` or `FATAL` in the Electron main-process log during startup.

## Implementation Requirements

No new implementation. This is an RC validation scenario.
Any build, sign, or notarization failures should be filed as blocking tickets
under Phase 18 scope before Phase 20 can close.

## Validation Commands

```bash
# Mac ARM build
bun run electron:build -- --arm64

# Artifact validator (CI gate from T122)
bun run validate:mac-arm-build-workflow

# Code-sign verification (run on Mac ARM machine)
codesign --verify --deep --strict dist/mac-arm64/Agent\ Workbench.app

# Gatekeeper assessment (run on Mac ARM machine)
spctl --assess -vvv dist/mac-arm64/Agent\ Workbench.app

# Smoke run via E2E harness
bun run e2e:smoke -- --scenario s10-mac-arm-smoke

# Agent contract gate
bun run validate:agent-contract
```

## Acceptance Criteria

- [ ] `bun run electron:build` completes without error for the arm64 target
- [ ] `codesign --verify --deep --strict` exits 0 on the built `.app`
- [ ] `spctl --assess` reports no Gatekeeper rejection
- [ ] App launches on a clean Mac ARM machine within 10 seconds
- [ ] Login or onboarding screen is visible on first launch (no crash screen)
- [ ] Liquid Glass dock icon renders correctly in the macOS Dock
- [ ] No `ERROR` or `FATAL` in the Electron main-process startup log
- [ ] Screenshot / terminal output evidence captured and referenced in
      `docs/release/2026-05-14-rc-evidence.md`
- [ ] Pass/fail status updated in the RC evidence table (row S10)

## Worklog

Update `docs/worklog/T348-rc-s10-mac-arm-build-smoke.md` with run log,
codesign output, screenshots, and any blocker ticket references.
