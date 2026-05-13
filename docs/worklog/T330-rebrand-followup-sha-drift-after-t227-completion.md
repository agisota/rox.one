# T330 - Rebrand follow-up SHA drift after T227 completion

Status: DONE
Phase: R.10 follow-up evidence repair
Ticket: docs/tickets/T330-rebrand-followup-sha-drift-after-t227-completion.md

## 1. Task summary

Refresh the R.10 follow-up closeout evidence after rebasing onto PR #75.

## 2. Repo context discovered

`origin/main` advanced to `533d837` after PR #75 merged. Rebasing the follow-up
branch rewrote T321 to `f82da7f`, while the release mapping still named the
previous T321 commit.

## 3. Files inspected

- `scripts/__tests__/rebrand-permanent-gate.test.ts`
- `docs/release/rebrand-mapping-2026-05-13.md`
- `docs/tickets/T324-rebrand-followup-sha-drift-guard.md`
- `docs/worklog/T324-rebrand-followup-sha-drift-guard.md`
- `docs/tickets/T327-rebrand-followup-sha-drift-after-t227.md`
- `docs/worklog/T327-rebrand-followup-sha-drift-after-t227.md`
- `docs/worklog/T322-rebrand-closeout-evidence-reconciliation.md`

## 4. Tests added first

No new test file was needed. T324 already made the permanent gate derive the
current T321 commit from git.

## 5. Expected failing test output

`bun test scripts/__tests__/rebrand-permanent-gate.test.ts` failed because the
gate expected `| R.10 follow-up | T321 | `f82da7f` |`, while the release
mapping still contained the previous T321 row.

## 6. Implementation changes

- Updated `docs/release/rebrand-mapping-2026-05-13.md` to record T321 as
  `f82da7f`.
- Updated the prior SHA-drift evidence wording in T322/T324/T327 docs to name
  the PR #75 rebase point and current T321 commit.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts` (red)
- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`
- `bun run validate:rebrand`
- `bun run validate:docs`
- `bun run validate:roadmap`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`: 5 pass,
  0 fail, 8 expects.
- `bun run validate:rebrand`: `rebrand validation passed: no forbidden tokens
  outside the allowlist`.
- `bun run validate:docs`: agent-contract, architecture-docs, and
  sync-v2-design validators passed; agent contract reported 11 skills,
  239 tickets, and 7 required docs.
- `bun run validate:roadmap`: `validate:roadmap OK -- 46 phases, 111 tickets
  across detail files`.
- `git diff --check`: clean.

## 9. Build output summary

Not run. This ticket changes documentation evidence only; the branch-level build
is run separately after the current repair set is committed.

## 10. Remaining risks

R.11 remains blocked by hard prerequisites independently of this evidence
repair.

## 11. Acceptance criteria matrix

- [x] The permanent gate fails before implementation for the expected SHA drift.
- [x] The release mapping records T321 as `f82da7f`.
- [x] Prior SHA-drift evidence no longer names the previous T321 SHA as current.
- [x] Rebrand/docs/roadmap validation passes.
- [x] Worklog complete.
