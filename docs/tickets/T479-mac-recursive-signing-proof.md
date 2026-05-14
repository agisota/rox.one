# T479 - Mac recursive signing proof

Status: DONE

## Context

T478 restored PR #217 mergeability and added a private mac `afterSign` hook, but
review found two remaining proof gaps: the hook uses blanket `codesign --deep`,
and the live validator only inspects the top-level `.app` metadata. That can
hide nested helper/framework signing drift.

## Goal

Make the private mac signing path explicit and recursively verifiable: nested
bundle/code entries are signed inner-first without top-level `--deep`, and the
live mac boundary validator runs strict recursive codesign verification.

## Required UI

None.

## Required Data/API

No production data or API changes.

## Required Automations

- Add regression coverage before changing the hook.
- Keep `validate:mac-arm-build-workflow` and
  `validate:mac-private-release-boundary` aligned with the recursive signing
  contract.

## Required Subagents

Code-review and git audit findings from T478 are sufficient; no new subagent is
required unless validation exposes a new uncertain area.

## TDD Requirements

- First extend the mac boundary fixture test so current code fails because
  `afterSign` still uses top-level `--deep` and the live validator lacks
  recursive strict verification.
- Confirm RED for the intended reason before implementation.

## Implementation Requirements

- Do not weaken the private mac trust-boundary validator.
- Do not override production signing; keep the hook gated to
  `ROX_DEV_RUNTIME=1`.
- Do not run destructive R.11 actions, mutate tags, delete branches, create
  backup refs, run `git filter-repo`, force-push, clear `/goal`, or call
  `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/validate-mac-boundary-fixtures.test.ts`
- `bun run validate:mac-arm-build-workflow`
- `bun run validate:mac-private-release-boundary`
- `git diff --check`

## Acceptance Criteria

- [x] RED fails because recursive signing/verification proof is absent.
- [x] `afterSign` signs nested code inner-first without top-level `--deep`.
- [x] Live mac validator requires `codesign --verify --deep --strict`.
- [x] Mac boundary tests and validators pass locally.
- [x] T479 commit is ready to push again for fresh CI.
- [x] No destructive R.11 action is performed.
