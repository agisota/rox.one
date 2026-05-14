# T431 - R.11 README banner audit coverage

Status: DONE
Phase: R.11 completion audit hygiene
Ticket: docs/tickets/T431-r11-readme-banner-audit-coverage.md

## 1. Task summary

Add the R.11 README post-rewrite coordination banner to the durable completion
audit coverage.

## 2. Repo context discovered

The R.11 goal requires a `README.md` section named "After R.11 history
rewrite" with a 72-hour visible banner after force-push. T298 tracks the item
as blocked, but the durable completion audit does not yet list it in the
prompt-to-artifact checklist.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/release/r11-completion-audit-2026-05-14.md`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`

## 4. Tests added first

Extend the R.11 completion-audit regression so it requires the README banner
artifact, exact post-rewrite section name, 72-hour visible banner wording, and
blocked post-force-push timing.

## 5. Expected failing test output

`bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` failed for
the intended reason before the audit was updated:

- `10 pass`, `2 fail`, `97 expect() calls`
- Missing objective deliverable:
  `README post-rewrite coordination banner`
- Missing prompt-checklist row:
  `README post-rewrite coordination banner`

## 6. Implementation changes

- Added `README post-rewrite coordination banner` to the completion-audit
  objective deliverables.
- Added a prompt-to-artifact checklist row for `README.md` § "After R.11
  history rewrite".
- Recorded that the 72-hour visible banner is blocked until after R.11
  force-push, so it must not be treated as a current pre-rewrite task.
- Preserved audit `Status: NOT ACHIEVED`.
- Did not edit `README.md`, refs, tags, branches, backups, mirrors, history,
  runtime source files, or production dependencies.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` (RED)
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` (GREEN)
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

- Targeted completion-audit regression: `12 pass`, `0 fail`,
  `118 expect() calls`.
- Docs validation: exit 0; agent-contract reported 396 tickets and 7 required
  docs.
- Rebrand validation: exit 0; no forbidden tokens outside the allowlist.
- Whitespace check: exit 0.

## 9. Build output summary

No build expected for this report-only documentation coverage change.

## 10. Remaining risks

R.11 remains blocked by active goal state, tag drift, off-main tag target,
missing backup artifacts, unreviewed remote branch set, missing legal-preserve
backup tag, and historical forbidden-token patch lines. The README banner
must not be added before the force-push because it is post-rewrite
coordination.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED completion-audit assertion proves the README banner artifact is missing from the durable audit | Green | RED targeted test failed on the missing objective and checklist row |
| Completion audit maps the README banner requirement to blocked evidence | Green | Audit prompt-to-artifact checklist maps the README row to blocked post-force-push timing |
| Audit keeps `Status: NOT ACHIEVED` and explicitly avoids treating the banner as required before force-push | Green | Audit status remains `NOT ACHIEVED`; README row says only required after force-push |
| Targeted validation, docs validation, rebrand validation, and whitespace checks pass | Green | Targeted regression, docs validation, rebrand validation, and whitespace check passed |
