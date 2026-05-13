# T300 - Align rebrand doc test with spine successor text

## 1. Task summary

Align the R.4 documentation cleanup regression test with the current `plan.md`
successor line introduced by the merged spine roadmap.

## 2. Repo context discovered

- `plan.md` now says the successor goal is the rebrand sweep plus the
  end-to-end spine roadmap.
- `scripts/__tests__/rebrand-doc-cleanup.test.ts` still expected the older
  sentence ending immediately after `R.0-R.10`.
- Full `bun test` fails before reaching later suites because this exact
  expectation no longer matches current `main`.

## 3. Files inspected

- `scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `plan.md`

## 4. Tests added first

No new test file is needed. The existing R.4 documentation cleanup test is the
regression check, and it failed before any changes in this ticket.

## 5. Expected failing test output

Red run:

- Command: `bun test`
- Result: exit 1.
- Expected failure: `scripts/__tests__/rebrand-doc-cleanup.test.ts` expected
  `Successor goal: this rebrand sweep (R.0-R.10).`, while `plan.md` now
  contains `Successor goal: this rebrand sweep (R.0-R.10) and the end-to-end
  spine roadmap.`

## 6. Implementation changes

- Updated `scripts/__tests__/rebrand-doc-cleanup.test.ts` to expect the
  current successor line:
  `Successor goal: this rebrand sweep (R.0-R.10) and the end-to-end spine roadmap.`
- Added an assertion that `plan.md` still points at
  `docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `bun run validate:docs`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`: 4 pass, 0 fail,
  48 assertions.
- `bun run validate:docs`: exit 0; agent contract, architecture docs, and
  sync-v2 design validators passed.
- `git diff --check`: exit 0.

## 9. Build output summary

Not applicable; this is a test expectation repair only.

## 10. Remaining risks

- This ticket intentionally does not change roadmap content. It only updates the
  regression test to match the already-merged spine wording.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Ticket exists before test changes | Pass | T300 ticket and worklog created first |
| Existing failing test output recorded | Pass | Section 5 records the failing `bun test` output |
| Rebrand doc cleanup test passes | Pass | Targeted test passed with 4 pass, 0 fail |
| Validation evidence recorded | Pass | Sections 7-9 record command output summaries |
| Worklog complete | Pass | All 11 required sections are filled |
| Commit created | Pass | Commit created after validation |
