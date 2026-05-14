# R.11 Current Main Validation - 2026-05-14

Status: PRE-REWRITE VALIDATION ONLY

Captured full-matrix snapshot: this report records validation for the current `main`
branch before any R.11 history rewrite. It does not satisfy the final
post-rewrite validation requirement in the rebrand-sweep goal, and it is not a live ticket-count source for later audit-hygiene tickets.

Later report-only audit tickets must record their own fresh validation evidence in their worklogs.

Validated state:

- Branch state: `main` synced with `origin/main` before T429 edits; validation
  ran with only T429 report, ticket, worklog, and audit-test edits pending.
- R.11 state: blocked; no backup refs, backup branches, offline mirrors,
  rewritten history, force-pushes, or tag mutations were created.

## Command Results

| Command | Result | Evidence |
| --- | --- | --- |
| `bun run typecheck` | Pass | Exit 0. |
| `bun run lint` | Pass with warnings | Exit 0 with 7 existing warnings. |
| `bun test` | Pass | Exit 0; 6753 pass, 13 skip, 0 fail, 1 snapshot, 26839 expect() calls, across 6766 tests in 562 files. |
| `bun run build` | Pass with warnings | Exit 0 with existing Vite dynamic-import and chunk-size warnings. |
| `bun run validate:docs` | Pass | Exit 0; agent-contract reported 394 tickets at capture time and 7 required docs. |
| `bun run validate:rebrand` | Pass | Exit 0; no forbidden tokens outside the allowlist. |
| `git diff --check` | Pass | Exit 0; no whitespace errors. |

## Lint Warning Summary

- `apps/electron/src/main/deep-link.ts`: unused `eslint-disable`.
- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`:
  missing React hook dependency.
- `freeform-input.emphasis.rtl.test.tsx`: React hook dependency warning.
- `freeform-input.history.rtl.test.tsx`: React hook dependency warning.
- `apps/electron/src/renderer/pages/__tests__/ChatPage.rtl.test.tsx`: unused
  `eslint-disable`.
- `apps/electron/src/renderer/pages/settings/settings-pages.ts`: two unused
  `eslint-disable` warnings.

## Post-Rewrite Caveat

The R.11 goal requires typecheck, lint, full test, build, docs validation, and
rebrand validation after the destructive history rewrite has produced rewritten
ancestry. This report is useful captured snapshot evidence for current `main`,
but it is not completion evidence for R.11.

## T470 Fresh Current-Main Validation Refresh

Refreshed commit: `02275b9b`

Refresh state:

- Branch state: `main` included T471/T472 validation repairs through
  `02275b9b` before T470 report edits.
- R.11 state: blocked; no backup refs, backup branches, offline mirrors,
  rewritten history, force-pushes, or tag mutations were created by T470.
- No backup refs, backup branches, offline mirrors, rewritten history, force-pushes, or tag mutations were created by T470.
- Dependency bootstrap: `bun install --frozen-lockfile` restored the missing
  local toolchain; `bun.lock` was not changed.
- This still does not satisfy the final post-rewrite validation requirement.

## T470 Command Results

| Command | Result | Evidence |
| --- | --- | --- |
| `bun install --frozen-lockfile` | Pass | Exit 0; 1638 packages installed. |
| `bun run typecheck` | Pass | Exit 0. |
| `bun run lint` | Pass with warnings | Exit 0 with 7 existing warnings. |
| `bun test` | Pass | Exit 0; 6910 pass, 13 skip, 0 fail, 1 snapshot, 27371 expect() calls, across 6923 tests in 566 files. |
| `bun run build` | Pass with warnings | Exit 0 with existing Vite dynamic-import, circular chunk, and chunk-size warnings. |
| `bun run validate:docs` | Pass | Exit 0; agent-contract reported 439 tickets at refresh time and 7 required docs. |
| `bun run validate:rebrand` | Pass | Exit 0; no forbidden tokens outside the allowlist. |
| `bun run validate:roadmap` | Pass | Exit 0; 46 phases, 110 tickets across detail files, 14 rebrand master-roadmap log rows. |
| `git diff --check` | Pass | Exit 0; no whitespace errors. |
