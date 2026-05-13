# T333 - Rebrand R.6 closeout status repair

Status: DONE

## Context

R.6 landed on main as `777ada7` (`Complete R.6 env-var rename with readEnv()
shim (#66)`), and `.swarm/master-roadmap-log.md` records
`rebrand-R.6-env-var-shim | 777ada7 | T285,T286,T287,T288`. The rebrand
follow-up branch still had T286, T287, and T288 marked `IN_PROGRESS`, with
their worklog evidence sections left as placeholders.

That metadata drift makes the R.11 prerequisite "R.0 through R.10 all
`Status: DONE` with matching closeout tickets" fail even though the R.6
runtime and doc changes are already merged.

## Goal

Bring the R.6 ticket/worklog metadata into line with the merged evidence
without changing runtime behavior.

## Required UI

None.

## Required Data/API

None. Documentation metadata only.

## Required Automations

Use the existing status-contract checks, R.6 env-compat focused test, rebrand
validator, docs validator, roadmap validator, and diff check.

## Required Subagents

None.

## TDD Requirements

Run a status-contract check first and confirm T286, T287, and T288 are not
yet marked `DONE`.

## Implementation Requirements

1. Mark T286, T287, and T288 ticket/worklog metadata `DONE`.
2. Fill their acceptance matrices with the current green evidence.
3. Add the R.6 merge SHA to T285-T288 ticket metadata so T288's SHA criterion
   is satisfied.
4. Do not edit runtime/source files.

## Validation Commands

- R.6 status-contract check
- `bun test packages/shared/src/utils/__tests__/env-compat.test.ts`
- `bun run validate:rebrand`
- `bun run validate:docs`
- `bun run validate:roadmap`
- `git diff --check`

## Acceptance Criteria

- [x] Status-contract check fails before implementation for the expected R.6 metadata.
- [x] T286, T287, and T288 ticket/worklog metadata are `Status: DONE`.
- [x] T286-T288 worklogs have passing output summaries and acceptance matrices.
- [x] T285-T288 tickets reference R.6 merge commit `777ada7`.
- [x] R.6 focused test and repository validators pass.
- [x] No runtime/source files changed.

## Worklog

Update `docs/worklog/T333-rebrand-r6-closeout-status-repair.md`.
