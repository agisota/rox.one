# T434 - R.11 current-main validation snapshot wording

Status: DONE
Phase: R.11 report-only audit hygiene
Ticket: docs/tickets/T434-r11-current-main-validation-snapshot.md

## 1. Task summary

Clarify that `docs/release/r11-current-main-validation-2026-05-14.md` is a
captured full-matrix snapshot from T429, not a live source for the current
ticket count after each later audit-hygiene ticket.

## 2. Repo context discovered

Fresh `bun run validate:docs` after T433 reports `398 tickets`, while the
current-main validation report records `394 tickets` from the T429 full-matrix
run. The report is still useful as pre-rewrite full-matrix evidence, but the
audit wording currently calls it the latest clean check and can be misread as
live evidence.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/release/r11-completion-audit-2026-05-14.md`
- `docs/release/r11-current-main-validation-2026-05-14.md`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`

## 4. Tests added first

- `scripts/__tests__/rebrand-r11-completion-audit.test.ts` now requires the
  completion audit and validation report to call the T429 full-matrix run a
  captured snapshot rather than live ticket-count evidence.
- `scripts/__tests__/rebrand-r11-preflight.test.ts` now requires the T298
  worklog to point later audit-hygiene tickets at their own fresh targeted
  validation evidence.

## 5. Expected failing test output

The RED run failed for the expected missing wording:

```text
Expected to contain: "Pre-rewrite full-matrix snapshot evidence"
Expected to contain: "Captured full-matrix snapshot"
Expected to contain: "T429 full-matrix snapshot"
```

## 6. Implementation changes

- Updated `docs/release/r11-completion-audit-2026-05-14.md` to describe the
  T429 validation matrix as pre-rewrite full-matrix snapshot evidence and to
  point later report-only tickets at their own targeted validation evidence.
- Updated `docs/release/r11-current-main-validation-2026-05-14.md` to say the
  `394 tickets` count was captured at run time and is not a live
  ticket-count source.
- Updated `docs/worklog/T298-rebrand-git-history-rewrite.md` so the destructive
  R.11 closeout worklog treats the T429 matrix as a snapshot instead of the
  latest validation for every later audit-hygiene ticket.
- Did not run tag mutation, backup artifact creation, offline mirror creation,
  `git filter-repo`, force-push, or branch cleanup.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

- Completion audit regression: `14 pass`, `0 fail`, `135 expect() calls`.
- R.11 preflight regression: `21 pass`, `0 fail`, `71 expect() calls`.
- Docs validation: exit 0; agent-contract reported `399 tickets` and `7
  required docs`; architecture docs and sync-v2 design validators passed.
- Rebrand validation: exit 0; no forbidden tokens outside the allowlist.
- `git diff --check`: exit 0 with no output.

## 9. Build output summary

No build expected for this documentation/test-only report hygiene change.

## 10. Remaining risks

R.11 remains blocked. This ticket does not authorize tag mutation, backup
artifact creation, offline mirror creation, `git filter-repo`, force-push, or
branch cleanup.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED assertions fail before implementation | Green | Initial targeted runs failed on missing snapshot wording |
| Current-main report identifies the full matrix as a captured snapshot | Green | `docs/release/r11-current-main-validation-2026-05-14.md` says the matrix is captured and not live ticket-count evidence |
| Completion audit avoids live-count wording for the snapshot | Green | `docs/release/r11-completion-audit-2026-05-14.md` points later tickets at their own validation evidence |
| T298 worklog points later audit tickets to their own validation | Green | `docs/worklog/T298-rebrand-git-history-rewrite.md` uses T429 snapshot wording |
| Targeted tests and docs validators pass | Green | Targeted tests, docs validation, rebrand validation, and diff check passed |
| No destructive R.11 action is performed | Green | No tag mutation, backup creation, mirror creation, filter-repo, force-push, or branch cleanup was run |
