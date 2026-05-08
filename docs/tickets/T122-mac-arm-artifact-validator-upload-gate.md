# T122 - Mac ARM Artifact Validator Upload Gate

Status: DONE

## Context

T091 added `validate:packaged-artifacts` to verify the macOS arm64 DMG/ZIP,
blockmaps, `latest-mac.yml`, sizes, and SHA256 evidence. T121 added a private
Mac release trust-boundary gate before the Mac ARM workflow uploads artifacts.

The Mac ARM workflow still does not run `validate:packaged-artifacts` before
uploading artifacts, so the workflow can upload a package without first running
the deterministic artifact manifest/size/hash validator.

## Goal

Require the Mac ARM workflow to run `bun run validate:packaged-artifacts`
before artifact upload and make that requirement contract-tested.

## Required UI

No UI change.

## Required Data/API

- Preserve existing packaged artifact paths and naming.
- Do not change package manifests or lockfiles.
- Do not mutate packaged artifacts outside the existing validator behavior.

## Required Automations

- Mac ARM workflow runs `bun run validate:packaged-artifacts` after packaging
  and before upload.
- `validate:mac-arm-build-workflow` fails if the workflow omits this gate.
- `validate:private-release-pipeline` fails if the Mac ARM workflow omits this
  gate.

## Required Subagents

No subagent required: this is a bounded release workflow validation slice.

## TDD Requirements

Before implementation:

1. Add workflow-contract assertions for the packaged artifact validator.
2. Run the focused validators and confirm they fail while the workflow omits
   `bun run validate:packaged-artifacts`.

## Implementation Requirements

- Add the workflow step before `actions/upload-artifact@v4`.
- Do not rebuild artifacts in this ticket.
- Do not alter signing, notarization, ASAR, or public-production status.

## Validation Commands

- `bun run validate:packaged-artifacts`
- `bun run validate:mac-arm-build-workflow`
- `bun run validate:private-release-pipeline`
- `bun run validate:docs`
- `git diff --check`
- `git status --short -- package.json bun.lock apps/electron/package.json`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Worklog captures red workflow-contract evidence | DONE |
| Mac ARM workflow runs packaged artifact validation before upload | DONE |
| Mac ARM workflow contract requires packaged artifact validation | DONE |
| Private release pipeline contract requires packaged artifact validation in Mac ARM workflow | DONE |
| Existing packaged artifact validator passes | DONE |
| Package/lock dependency files remain unchanged | DONE |
| Focused validation passes | DONE |
| Release docs mention T122 upload-gate evidence | DONE |
| Worklog is complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T122-mac-arm-artifact-validator-upload-gate.md`.
