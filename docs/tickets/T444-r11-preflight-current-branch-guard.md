# T444 - R.11 preflight current branch guard

Status: DONE

## Context

The R.11 runbook and rollback snippets assume the destructive window starts
from the local `main` checkout. The report-only preflight checks that the local
`main` ref is synchronized with `origin/main`, but it does not currently fail
when the operator is on a different branch or detached checkout.

## Goal

Make `bun run rebrand:r11-preflight` fail closed unless the current checkout is
on `main`, without creating refs, mutating tags, creating backup artifacts,
running `git filter-repo`, or pushing.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

- Extend `scripts/__tests__/rebrand-r11-preflight.test.ts` with a RED test for
  a non-main checkout.
- Add a `current-branch` report row to `scripts/rebrand-r11-preflight.ts`.

## Required Subagents

None. This is a narrow report-only safety guard.

## TDD Requirements

- Write the failing preflight unit test first.
- Confirm RED before changing the preflight implementation.

## Implementation Requirements

- The preflight must pass the current-branch row when the checkout is `main`.
- The preflight must fail the current-branch row when the checkout is another
  branch or a detached/unknown state.
- Do not change destructive R.11 behavior or run destructive commands.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`
- `bun run rebrand:r11-preflight` (expected red while existing blockers remain)

## Acceptance Criteria

- [x] RED assertion fails because `current-branch` is not yet checked.
- [x] Preflight reports `current-branch` pass on `main`.
- [x] Preflight reports `current-branch` fail off `main`.
- [x] Existing R.11 blockers remain visible.
- [x] Targeted test and validators pass.
- [x] No destructive R.11 action is performed.
