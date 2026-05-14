# T429 - R.11 current main validation refresh

Status: DONE
Phase: R.11 completion audit hygiene
Ticket: docs/tickets/T429-r11-current-main-validation-refresh.md

## 1. Task summary

Refresh the R.11 current-main validation evidence in a durable report.

## 2. Repo context discovered

R.11 remains blocked by hard prerequisites. The current-main validation section
in `docs/release/r11-completion-audit-2026-05-14.md` still records older
pre-rewrite validation counts from before the latest report-only audit
hardening commits.

## 3. Files inspected

- `docs/release/r11-completion-audit-2026-05-14.md`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`

## 4. Tests added first

Update the existing completion-audit assertion so it requires a durable
current-main validation report path and keeps the post-rewrite validation
disclaimer.

## 5. Expected failing test output

`bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` failed for
the intended reason before the report existed:

- `ENOENT: no such file or directory`
- Missing path:
  `docs/release/r11-current-main-validation-2026-05-14.md`
- Summary: `10 pass`, `1 fail`, `100 expect() calls`

## 6. Implementation changes

- Added `docs/release/r11-current-main-validation-2026-05-14.md` with fresh
  current-main validation evidence.
- Updated `docs/release/r11-completion-audit-2026-05-14.md` so the Current
  Main Validation Matrix points to the durable report instead of carrying stale
  inline counts.
- Extended `scripts/__tests__/rebrand-r11-completion-audit.test.ts` to require
  the durable report, the pre-rewrite-only status, and the fresh validation
  counts.
- No refs, tags, branches, backups, offline mirrors, history rewrites,
  force-pushes, runtime source files, or production dependencies were changed.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` (RED)
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts` (GREEN)
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

- Targeted audit regression: `11 pass`, `0 fail`, `111 expect() calls`.
- Typecheck: exit 0.
- Lint: exit 0 with 7 existing warnings.
- Full suite: exit 0; `6753 pass`, `13 skip`, `0 fail`, `1 snapshot`,
  `26839 expect() calls`, across `6766 tests` in `562 files`.
- Docs validation: exit 0; agent-contract reported 394 tickets and 7 required
  docs.
- Rebrand validation: exit 0.
- Whitespace check: exit 0.

## 9. Build output summary

`bun run build` exited 0. The output retained existing Vite dynamic-import
warnings for `@shikijs/langs` and `@shikijs/themes`, plus existing chunk-size
warnings.

## 10. Remaining risks

R.11 remains blocked by active goal state, tag drift, off-main tag target,
missing backup artifacts, unreviewed remote branch set, missing legal-preserve
backup tag, and historical forbidden-token patch lines.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED completion-audit assertion proves the current-main validation report is absent | Green | RED targeted test failed on missing report path |
| Current-main validation report records fresh command results | Green | Report records typecheck, lint, full test, build, docs, rebrand, and whitespace evidence |
| Completion audit links to the report and keeps post-rewrite validation blocked | Green | Audit links `docs/release/r11-current-main-validation-2026-05-14.md` and keeps the post-rewrite disclaimer |
| Targeted and full validation commands produce the expected results | Green | Targeted regression, typecheck, lint, full suite, build, docs validation, rebrand validation, and diff check ran |
