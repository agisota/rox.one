# T457 - R.11 history scan checklist command refresh

Status: DONE
Phase: R.11 report-only audit hygiene
Ticket: docs/tickets/T457-r11-history-scan-checklist-command-refresh.md

## 1. Task summary

Refresh the completion audit prompt-to-artifact checklist so the history-scan
row matches the current unbounded runner evidence.

## 2. Repo context discovered

`docs/release/r11-completion-audit-2026-05-14.md` current blockers and
`docs/release/r11-history-scan-inventory-2026-05-14.md` use the unbounded
`bun run rebrand:r11-history-scan` command and 81-finding result, but the
prompt-to-artifact checklist still references the older bounded helper.

## 3. Files inspected

- `docs/release/r11-completion-audit-2026-05-14.md`
- `docs/release/r11-history-scan-inventory-2026-05-14.md`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-r11-completion-audit.test.ts` so the
prompt-to-artifact checklist's `history scan clean` row must use
`bun run rebrand:r11-history-scan`, record `81 forbidden-token patch lines`,
and omit the older `REBRAND_R11_HISTORY_MAX_FINDINGS=8` bounded helper text.

## 5. Expected failing test output

Before refreshing the audit row, the targeted test failed because the checklist
still used the stale bounded count:

```text
Expected to contain: "81 forbidden-token patch lines"
Received: "| history scan clean | `REBRAND_R11_HISTORY_MAX_FINDINGS=8 bun run rebrand:r11-history-scan` | Exits red with bounded historical findings | Blocked |"

(fail) R.11 completion audit > keeps prompt checklist history-scan command aligned with current blockers
```

## 6. Implementation changes

Updated `docs/release/r11-completion-audit-2026-05-14.md` so the
prompt-to-artifact checklist's history-scan row cites the unbounded command and
the current 81-finding red result.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`: 22 pass,
  0 fail, 210 expect calls.
- `bun run validate:docs`: green; agent contract reports 422 tickets and
  7 required docs.
- `bun run validate:rebrand`: green; no forbidden tokens outside the allowlist.
- `bun run validate:roadmap`: green; reports 46 phases, 110 tickets across
  detail files, and 14 rebrand master-roadmap log rows.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 7 existing warnings and 0 errors.
- `git diff --check`: exit 0.

## 9. Build output summary

No build expected for this report-only audit/test change.

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
| RED assertion fails because the checklist still records the stale bounded history-scan command | PASS | Targeted test failed against `REBRAND_R11_HISTORY_MAX_FINDINGS=8` row before audit refresh |
| Completion audit prompt-to-artifact checklist records `bun run rebrand:r11-history-scan` | PASS | Prompt-to-artifact checklist history-scan row now uses the unbounded command |
| Completion audit prompt-to-artifact checklist records the current 81-finding red history-scan result | PASS | Prompt-to-artifact checklist history-scan row now records 81 forbidden-token patch lines |
| Targeted test and validators pass | PASS | Targeted test, docs/rebrand/roadmap validators, typecheck, lint, and diff-check passed |
| No destructive R.11 action is performed | PASS | No goal clear, completion API, tag mutation, backup creation, mirror creation, filter-repo, force-push, branch cleanup, or fork-owner contact commands were run |
