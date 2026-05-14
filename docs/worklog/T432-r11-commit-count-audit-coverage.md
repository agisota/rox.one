# T432 - R.11 commit-count audit coverage

Status: DONE
Phase: R.11 completion audit hygiene
Ticket: docs/tickets/T432-r11-commit-count-audit-coverage.md

## 1. Task summary

Add the R.11 pre/post commit-count artifact to the durable completion audit
coverage.

## 2. Repo context discovered

The R.11 goal requires T298 to record every command, backup, legal-preserve
diff, and the pre/post `git rev-list --count main` numbers. Its validation
section also requires `git log --oneline | wc -l` to show the expected
post-rewrite commit count and document any filter-repo delta. The durable
completion audit does not yet list this artifact.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/release/r11-completion-audit-2026-05-14.md`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`

## 4. Tests added first

Extend the R.11 completion-audit regression so it requires the pre/post
commit-count artifact, `git log --oneline | wc -l`, `git rev-list --count
main`, and blocked post-rewrite timing.

## 5. Expected failing test output

`bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` failed for
the intended reason before the audit was updated:

- `11 pass`, `2 fail`, `104 expect() calls`
- Missing objective deliverable:
  `pre/post commit count delta`
- Missing prompt-checklist row:
  `pre/post commit count delta`

## 6. Implementation changes

- Added `pre/post commit count delta` to the completion-audit objective
  deliverables.
- Added a prompt-to-artifact checklist row for `git rev-list --count main`,
  `git log --oneline | wc -l`, and the post-rewrite filter-repo delta.
- Recorded that this evidence is blocked until rewritten ancestry exists.
- Preserved audit `Status: NOT ACHIEVED`.
- Did not run `git filter-repo`, count rewritten commits, edit refs, mutate
  tags, branches, backups, mirrors, history, runtime source files, or
  production dependencies.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` (RED)
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` (GREEN)
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

- Targeted completion-audit regression: `13 pass`, `0 fail`,
  `125 expect() calls`.
- Docs validation: exit 0; agent-contract reported 397 tickets and 7 required
  docs.
- Rebrand validation: exit 0; no forbidden tokens outside the allowlist.
- Whitespace check: exit 0.

## 9. Build output summary

No build expected for this report-only documentation coverage change.

## 10. Remaining risks

R.11 remains blocked by active goal state, tag drift, off-main tag target,
missing backup artifacts, unreviewed remote branch set, missing legal-preserve
backup tag, and historical forbidden-token patch lines. Commit-count evidence
cannot be real until the destructive rewrite has produced rewritten ancestry.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED completion-audit assertion proves the commit-count artifact is missing from the durable audit | Green | RED targeted test failed on the missing objective and checklist row |
| Completion audit maps pre/post commit counts to blocked post-rewrite evidence | Green | Audit prompt-to-artifact checklist maps the commit-count row to blocked post-rewrite timing |
| Audit references `git log --oneline | wc -l` and `git rev-list --count main` | Green | Audit row references both commands |
| Targeted validation, docs validation, rebrand validation, and whitespace checks pass | Green | Targeted regression, docs validation, rebrand validation, and whitespace check passed |
