# T390 - R.11 preflight closeout prerequisite check

Status: TODO

## Context

Phase R.11 is still blocked before any backup or history rewrite work. The
report-only preflight already checks active goal state, open PRs, fork review,
`rebrand-v1`, exact R.11 closeout files, backup artifacts in `pre-rewrite`
mode, sync, and a clean worktree.

The R.11 hard prerequisites also require R.0-R.10 closeouts, the C4 Phase 1
closeout T223, and the RBAC Phase 2 closeout T229 to be done before R.11 can
start. Those checks are local and can be made machine-verifiable before any
destructive step.

## Goal

Extend `bun run rebrand:r11-preflight` so it fails closed if the local
R.0-R.10 ticket/worklog closeouts, T223 closeout, or T229 closeout are missing
or not `Status: DONE`.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

Update `scripts/rebrand-r11-preflight.ts` and its focused tests.

## Required Subagents

None.

## TDD Requirements

Add a failing regression test before implementation that proves the evaluator
reports distinct rows for:

- R.0-R.10 closeouts;
- C4 Phase 1 closeout T223;
- RBAC Phase 2 closeout T229.

## Implementation Requirements

- Use exact rebrand ticket/worklog paths, not broad `T27*` globs, because
  unrelated roadmap tickets share some numbers.
- Fail closed when a required ticket or worklog is missing.
- Fail closed when a required ticket status is not `DONE`.
- Keep the runner report-only: no backup refs, mirrors, history rewrites, or
  force pushes.
- Do not call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [ ] Regression test fails before implementation.
- [ ] Regression test passes after implementation.
- [ ] Preflight has distinct rows for R.0-R.10, T223, and T229 closeouts.
- [ ] Live default preflight still fails only on active goal.
- [ ] Live pre-rewrite preflight still fails only on backup tag, backup branch,
  and offline mirror when `ROX_R11_NO_ACTIVE_GOAL=1` is set.
- [ ] Documentation/rebrand validation remains green.
- [ ] Destructive R.11 actions are not executed.
- [ ] Commit created.

## Worklog

See `docs/worklog/T390-r11-preflight-closeout-prereq-check.md`.
