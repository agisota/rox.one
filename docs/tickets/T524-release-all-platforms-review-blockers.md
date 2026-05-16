# T524 - Release-all-platforms review blocker repair

Status: DONE

## Context

Code review of PR #248 found remaining workflow risks after T523:

- Windows `working-directory: apps/electron` steps write logs through
  `..\..\..\.ci-logs`, which escapes one level above the repository.
- `actions/checkout` keeps persisted credentials available during build steps
  even though the job has `contents: write`.
- Packaged artifact validation is disabled, and the validator still treats
  Linux as signed-only even though this unified workflow intentionally ships an
  unsigned Linux RC baseline.

## Goal

Make the unified all-platforms release workflow safe to merge by fixing those
review blockers and restoring packaged artifact validation for every platform.

## Required UI

None.

## Required Data/API

None.

## Required Automations

- `.github/workflows/release-all-platforms.yml`
- `scripts/validate-packaged-artifacts.ts`
- `scripts/__tests__/validate-packaged-artifacts.test.ts`

## Required Subagents

Code-review and verifier subagents already inspected the PR and R.11 blockers.

## TDD Requirements

Before implementation:

1. Add a packaged-artifact validator test proving unsigned Linux validation
   passes without `*.AppImage.sig`.
2. Run the targeted validator test and confirm the new test fails because the
   current validator still requires the signature.
3. Run a static workflow blocker check and confirm it fails on the Windows log
   path, checkout credential persistence, and disabled artifact validation.

## Implementation Requirements

- Keep signed Linux validation strict and requiring `*.AppImage.sig`.
- Allow unsigned Linux validation to require `.AppImage`, `.deb`, and `.rpm`
  without `.AppImage.sig` when the workflow opts into deb/rpm checks.
- Re-enable packaged artifact validation in the unified release workflow with
  correct platform/env scoping.
- Correct Windows log paths to stay under the repo root.
- Disable checkout credential persistence for the pre-publish checkout.
- Do not change runtime source files.

## Validation Commands

- `bun test scripts/__tests__/validate-packaged-artifacts.test.ts`
- Static workflow blocker check.
- YAML parse for all GitHub workflows.
- `bun run validate:ci-contract`
- `bun run validate:mac-arm-build-workflow`
- `bun run validate:rebrand`
- `bun run validate:docs`
- `git diff --check`
- Hosted PR checks after push.

## Acceptance Criteria

- [x] RED validator test fails before implementation for unsigned Linux
  signature requirement.
- [x] RED workflow static check fails before implementation for the review
  blockers.
- [x] Unsigned Linux packaged-artifact validation passes without
  `*.AppImage.sig`.
- [x] Signed Linux packaged-artifact validation still requires
  `*.AppImage.sig`.
- [x] Unified workflow validates Mac, Linux, and Windows artifacts before
  publishing.
- [x] Windows log paths stay inside the repository.
- [x] Checkout credential persistence is disabled.
- [x] Validation commands pass.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T524-release-all-platforms-review-blockers.md`.
