# T300 - Align rebrand doc test with spine successor text

Status: DONE

## Context

The merged spine roadmap updated `plan.md` so the successor line points at both
the rebrand sweep and the end-to-end spine roadmap. The R.4 documentation
cleanup regression test still expected the pre-spine sentence and now fails on
fresh `main`.

## Goal

Update the R.4 documentation cleanup regression test so it accepts the current
ROX.ONE plan successor text and still proves the spine pointer remains present.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None; the failure is a single test expectation mismatch.

## TDD Requirements

Use the existing failing `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
output as the red check before changing the test expectation.

## Implementation Requirements

- Update only `scripts/__tests__/rebrand-doc-cleanup.test.ts`.
- Do not modify `plan.md` or other roadmap artifacts.
- Preserve the existing checks for dotted `ROX.ONE`, upstream attribution, and
  legacy-token exclusions.

## Validation Commands

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] Ticket exists before test changes.
- [x] Existing failing test output is recorded.
- [x] Rebrand doc cleanup test passes.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T300-rebrand-doc-test-spine-successor.md`.
