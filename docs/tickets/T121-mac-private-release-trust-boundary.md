# T121 - Mac Private Release Trust Boundary

Status: DONE

## Context

The current macOS arm64 package is verified as a private/local RC artifact. It
is intentionally ad-hoc signed, not notarized, and built with ASAR disabled.
Those facts are documented, but the Mac ARM workflow does not yet run a
deterministic trust-boundary validator before uploading the package artifacts.

The release pipeline should fail clearly if the local/private artifact trust
boundary drifts or if a future production-signed/notarized artifact appears
without updating the release contract.

## Goal

Add a deterministic macOS private release trust-boundary validator and wire it
into the Mac ARM workflow contract before artifact upload.

## Required UI

No UI change.

## Required Data/API

- Validate existing package scripts and Electron builder configuration.
- Inspect the packaged `ROX.ONE.app` signature and notarization state when
  running on macOS.
- Preserve package/lock dependency files except for the intended root
  `package.json` script entry.

## Required Automations

- Add `validate:mac-private-release-boundary`.
- Require the Mac ARM workflow to run the trust-boundary validator after
  packaging/smoke and before artifact upload.
- Update workflow contract validators so future workflow drift is caught.

## Required Subagents

No subagent required: this is a bounded release validation slice.

## TDD Requirements

Before implementation:

1. Run `bun run validate:mac-private-release-boundary` and confirm it fails
   because the script is missing.
2. Add the validator contract before wiring the workflow and confirm
   `validate:mac-arm-build-workflow` fails while the workflow omits the new
   gate.

## Implementation Requirements

- Do not sign, notarize, upload, or mutate packaged artifacts.
- Do not weaken public-production blocked language.
- Do not add dependencies.
- Keep the validator explicit that the current artifact is private/local RC,
  not production distribution evidence.

## Validation Commands

- `bun run validate:mac-private-release-boundary`
- `bun run validate:mac-arm-build-workflow`
- `bun run validate:private-release-pipeline`
- `bun run validate:docs`
- `git diff --check`
- `git status --short -- package.json bun.lock apps/electron/package.json`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Worklog captures red script-missing evidence | DONE |
| Workflow contract fails before workflow gate is added | DONE |
| Mac private release boundary validator exists | DONE |
| Validator confirms ASAR-disabled local-RC config is documented | DONE |
| Validator confirms current packaged app is ad-hoc signed on macOS | DONE |
| Validator confirms current packaged app has no stapled notarization ticket on macOS | DONE |
| Mac ARM workflow runs the boundary validator before upload | DONE |
| Workflow contract validators require the new gate | DONE |
| Package/lock dependency files remain stable except intended script entry | DONE |
| Focused validation passes | DONE |
| Worklog is complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T121-mac-private-release-trust-boundary.md`.
