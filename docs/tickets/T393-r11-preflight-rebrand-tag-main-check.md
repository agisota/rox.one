# T393 - R.11 preflight rebrand tag main check

Status: DONE

## Context

The R.11 goal requires the `rebrand-v1` tag from R.10 to exist before the
history rewrite, and the global stopping condition requires the tag to exist on
`main` before it is re-pointed after R.11.

The report-only preflight currently checks only that the tag is visible on
`origin`; it does not prove the tag target is on the `origin/main` ancestry.

## Goal

Extend `bun run rebrand:r11-preflight` with a fail-closed
`rebrand-tag-on-main` row that verifies `rebrand-v1^{commit}` is an ancestor of
`origin/main`.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Update `scripts/rebrand-r11-preflight.ts` and focused tests only.

## Required Subagents

None.

## TDD Requirements

Add a failing evaluator regression test before implementation proving the
preflight fails when `rebrand-v1` exists but is not on `origin/main`.

## Implementation Requirements

- Add a distinct `rebrand-tag-on-main` row.
- Use local git refs only; do not fetch, create, delete, or re-point tags.
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

- [x] Regression test fails before implementation.
- [x] Regression test passes after implementation.
- [x] Preflight has a distinct `rebrand-tag-on-main` row.
- [x] Live preflight reports the current tag-on-main state.
- [x] Documentation/rebrand validation remains green.
- [x] Destructive R.11 actions are not executed.
- [x] Commit created.

## Worklog

See `docs/worklog/T393-r11-preflight-rebrand-tag-main-check.md`.
