# T288 - Rebrand env-var deprecation warning coverage

Status: DONE

R.6 merge evidence: `777ada7` (`Complete R.6 env-var rename with readEnv() shim (#66)`)

## Context

T285 ships the shim with its own unit tests. T288 is the *closeout* ticket
for Phase R.6: it confirms the deprecation cadence holds at the
process-wide level, documents the rollout, and appends the phase ledger
line.

## Goal

Verify the deprecation warning emitted by `readEnv()` fires:

1. Exactly once per legacy variable per process.
2. Independently for two different legacy variables.
3. Never when the new `ROX_*` name is present (regardless of legacy state).

The T285 test file already encodes these guarantees. T288 adds the closeout
worklog wrapping the four-ticket cluster (T285-T288) and the validation
matrix evidence run from the worktree.

## Required UI

None.

## Required Data/API

None.

## Required Automations

The phase ledger line for `rebrand-R.6-env-var-shim` lands in
`.swarm/master-roadmap-log.md` once the PR merges.

## Required Subagents

None.

## TDD Requirements

Re-runs the T285 test file; no new test source. The closeout worklog
records the verbatim output of:

- `bun test packages/shared/src/utils/__tests__/env-compat.test.ts`
- the full `bun test` suite
- `bun run typecheck` / `lint` / `build` / `validate:rebrand` /
  `validate:roadmap` / `git diff --check`

## Implementation Requirements

No code. Closeout-only ticket: worklog + roadmap log append.

## Validation Commands

See the full validation matrix in the parent worklog
`docs/worklog/T288-rebrand-env-var-deprecation-warning-coverage.md`.

## Acceptance Criteria

- [x] All four T285-T288 tickets carry a referenced commit SHA.
- [x] The deprecation warning test passes locally and in the focused run.
- [x] Phase ledger line appended for `rebrand-R.6-env-var-shim`.
- [x] No regression beyond the 1-test budget on the full `bun test` suite.

## Worklog

Update `docs/worklog/T288-rebrand-env-var-deprecation-warning-coverage.md`.
