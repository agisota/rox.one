# T480 - GitHub validate parity

Status: DONE

## Context

PR #217 is mergeable and CircleCI is green on `155e26e3`, but GitHub Actions
`validate` fails because its workflow still runs Bun `1.3.10` and lacks the
Playwright Chromium install step used by the green CircleCI validate job.

## Goal

Keep `.github/workflows/validate.yml` aligned with the CircleCI validation lane:
use Bun `1.3.13` and install Playwright Chromium before running unit tests.

## Required UI

None.

## Required Data/API

No production data or API changes.

## Required Automations

- Extend `validate:ci-contract` so it fails when GitHub validate drifts from
  the CI runtime contract.

## Required Subagents

None required.

## TDD Requirements

- Update `scripts/validate-ci-contract.ts` first.
- Confirm RED because `.github/workflows/validate.yml` still uses Bun `1.3.10`
  and lacks the Playwright install step.

## Implementation Requirements

- Do not weaken the validation suite.
- Do not change CircleCI behavior unless the contract requires it.
- Do not run destructive R.11 actions, mutate tags, delete branches, create
  backup refs, run `git filter-repo`, force-push, clear `/goal`, or call
  `update_goal`.

## Validation Commands

- `bun run validate:ci-contract`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] RED fails on the stale GitHub validate workflow contract.
- [x] GitHub validate uses Bun `1.3.13`.
- [x] GitHub validate installs Playwright Chromium before the validation suite.
- [x] CI contract and docs validation pass locally.
- [x] T480 commit is ready to push again for fresh CI.
- [x] No destructive R.11 action is performed.
