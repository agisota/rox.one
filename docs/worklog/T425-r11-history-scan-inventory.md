# T425 - R.11 history scan inventory

Status: DONE
Phase: R.11 completion audit hygiene
Ticket: docs/tickets/T425-r11-history-scan-inventory.md

## 1. Task summary

Create a sanitized, report-only history-scan inventory for the R.11 blocker.

## 2. Repo context discovered

R.11 remains blocked by hard prerequisites. The completion audit records that
the bounded history scan exits red with 9 matches observed at the cutoff, but it
does not preserve a durable sanitized finding inventory.

The history-scan runner scans `git log -p --all` and stops after the configured
maximum plus one observed match. Raw token and line text must not be copied into
new docs because that would create new historical patch-line findings.

## 3. Files inspected

- `docs/release/r11-completion-audit-2026-05-14.md`
- `docs/release/r11-history-scan-inventory-2026-05-14.md`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `scripts/rebrand-r11-history-scan.ts`
- `scripts/validate-rebrand.cjs`

## 4. Tests added first

Update the existing completion-audit assertion so it requires a durable
history-scan report path plus sanitized count and finding evidence.

## 5. Expected failing test output

The RED run failed for the expected reason: the history-scan inventory file did
not exist.

```text
error: ENOENT: no such file or directory, open
'/home/dev/craft/rox-one-terminal/docs/release/r11-history-scan-inventory-2026-05-14.md'

(fail) R.11 completion audit > records the current history-scan finding count

 9 pass
 1 fail
```

## 6. Implementation changes

- Added `docs/release/r11-history-scan-inventory-2026-05-14.md`.
- Recorded the bounded history-scan command, red status, 9 matches observed at
  the cutoff, and 8 listed sanitized findings.
- Preserved commit and path evidence while omitting raw token and line text.
- Added a pointer from the R.11 completion audit to the sanitized report.
- Did not mutate refs, tags, branches, backups, mirrors, or history.

## 7. Validation commands run

- `REBRAND_R11_HISTORY_MAX_FINDINGS=8 bun run rebrand:r11-history-scan`
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` (RED)
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` (GREEN)
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`: 10 pass,
  0 fail, 84 expect calls.
- `REBRAND_R11_HISTORY_MAX_FINDINGS=8 bun run rebrand:r11-history-scan`:
  expected red blocker remains, with 9 matches observed at the cutoff and 8
  listed findings.
- `bun run validate:docs`: agent-contract, architecture-docs, and sync-v2
  design validation passed.
- `bun run validate:rebrand`: rebrand validation passed with no forbidden
  tokens outside the allowlist.
- `git diff --check`: no whitespace errors.

## 9. Build output summary

No build expected for this documentation/test hardening ticket.

## 10. Remaining risks

R.11 remains blocked by active goal state, tag drift, off-main tag target,
missing backup artifacts, unreviewed remote branch set, missing legal-preserve
backup tag, and historical forbidden-token patch lines.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED completion-audit assertion proves the history-scan inventory is absent | Green | RED run failed on missing `docs/release/r11-history-scan-inventory-2026-05-14.md` |
| History-scan report records 9 matches observed at the cutoff and 8 listed sanitized findings | Green | `docs/release/r11-history-scan-inventory-2026-05-14.md` summary |
| History-scan report preserves commit/path evidence without raw legacy-token strings | Green | Report stores commit/path evidence and explicitly omits raw token and line text |
| Targeted, history-scan, and documentation validation commands produce the expected results | Green | 10 pass targeted test; expected red history scan; docs/rebrand validators green; `git diff --check` green |
