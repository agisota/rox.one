# T447 - R.11 preflight backup branch collector regression

Status: DONE

## Context

After T446 landed, a clean-worktree `bun run rebrand:r11-preflight` run crashed
while collecting the remote backup branch commit. The collector stored the
`git ls-remote --heads` output as a string but later treated it as an object
with a `.stdout` field.

## Goal

Restore the report-only R.11 preflight so it returns the expected red report
instead of crashing while backup branch artifacts are absent or present.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

- Add a regression test that calls `collectR11PreflightSnapshot()` and proves
  backup branch commit collection does not crash.

## Required Subagents

None. This is a narrow regression fix in the report-only preflight script.

## TDD Requirements

- Write the failing collector regression test before fixing the implementation.
- Confirm RED with the current `TypeError`.

## Implementation Requirements

- Fix only the backup branch commit parsing bug.
- Keep the report-only behavior; do not mutate tags, branches, mirrors, or
  history.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`
- `bun run rebrand:r11-preflight` (expected red while existing blockers remain)
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`
  (expected red while existing blockers remain)

## Acceptance Criteria

- [x] RED collector test fails with the current `TypeError`.
- [x] Preflight collector no longer crashes.
- [x] Default preflight prints a red report instead of crashing.
- [x] Pre-rewrite preflight prints a red report instead of crashing.
- [x] Targeted test and validators pass.
- [x] No destructive R.11 action is performed.
