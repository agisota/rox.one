# T327 - Rebrand follow-up SHA drift after T227

Status: DONE
Phase: R.10 follow-up evidence repair
Ticket: docs/tickets/T327-rebrand-followup-sha-drift-after-t227.md

## 1. Task summary

Refresh the R.10 follow-up closeout evidence after rebasing onto PR #74.

## 2. Repo context discovered

`origin/main` advanced to `21f4543` after PR #74 merged. Rebasing the follow-up
branch rewrote T321 to `33e08cf`, while the release mapping still named the
previous T321 commit.

## 3. Files inspected

- `scripts/__tests__/rebrand-permanent-gate.test.ts`
- `docs/release/rebrand-mapping-2026-05-13.md`
- `docs/tickets/T324-rebrand-followup-sha-drift-guard.md`
- `docs/worklog/T324-rebrand-followup-sha-drift-guard.md`
- `docs/worklog/T322-rebrand-closeout-evidence-reconciliation.md`

## 4. Tests added first

No new test file was needed. T324 already made the permanent gate derive the
current T321 commit from git.

## 5. Expected failing test output

`bun test scripts/__tests__/rebrand-permanent-gate.test.ts` failed because the
gate expected `| R.10 follow-up | T321 | `33e08cf` |`, while the release
mapping still contained the previous T321 row.

## 6. Implementation changes

- Updated `docs/release/rebrand-mapping-2026-05-13.md` to record T321 as
  `33e08cf`.
- Updated T322/T324 evidence wording to describe the PR #74 rebase point.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts` (red)
- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`: 5 pass,
  0 fail, 8 expects.
- `bun run validate:rebrand`: `rebrand validation passed: no forbidden tokens
  outside the allowlist`.
- `bun run validate:roadmap`: `validate:roadmap OK -- 46 phases, 111 tickets
  across detail files`.
- `git diff --check`: clean.

## 9. Build output summary

Not run. This ticket changes documentation evidence only.

## 10. Remaining risks

R.11 remains blocked by hard prerequisites independently of this evidence
repair.

## 11. Acceptance criteria matrix

- [x] The permanent gate fails before implementation for the expected SHA drift.
- [x] The release mapping records T321 as `33e08cf`.
- [x] T322/T324 evidence no longer names the previous current T321 SHA as current.
- [x] Rebrand and roadmap validation pass.
- [x] Worklog complete.
