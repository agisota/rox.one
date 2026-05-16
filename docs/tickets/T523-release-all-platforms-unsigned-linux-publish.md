# T523 - Release-all-platforms unsigned Linux publish repair

Status: DONE

## Context

PR #248 adds a unified release workflow for Mac ARM64, Linux x64, and Windows
x64. The workflow intentionally keeps Linux unsigned in the RC2 baseline, but
the GitHub Release upload list still includes a signed AppImage sidecar.

## Goal

Make the unified unsigned Linux release path internally consistent: if the
workflow does not generate `*.AppImage.sig`, the Linux publish step must not
require that file with `fail_on_unmatched_files: true`.

## Required UI

None.

## Required Data/API

None.

## Required Automations

Update `.github/workflows/release-all-platforms.yml` only.

## Required Subagents

- Code review subagent for workflow risk review.
- Verifier subagent for rebrand/R.11 blocker evidence.

## TDD Requirements

Before implementation, run a static regression check that fails while the
Linux publish step contains `*.AppImage.sig` in the unsigned all-platforms
workflow.

## Implementation Requirements

- Remove the `*.AppImage.sig` release upload requirement from the unsigned
  Linux path in `.github/workflows/release-all-platforms.yml`.
- Keep signed Linux behavior in `.github/workflows/linux-signed-release.yml`
  unchanged.
- Do not touch runtime source files.
- Do not add production dependencies.

## Validation Commands

- Static RED/GREEN check for unsigned Linux `.AppImage.sig` requirement.
- `bun run validate:rebrand`
- `bun run validate:docs`
- `git diff --check`
- Hosted PR checks after push.

## Acceptance Criteria

- [x] The RED check fails before implementation for the expected
  `.AppImage.sig` requirement.
- [x] The unsigned all-platforms Linux publish step no longer requires
  `*.AppImage.sig`.
- [x] Signed Linux workflow remains untouched.
- [x] Rebrand validation passes.
- [x] Docs validation passes.
- [x] Whitespace check passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T523-release-all-platforms-unsigned-linux-publish.md`.
