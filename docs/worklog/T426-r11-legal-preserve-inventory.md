# T426 - R.11 legal preserve inventory

Status: DONE
Phase: R.11 completion audit hygiene
Ticket: docs/tickets/T426-r11-legal-preserve-inventory.md

## 1. Task summary

Create a read-only legal-preserve inventory for the R.11 blocker.

## 2. Repo context discovered

R.11 remains blocked by hard prerequisites. The legal-preserve gate is red
because `pre-rebrand-history-rewrite-backup` is missing, so the runner cannot
compare legal attribution files against the mandatory backup ref.

Fresh legal-preserve evidence:

- `legal-file-LICENSE` fails because the backup ref object is missing.
- `legal-file-NOTICE` fails because the backup ref object is missing.
- `legal-file-TRADEMARK.md` fails because the backup ref object is missing.
- `dockerfile-source-attribution` passes.

## 3. Files inspected

- `docs/release/r11-completion-audit-2026-05-14.md`
- `docs/release/r11-legal-preserve-inventory-2026-05-14.md`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `scripts/rebrand-r11-legal-preserve.ts`

## 4. Tests added first

Update the existing completion-audit assertion so it requires a durable
legal-preserve report path plus exact failing and passing row evidence.

## 5. Expected failing test output

The RED run failed for the expected reason: the legal-preserve inventory file
did not exist.

```text
error: ENOENT: no such file or directory, open
'/home/dev/craft/rox-one-terminal/docs/release/r11-legal-preserve-inventory-2026-05-14.md'

(fail) R.11 completion audit > records exact legal-preserve gate state

 10 pass
 1 fail
```

## 6. Implementation changes

- Added `docs/release/r11-legal-preserve-inventory-2026-05-14.md`.
- Recorded the legal-preserve source command, red status, three failing
  legal-file rows, and the passing Dockerfile attribution row.
- Added a pointer from the R.11 completion audit to the legal-preserve report.
- Did not mutate refs, tags, branches, backups, mirrors, or history.

## 7. Validation commands run

- `bun run rebrand:r11-legal-preserve`
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` (RED)
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` (GREEN)
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`: 11 pass,
  0 fail, 92 expect calls.
- `bun run rebrand:r11-legal-preserve`: expected red blocker remains with
  three failing legal-file rows and the passing Dockerfile attribution row.
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
| RED completion-audit assertion proves the legal-preserve inventory is absent | Green | RED run failed on missing `docs/release/r11-legal-preserve-inventory-2026-05-14.md` |
| Legal-preserve report records the three failing legal-file rows | Green | Report lists `legal-file-LICENSE`, `legal-file-NOTICE`, and `legal-file-TRADEMARK.md` |
| Legal-preserve report records the passing Dockerfile attribution row | Green | Report lists `dockerfile-source-attribution` as pass |
| Targeted, legal-preserve, and documentation validation commands produce the expected results | Green | 11 pass targeted test; expected red legal-preserve gate; docs/rebrand validators green; `git diff --check` green |
