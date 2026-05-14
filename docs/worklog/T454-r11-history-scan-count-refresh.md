# T454 - R.11 history scan count refresh

Status: DONE
Phase: R.11 report-only inventory hygiene
Ticket: docs/tickets/T454-r11-history-scan-count-refresh.md

## 1. Task summary

Refresh the R.11 history-scan report-only snapshot after fresh post-push
evidence showed the unbounded runner now reports 81 forbidden-token patch
lines.

## 2. Repo context discovered

The completion audit and `docs/release/r11-history-scan-inventory-2026-05-14.md`
still record a bounded cutoff count of 9, while `bun run
rebrand:r11-history-scan` now exits red with 81 findings.

## 3. Files inspected

- `docs/release/r11-completion-audit-2026-05-14.md`
- `docs/release/r11-history-scan-inventory-2026-05-14.md`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`

## 4. Tests added first

Updated `scripts/__tests__/rebrand-r11-completion-audit.test.ts` so the
history-scan blocker test requires the completion audit to record
`81 forbidden-token patch lines`, and requires the history-scan inventory to
record `Matches observed in unbounded scan: 81` with 8 representative
sanitized findings.

## 5. Expected failing test output

Before refreshing the audit and inventory, the targeted test failed because
the completion audit still recorded the stale bounded count:

```text
Expected to contain: "81 forbidden-token patch lines"
Received: "... `9 forbidden-token patch lines` ..."

(fail) R.11 completion audit > records the current history-scan finding count
```

## 6. Implementation changes

- Updated `docs/release/r11-completion-audit-2026-05-14.md` so the current
  blocker section cites the unbounded `bun run rebrand:r11-history-scan`
  command and its 81-finding red result.
- Updated `docs/release/r11-history-scan-inventory-2026-05-14.md` so the
  summary records the unbounded count while keeping only a bounded sanitized
  representative finding list.

## 7. Validation commands run

- `bun run rebrand:r11-history-scan`
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## 8. Passing test output summary

- `bun run rebrand:r11-history-scan`: exits red as expected for the blocker,
  reporting 81 forbidden-token patch lines outside the legal-preserve
  allowlist.
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`: 19 pass,
  0 fail, 177 expect calls.
- `bun run validate:docs`: green; agent contract reports 419 tickets and
  7 required docs.
- `bun run validate:rebrand`: green; no forbidden tokens outside the allowlist.
- `bun run validate:roadmap`: green; reports 46 phases, 110 tickets across
  detail files, and 14 rebrand master-roadmap log rows.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 7 existing warnings and 0 errors.
- `git diff --check`: exit 0.

## 9. Build output summary

No build expected for this report-only inventory/test change.

## 10. Remaining risks

R.11 remains blocked by active goal state, fork count, tag mismatch/off-main
target, missing backup artifacts, missing offline mirror, remote branch review,
legal-preserve checks blocked by the missing backup tag, and the red history
scan. This ticket does not authorize tag mutation, backup creation,
`git filter-repo`, force-push, branch cleanup, fork-owner contact, or changing
the legal-preserve allowlist.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED assertion fails because the audit/inventory still record the stale history-scan count | PASS | Targeted test failed on missing `81 forbidden-token patch lines` before docs refresh |
| Completion audit records 81 forbidden-token patch lines for `history-scan` | PASS | Current blockers section now cites 81 findings from `bun run rebrand:r11-history-scan` |
| History-scan inventory records the unbounded count of 81 | PASS | Inventory summary says `Matches observed in unbounded scan: 81` |
| History-scan inventory keeps listed findings sanitized and bounded | PASS | Inventory lists 8 representative sanitized findings and omits raw token/line text |
| Targeted test and validators pass | PASS | Targeted test, docs/rebrand/roadmap validators, typecheck, lint, and diff-check passed |
| No destructive R.11 action is performed | PASS | No tag mutation, backup creation, mirror creation, filter-repo, force-push, branch cleanup, fork-owner contact, or allowlist change commands were run |
