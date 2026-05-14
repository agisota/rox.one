# T481 - GitHub validate full history

Status: DONE

## Context

PR #217 GitHub Actions `validate` now reaches the unit suite, but the R.10
permanent rebrand gate fails only on the PR merge checkout. The test derives
the current T321 evidence with `git log -1 -- docs/tickets/T321-...`; GitHub's
default shallow checkout exposes only the synthetic merge commit, so the gate
expects the merge SHA instead of the real T321 commit recorded in the release
mapping.

## Goal

Make GitHub `validate` check out enough history for repository-history
contracts to evaluate the same way they do locally and in the green CircleCI
validate lane.

## Required UI

None.

## Required Data/API

No production data or API changes.

## Required Automations

- Extend `validate:ci-contract` so it fails when `.github/workflows/validate.yml`
  does not pin `actions/checkout` to `fetch-depth: 0`.

## Required Subagents

- Read-only `explore` for R.10/T321 history diagnosis.
- Read-only `verifier` for fresh PR #217 check status.

## TDD Requirements

- Update `scripts/validate-ci-contract.ts` first.
- Confirm RED because `.github/workflows/validate.yml` still uses the default
  shallow `actions/checkout` configuration.

## Implementation Requirements

- Do not change the R.10 mapping evidence row unless the real T321 commit has
  changed in full history.
- Do not weaken the permanent rebrand gate.
- Do not run destructive R.11 actions, mutate tags, delete branches, create
  backup refs, run `git filter-repo`, force-push, clear `/goal`, or call
  `update_goal`.

## Validation Commands

- `bun run validate:ci-contract`
- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`
- `bun run validate:rebrand`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] RED fails on the shallow GitHub validate checkout contract.
- [x] GitHub validate uses `fetch-depth: 0` for checkout.
- [x] The R.10 permanent gate passes locally with full history.
- [x] CI contract, rebrand validation, docs validation, and diff whitespace
  checks pass locally.
- [x] T481 commit is ready to push for fresh CI.
- [x] No destructive R.11 action is performed.
