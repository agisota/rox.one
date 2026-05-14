# T468 - R.11 unified remaining worklist

Status: DONE
Phase: R.11 report-only unified worklist
Ticket: docs/tickets/T468-r11-unified-remaining-worklist.md

## 1. Task summary

Extend the active R.11 consolidation backlog with one complete ordered list of
remaining work so future turns can continue from one canonical surface.

## 2. Repo context discovered

T467 pushed the fork review decision manifest at `a9e9e9ec`. Post-push
preflight evidence still shows default preflight red on 4 blocker rows and
pre-rewrite red on 7 blocker rows. Open PRs are 0; 150 non-main/non-R.11-backup
origin branches remain under operator review.

## 3. Files inspected

- `docs/release/r11-consolidation-backlog-2026-05-14.md`
- `docs/release/r11-completion-audit-2026-05-14.md`
- `docs/release/r11-blocker-inventory-index-2026-05-14.md`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`

## 4. Tests added first

Added `records a unified remaining-worklist for continuing R.11` to
`scripts/__tests__/rebrand-r11-completion-audit.test.ts` before extending the
backlog.

## 5. Expected failing test output

`bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` failed for
the right reason while the backlog lacked the unified worklist:

- missing string: `## Full Remaining Worklist`
- summary: 26 pass, 1 fail, 299 expect calls

After adding the first worklist section, the test failed again on exact
single-line blocker text because Markdown wrapping split the machine-checked
blocker list. The backlog was adjusted to keep canonical blocker rows
single-line and readable.

## 6. Implementation changes

- Added the `## Full Remaining Worklist` section to
  `docs/release/r11-consolidation-backlog-2026-05-14.md`.
- Split the remaining work into phases 0 through 6:
  fresh report-only evidence, operator decisions, remote branch retirement,
  backup artifact creation, legal preserve/rewrite readiness, destructive
  rewrite window, and post-rewrite closeout.
- Recorded current open PR count, remote branch review count, default and
  pre-rewrite blocker IDs, legal-preserve blockers, and history-scan count.
- Preserved no-destructive-action guard language.
- Extended `scripts/__tests__/rebrand-r11-completion-audit.test.ts`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

## 8. Passing test output summary

`bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` passed:

- 27 pass
- 0 fail
- 312 expect calls

`bun test scripts/__tests__/rebrand-r11-preflight.test.ts` passed:

- 34 pass
- 0 fail
- 157 expect calls

Repository validators passed:

- `bun run validate:docs`: `[agent-contract] ok: 11 skills, 435 tickets, 7 required docs`
- `bun run validate:rebrand`: `rebrand validation passed`
- `bun run validate:roadmap`: `validate:roadmap OK`
- `git diff --check`: no whitespace errors

## 9. Build output summary

No build expected for this report-only docs/test change. Source/runtime
behavior is not changed.

## 10. Remaining risks

This ticket creates a worklist only. R.11 remains blocked until
operator-owned destructive gates are explicitly cleared. This ticket does not
authorize branch deletion, tag mutation, backup creation, `git filter-repo`,
force-push, or goal completion.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED assertion fails because the backlog lacks the unified worklist | PASS | RED audit failed on missing `## Full Remaining Worklist`; 26 pass, 1 fail, 299 expects |
| Worklist records default preflight blockers | PASS | Backlog records `no-active-goal`, `fork-review`, `rebrand-tag-local-sync`, `rebrand-tag-on-main` |
| Worklist records pre-rewrite blockers | PASS | Backlog records `fork-review`, `rebrand-tag-local-sync`, `rebrand-tag-on-main`, `backup-tag`, `backup-branch`, `offline-mirror`, `remote-branch-review` |
| Worklist records open PR count 0 and remote branch review count 150 | PASS | Backlog records `Open PRs: 0` and `Remote branches requiring review: 150` |
| Worklist records fork, tag, backup, legal, history-scan, rewrite, and post-rewrite closeout phases | PASS | Backlog phases 0 through 6 cover those surfaces |
| Worklist preserves explicit no-destructive-action guard language | PASS | Backlog says not to delete remote branches or mutate tags until an operator-owned destructive window is explicit |
| Targeted tests and validators pass | PASS | Completion audit: 27 pass, 0 fail, 312 expects; preflight: 34 pass, 0 fail, 157 expects; docs/rebrand/roadmap validators and `git diff --check` passed |
| No destructive R.11 action is performed | PASS | No destructive command has been run |
