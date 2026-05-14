# T446 - R.11 preflight backup target guard

Status: DONE
Phase: R.11 report-only safety guard
Ticket: docs/tickets/T446-r11-preflight-backup-target-guard.md

## 1. Task summary

Add report-only pre-rewrite checks that fail closed when R.11 backup refs exist
but do not point at the current `main` commit.

## 2. Repo context discovered

`scripts/rebrand-r11-preflight.ts` already requires the R.11 backup tag and
backup branch before the pre-rewrite stage. It does not yet verify that those
refs point at the same commit as `main`, so a stale or wrong backup ref could
pass the presence-only gate.

## 3. Files inspected

- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `docs/tickets/T444-r11-preflight-current-branch-guard.md`
- `docs/worklog/T444-r11-preflight-current-branch-guard.md`
- `docs/tickets/T445-r11-completion-audit-current-branch-guard.md`
- `docs/worklog/T445-r11-completion-audit-current-branch-guard.md`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-r11-preflight.test.ts` with:

- `pre-rewrite stage fails when the backup tag target differs from main`
- `pre-rewrite stage fails when the backup branch target differs from main`
- assertions that the default pre-backup stage does not emit backup target rows
- assertions that missing backup artifacts are not double-counted as target
  mismatches
- `documents backup target checks enforced by the pre-rewrite gate`

## 5. Expected failing test output

Before implementation, the targeted preflight tests failed because the
evaluator ignored mismatched backup targets:

```text
Expected: false
Received: true

(fail) evaluateR11Preflight > pre-rewrite stage fails when the backup tag target differs from main
(fail) evaluateR11Preflight > pre-rewrite stage fails when the backup branch target differs from main

26 pass
2 fail
124 expect() calls
```

After the preflight implementation, the runbook documentation assertion failed
until the R.11 goal text named the `backup-tag-target` and
`backup-branch-target` rows:

```text
Expected to contain: "backup tag and backup branch targets must match `main`"

(fail) R.11 goal documentation > documents backup target checks enforced by the pre-rewrite gate
```

## 6. Implementation changes

- Added `mainCommit`, `backupTagCommit`, `backupTagMatchesMain`,
  `backupBranchCommit`, and `backupBranchMatchesMain` to the R.11 preflight
  snapshot.
- Added pre-rewrite report rows `backup-tag-target` and
  `backup-branch-target` when the corresponding backup ref exists.
- Kept missing backup artifacts as presence failures only, so missing refs are
  not double-counted as target mismatches.
- Collected the local `main` commit with `git rev-parse --verify
  main^{commit}`.
- Collected the remote backup tag peeled commit from
  `refs/tags/pre-rebrand-history-rewrite-backup^{}` with a non-peeled fallback.
- Parsed the remote backup branch commit from `git ls-remote --heads origin
  backup/pre-rebrand-history-rewrite-2026-05-13`.
- Updated the R.11 goal/runbook to state that backup tag and backup branch
  targets must match `main` before `git filter-repo`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`: 29 pass,
  0 fail, 131 expect calls.
- `bun run validate:docs`: green; agent contract reports 411 tickets and
  7 required docs.
- `bun run validate:rebrand`: green; no forbidden tokens outside the allowlist.
- `bun run validate:roadmap`: green; reports 46 phases, 110 tickets across
  detail files, and 14 rebrand master-roadmap log rows.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 7 existing warnings and 0 errors.
- `git diff --check`: exit 0.

## 9. Build output summary

No build expected for this report-only script/test change unless validation
surfaces a runtime packaging issue.

## 10. Remaining risks

R.11 remains blocked on hard prerequisites. This ticket does not authorize tag
mutation, backup creation, mirror creation, `git filter-repo`, force-push, or
branch cleanup.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED tests fail because backup target rows do not exist yet | PASS | Targeted test failed with `Expected: false`, `Received: true` for tag and branch target mismatches |
| Default pre-backup preflight does not require backup target rows | PASS | Targeted test asserts no `backup-tag-target` or `backup-branch-target` rows in pre-backup mode |
| Pre-rewrite preflight fails when a backup tag target differs from `main` | PASS | Targeted test covers mismatched `backupTagCommit` and requires a failing `backup-tag-target` row |
| Pre-rewrite preflight fails when a backup branch target differs from `main` | PASS | Targeted test covers mismatched `backupBranchCommit` and requires a failing `backup-branch-target` row |
| Missing backup artifacts are not double-counted as target mismatches | PASS | Pre-rewrite missing-artifact test asserts no target rows are emitted when refs are absent |
| R.11 runbook documents the backup target rows | PASS | Goal documentation test requires `backup-tag-target`, `backup-branch-target`, and the `main` target requirement |
| Targeted test and validators pass | PASS | Targeted test, docs/rebrand/roadmap validators, typecheck, lint, and diff-check passed |
| No destructive R.11 action is performed | PASS | No tag mutation, backup creation, mirror creation, filter-repo, force-push, or branch cleanup commands were run |
