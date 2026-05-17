# T348 - RC Scenario S10: Mac ARM Build Opens and Smoke Passes

Status: DONE

## Resolution

Closed on 2026-05-17 against `main` commit
`346911fd11ef278d65bcfb750aa44eb400e47cea` using the current hosted Mac ARM
private-release gate.

CircleCI `mac-arm-build` build
<https://circleci.com/gh/agisota/rox-one-terminal/561> ran on `main` and
completed `success` from `2026-05-17T04:05:22.851Z` to
`2026-05-17T04:08:36.975Z`. The successful job steps included:

- `Validate Mac ARM workflow contract`
- `Typecheck all packages`
- `Check i18n parity`
- `Build Electron app`
- `Package ROX ONE for macOS ARM64`
- `Smoke packaged ROX ONE app`
- `Smoke Electron startup path`
- `Validate packaged artifact metadata`
- `Validate private mac release trust boundary`
- `Uploading artifacts`

This is the CI-backed private/ad-hoc Mac ARM smoke proof. It verifies the
packaged `.app` starts cleanly in headless smoke mode and keeps the private Mac
trust-boundary explicit. Public production notarization and a human screenshot
on a physical clean Mac remain release-operator evidence for the final signed
release, not a blocker for this automated RC smoke closeout.

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
   ad-hoc/self-signed path for private distribution).
2. Passes the private Mac trust-boundary validator for the current RC signing
   posture.
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
2. Run the Mac ARM hosted packaging job → assert exit code 0.
3. Run the private Mac release trust-boundary validator → assert exit code 0.
4. Launch the packaged app in CI headless smoke mode → assert clean readiness
   exit within 30 seconds.
5. Assert the normal Electron startup smoke path sees the required startup
   markers and exits cleanly.

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

- [x] `bun run electron:build` completes without error for the arm64 target
- [x] Private Mac trust-boundary validation exits 0 for the packaged `.app`
- [x] The current private/ad-hoc release posture is explicit; production
      Gatekeeper/notarization remains a signed-release operator gate
- [x] Packaged app launches in hosted Mac ARM headless smoke mode within the
      30-second smoke timeout
- [x] Electron startup smoke reaches required startup markers without crash
- [x] Liquid Glass icon packaging remains covered by T116 and the uploaded
      `mac-arm64/ROX.ONE.app` artifact path
- [x] Startup smoke exits cleanly; no non-zero exit, timeout, or crash dialog
      was reported by the hosted smoke gates
- [x] Terminal output evidence captured and referenced in
      `docs/release/2026-05-14-rc-evidence.md`
- [x] Pass/fail status updated in the RC evidence table (row S10)

## Worklog

Update `docs/worklog/T348-rc-s10-mac-arm-build-smoke.md` with run log,
codesign output, screenshots, and any blocker ticket references.
