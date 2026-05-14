# T386 - R.11 preflight backup branch check

Status: DONE
Phase: R.11 preflight hardening
Ticket: docs/tickets/T386-r11-preflight-backup-branch-check.md

## 1. Task summary

Make the explicit R.11 pre-rewrite preflight require the mandatory backup
branch before any `git filter-repo` invocation.

## 2. Repo context discovered

The R.11 runbook's backup procedure requires three backup artifacts before
filter-repo:

- backup tag: `pre-rebrand-history-rewrite-backup`;
- backup branch: `backup/pre-rebrand-history-rewrite-2026-05-13`;
- offline mirror: `/tmp/rox-one-terminal-backup-2026-05-13.git`.

Before this ticket, `bun run rebrand:r11-preflight --stage pre-rewrite`
checked the backup tag and offline mirror but not the backup branch.

## 3. Files inspected

- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`

## 4. Tests added first

Added pre-rewrite evaluator coverage proving:

- default pre-backup does not require the backup branch;
- pre-rewrite reports a distinct `backup-branch` row;
- pre-rewrite fails when only the backup branch is missing.

## 5. Expected failing test output

Initial RED run:

```text
Matcher error: received value must be a non-null object
(fail) evaluateR11Preflight > pre-rewrite stage requires backup artifacts before filter-repo

Expected: false
Received: true
(fail) evaluateR11Preflight > pre-rewrite stage requires the backup branch before filter-repo
```

The failure confirmed the evaluator ignored `backupBranchPresent`.

## 6. Implementation changes

- Added `backupBranchPresent` to `R11PreflightSnapshot`.
- Added a distinct pre-rewrite `backup-branch` result row.
- Collected the live value with
  `git ls-remote --heads origin backup/pre-rebrand-history-rewrite-2026-05-13`.
- Kept backup branch out of the default pre-backup stage.
- Did not create backup refs, mirrors, rewritten history, or force-pushed refs.
- Did not call `update_goal`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run typecheck`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Targeted test after implementation:

```text
9 pass
0 fail
27 expect() calls
Ran 9 tests across 1 file.
```

Typecheck:

```text
bun run typecheck:shared
```

exited 0.

Documentation validation:

```text
[agent-contract] ok: 11 skills, 351 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /home/dev/craft/rox-one-terminal/docs/architecture/sync-v2-design.md
```

Rebrand validation:

```text
rebrand validation passed: no forbidden tokens outside the allowlist
```

Whitespace validation:

```text
git diff --check
```

exited 0 with no output.

## 9. Build output summary

No build was run. This changes the report-only preflight script and test, not
product runtime behavior.

## 10. Remaining risks

R.11 remains blocked. Backup creation, `git filter-repo`, force-push,
post-rewrite validation, and `update_goal` remain unexecuted.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Regression test fails before implementation | Green | RED run showed missing `backup-branch` row and false green |
| Regression test passes after implementation | Green | Targeted test reports 9 pass, 0 fail |
| Pre-rewrite preflight has a distinct backup branch row | Green | `backup-branch` row added and tested |
| Default pre-backup preflight still does not require backup artifacts | Green | Unit test asserts no `backup-tag`, `backup-branch`, or `offline-mirror` row in pre-backup |
| Documentation/rebrand validation remains green | Green | `typecheck`, `validate:docs`, `validate:rebrand`, and `git diff --check` passed |
| Destructive R.11 actions are not executed | Green | No backup, mirror, filter-repo, force-push, or update_goal action was run |
| Commit created | Green | Local Lore commit created for this ticket |
