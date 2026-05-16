# T526 - Rebrand v1 main ancestry repair

Status: DONE

## Context

After PR #248 merged, the acknowledged R.11 pre-backup gate has one remaining
hard blocker: `rebrand-v1` points at `b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99`,
which is visible on `origin/chore/rebrand-R10-final-sweep-and-gate` but is not
in `origin/main` ancestry.

The R.11 goal requires the `rebrand-v1` target to be on `origin/main` before
any destructive backup, filter-repo, or force-push step starts.

## Goal

Make the existing `rebrand-v1` target reachable from `main` without retargeting
or force-pushing the tag.

## Required UI

None.

## Required Data/API

None.

## Required Automations

- `scripts/rebrand-r11-preflight.ts`

## Required Subagents

None.

## TDD Requirements

Use the R.11 preflight as the RED gate: before this change, an acknowledged
pre-backup run must fail only on `rebrand-tag-on-main`.

## Implementation Requirements

- Merge `origin/chore/rebrand-R10-final-sweep-and-gate` into a PR branch so
  the existing `rebrand-v1` commit becomes part of `main` ancestry after the PR
  merges.
- Do not retarget or force-push `rebrand-v1`.
- Do not create R.11 backup refs or offline mirrors in this ticket.
- Do not run `git filter-repo`.

## Validation Commands

- `ROX_R11_NO_ACTIVE_GOAL=1 ROX_R11_EXPECTED_FORKS=2 bun run rebrand:r11-preflight`
- `bun run validate:rebrand`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [ ] RED acknowledged pre-backup gate fails only on `rebrand-tag-on-main`
  before the merge branch lands.
- [x] The PR branch merge parent is the existing `rebrand-v1` target.
- [x] Current `main` content wins conflicts with the older R10 branch.
- [x] No tag retarget or force-push occurs.
- [x] No R.11 backup refs, offline mirror, or filter-repo command is run.
- [x] Targeted validation passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T526-rebrand-v1-main-ancestry.md`.
