# T386 - R.11 preflight backup branch check

Status: DONE

## Context

The R.11 backup procedure requires a parallel backup branch:
`backup/pre-rebrand-history-rewrite-2026-05-13`. The explicit pre-rewrite
preflight currently checks the backup tag and offline mirror, but not the
backup branch.

## Goal

Make `bun run rebrand:r11-preflight --stage pre-rewrite` fail closed unless the
mandatory R.11 backup branch is visible on `origin`.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Update `scripts/rebrand-r11-preflight.ts` and its test so the report-only
pre-rewrite gate checks the backup branch.

## Required Subagents

None.

## TDD Requirements

Add the failing evaluator test first. Confirm it fails because the current
pre-rewrite evaluator ignores `backupBranchPresent`.

## Implementation Requirements

- Add a `backupBranchPresent` prerequisite to the R.11 preflight snapshot.
- Report it as its own pre-rewrite row.
- Collect it from `origin/backup/pre-rebrand-history-rewrite-2026-05-13`.
- Keep the check out of the default pre-backup stage so backup artifacts can be
  created only after the pre-backup gate clears.
- Keep the preflight report-only; do not create refs, mirrors, rewritten
  history, or force-pushed refs.
- Do not call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run typecheck`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] Regression test fails before implementation.
- [x] Regression test passes after implementation.
- [x] Pre-rewrite preflight has a distinct backup branch row.
- [x] Default pre-backup preflight still does not require backup artifacts.
- [x] Documentation/rebrand validation remains green.
- [x] Destructive R.11 actions are not executed.
- [x] Commit created.

## Worklog

See `docs/worklog/T386-r11-preflight-backup-branch-check.md`.
