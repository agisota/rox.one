# T436 - R.11 current-main snapshot capitalization

Status: DONE
Phase: R.11 report-only audit hygiene
Ticket: docs/tickets/T436-r11-current-main-snapshot-capitalization.md

## 1. Task summary

Fix the lowercase paragraph opener in the R.11 current-main validation
snapshot.

## 2. Repo context discovered

The current-main validation report now correctly treats the T429 matrix as a
captured snapshot, but the follow-up sentence begins `later report-only...`
instead of `Later report-only...`.

## 3. Files inspected

- `docs/release/r11-current-main-validation-2026-05-14.md`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`

## 4. Tests added first

- `scripts/__tests__/rebrand-r11-completion-audit.test.ts` now requires the
  snapshot report to contain `Later report-only audit tickets must record...`
  and reject `\nlater report-only audit tickets`.

## 5. Expected failing test output

The RED run failed for the intended capitalization reason:

```text
Expected to contain: "Later report-only audit tickets must record their own fresh validation evidence"
Received: "... later report-only audit tickets must record their own fresh validation evidence ..."
```

## 6. Implementation changes

- Updated `docs/release/r11-current-main-validation-2026-05-14.md` so the
  audit-hygiene sentence starts with `Later`.
- Updated `scripts/__tests__/rebrand-r11-completion-audit.test.ts` to reject
  the lowercase paragraph opener.
- Did not mutate tags, create backup artifacts, create an offline mirror, run
  `git filter-repo`, force-push, or clean branches.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`
- `rg -n "later report-only audit tickets|latest clean checks|freshness evidence" ...`

## 8. Passing test output summary

- Completion audit regression: `14 pass`, `0 fail`, `138 expect() calls`.
- Docs validation: exit 0; agent-contract reported `401 tickets` and `7
  required docs`; architecture docs and sync-v2 design validators passed.
- Rebrand validation: exit 0; no forbidden tokens outside the allowlist.
- `git diff --check`: exit 0 with no output.
- Stale-wording scan finds only regression-test negative assertions for the
  rejected phrases.

## 9. Build output summary

No build expected for this documentation/test-only cleanup.

## 10. Remaining risks

R.11 remains blocked on hard prerequisites. This ticket does not authorize
tag mutation, backup creation, mirror creation, `git filter-repo`,
force-push, or branch cleanup.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED assertion fails on lowercase paragraph opener | Green | Initial target run failed on missing capitalized sentence |
| Snapshot report uses capitalized prose | Green | Report now starts the sentence with `Later` |
| Targeted test and validators pass | Green | Targeted test, docs validation, rebrand validation, diff check, and stale-wording scan passed |
| No destructive R.11 action is performed | Green | No tag mutation, backup creation, mirror creation, filter-repo, force-push, or branch cleanup was run |
