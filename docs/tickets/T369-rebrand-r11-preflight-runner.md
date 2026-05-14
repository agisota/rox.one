# T369 - Rebrand R.11 preflight runner

Status: DONE

## Context

The active rebrand-sweep goal remains blocked on Phase R.11. T351 and T368
record the blocker set manually, but the prerequisite audit is not yet
machine-repeatable.

R.11 is destructive and must fail closed until every hard prerequisite is
true. A report-only runner gives future operators a deterministic checklist
without running `git filter-repo`, creating backup refs, or force-pushing.

## Goal

Add a report-only R.11 preflight runner and package script that evaluates the
hard prerequisites from the rebrand-sweep goal and exits non-zero while any
prerequisite is missing.

## Required UI

None.

## Required Data/API

No runtime data or product API changes.

## Required Automations

- Add `scripts/rebrand-r11-preflight.ts`.
- Add `bun run rebrand:r11-preflight` in root `package.json`.
- Add focused tests in `scripts/__tests__/rebrand-r11-preflight.test.ts`.

## Required Subagents

None.

## TDD Requirements

Write the test first and confirm it fails before implementing the runner.

## Implementation Requirements

- The runner must be report-only.
- The runner must not run `git filter-repo`.
- The runner must not create or push tags, branches, or force-updated refs.
- The runner must expose pure evaluation helpers for tests.
- The runner must fail closed when no explicit no-active-goal acknowledgement
  is provided.
- The runner must detect open PRs, missing backup tag, missing offline mirror,
  missing `git-filter-repo`, missing R.11 closeout ticket, dirty worktree, and
  `main`/`origin/main` divergence.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run rebrand:r11-preflight`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED test captured before implementation.
- [x] Runner exists and has pure evaluation tests.
- [x] Package script exists.
- [x] Runner exits non-zero on the current blocked repo state.
- [x] Documentation validation passes.
- [x] Rebrand validation passes.
- [x] Whitespace diff check passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T369-rebrand-r11-preflight-runner.md`.
