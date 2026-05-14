# T435 - R.11 current-main freshness wording cleanup

Status: DONE
Phase: R.11 report-only audit hygiene
Ticket: docs/tickets/T435-r11-current-main-freshness-wording.md

## 1. Task summary

Remove the remaining "freshness evidence" phrasing from the T429 current-main
validation snapshot so the report consistently reads as captured evidence.

## 2. Repo context discovered

After T434, a stale-wording scan found
`docs/release/r11-current-main-validation-2026-05-14.md` still says the report
is "useful freshness evidence" in the post-rewrite caveat. That conflicts with
the new snapshot contract.

## 3. Files inspected

- `docs/release/r11-current-main-validation-2026-05-14.md`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `docs/release/r11-completion-audit-2026-05-14.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`

## 4. Tests added first

- `scripts/__tests__/rebrand-r11-completion-audit.test.ts` now requires the
  current-main validation report to contain `useful captured snapshot evidence`
  and reject `freshness evidence`.

## 5. Expected failing test output

The RED run failed for the intended missing replacement wording:

```text
Expected to contain: "useful captured snapshot evidence"
Received: "... This report is useful freshness evidence for current `main` ..."
```

## 6. Implementation changes

- Updated `docs/release/r11-current-main-validation-2026-05-14.md` so the
  post-rewrite caveat calls the T429 report useful captured snapshot evidence,
  not freshness evidence.
- Extended `scripts/__tests__/rebrand-r11-completion-audit.test.ts` to enforce
  the replacement wording and reject the stale phrase in the live report.
- Did not mutate tags, create backup artifacts, create an offline mirror, run
  `git filter-repo`, force-push, or clean remote branches.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`
- `rg -n "latest pre-rewrite current-main validation|latest clean checks|freshness evidence|agent-contract reported 398 tickets|agent-contract reported 399 tickets" ...`

## 8. Passing test output summary

- Completion audit regression: `14 pass`, `0 fail`, `137 expect() calls`.
- Docs validation: exit 0; agent-contract reported `400 tickets` and `7
  required docs`; architecture docs and sync-v2 design validators passed.
- Rebrand validation: exit 0; no forbidden tokens outside the allowlist.
- `git diff --check`: exit 0 with no output.
- Stale-wording scan found no live release-report hit for `freshness evidence`;
  remaining hits are historical worklog/test references to the removed phrase.

## 9. Build output summary

No build expected for this documentation/test-only wording cleanup.

## 10. Remaining risks

R.11 remains blocked on hard prerequisites. This ticket does not authorize
tag mutation, backup creation, mirror creation, `git filter-repo`,
force-push, or branch cleanup.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED assertion fails on stale freshness wording | Green | Initial target run failed on missing `useful captured snapshot evidence` while the stale phrase was still present |
| Current-main report removes freshness wording | Green | Report now says `useful captured snapshot evidence` |
| Targeted test and docs validators pass | Green | Targeted test, docs validation, rebrand validation, and diff check passed |
| No destructive R.11 action is performed | Green | No tag mutation, backup creation, mirror creation, filter-repo, force-push, or branch cleanup was run |
