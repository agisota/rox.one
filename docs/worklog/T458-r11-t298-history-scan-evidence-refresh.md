# T458 - R.11 T298 history scan evidence refresh

Status: DONE
Phase: R.11 report-only closeout hygiene
Ticket: docs/tickets/T458-r11-t298-history-scan-evidence-refresh.md

## 1. Task summary

Refresh the blocked T298 closeout worklog so its history-scan wording matches
the current unbounded R.11 evidence.

## 2. Repo context discovered

`docs/release/r11-history-scan-inventory-2026-05-14.md` and the current
completion audit record the unbounded `bun run rebrand:r11-history-scan`
result as 81 forbidden-token patch lines. `docs/worklog/T298-rebrand-git-history-rewrite.md`
still described that helper as exiting red with bounded finding output.

## 3. Files inspected

- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `docs/release/r11-history-scan-inventory-2026-05-14.md`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-r11-preflight.test.ts` so the T298 worklog
must cite `docs/release/r11-history-scan-inventory-2026-05-14.md`, record
`81 forbidden-token patch lines`, and omit `bounded finding output`.

## 5. Expected failing test output

Before refreshing the T298 worklog, the targeted test failed because the
worklog did not cite the current history-scan inventory:

```text
Expected to contain: "docs/release/r11-history-scan-inventory-2026-05-14.md"
(fail) R.11 closeout worklog documentation > keeps T298 history-scan wording aligned with the current unbounded evidence
```

## 6. Implementation changes

Updated `docs/worklog/T298-rebrand-git-history-rewrite.md` so the
report-only history-scan helper line records the current 81 forbidden-token
patch lines and points at
`docs/release/r11-history-scan-inventory-2026-05-14.md`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`: 34 pass,
  0 fail, 157 expect calls.
- `bun run validate:docs`: green; agent contract reports 423 tickets and
  7 required docs.
- `bun run validate:rebrand`: green; no forbidden tokens outside the allowlist.
- `bun run validate:roadmap`: green; reports 46 phases, 110 tickets across
  detail files, and 14 rebrand master-roadmap log rows.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 7 existing warnings and 0 errors.
- `git diff --check`: exit 0.

## 9. Build output summary

No build expected for this report-only worklog/test change.

## 10. Remaining risks

R.11 remains blocked by active goal state, fork count, tag mismatch/off-main
target, missing backup artifacts, missing offline mirror, remote branch review,
legal-preserve checks blocked by the missing backup tag, and the red history
scan. This ticket does not authorize clearing `/goal`, calling completion APIs,
tag mutation, backup creation, `git filter-repo`, force-push, branch cleanup,
or fork-owner contact.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED assertion fails because the T298 worklog still records the stale bounded-output history-scan wording | PASS | Targeted test failed before the T298 worklog refresh because the current inventory path was missing |
| T298 worklog cites `docs/release/r11-history-scan-inventory-2026-05-14.md` | PASS | T298 report-only history-scan helper line now cites the sanitized inventory |
| T298 worklog records the current 81-finding red history-scan result | PASS | T298 report-only history-scan helper line now records 81 forbidden-token patch lines |
| Targeted test and validators pass | PASS | Targeted preflight test, docs/rebrand/roadmap validators, typecheck, lint, and diff-check passed |
| No destructive R.11 action is performed | PASS | No goal clear, completion API, tag mutation, backup creation, mirror creation, filter-repo, force-push, branch cleanup, or fork-owner contact commands were run |
