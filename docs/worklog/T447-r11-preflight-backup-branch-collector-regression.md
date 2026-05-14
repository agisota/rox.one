# T447 - R.11 preflight backup branch collector regression

Status: DONE
Phase: R.11 report-only safety guard
Ticket: docs/tickets/T447-r11-preflight-backup-branch-collector-regression.md

## 1. Task summary

Fix the T446 regression where `bun run rebrand:r11-preflight` crashes while
collecting the backup branch commit.

## 2. Repo context discovered

T446 added backup target checks and passed the pure evaluator tests, but the
post-commit command crashed in `collectR11PreflightSnapshot()`. The failing
line calls `parseFirstLsRemoteCommit(remoteBackupBranch.stdout)` even though
`remoteBackupBranch` is already the stdout string from `git ls-remote --heads`.

## 3. Files inspected

- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `docs/tickets/T446-r11-preflight-backup-target-guard.md`
- `docs/worklog/T446-r11-preflight-backup-target-guard.md`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-r11-preflight.test.ts` with
`collects backup branch commit evidence without crashing`. The test calls
`collectR11PreflightSnapshot(repoRoot)` and asserts the backup branch presence
flag and optional commit field have the expected runtime shape.

## 5. Expected failing test output

Before the fix, the collector regression test failed with the same TypeError
seen in the post-T446 preflight run:

```text
TypeError: undefined is not an object (evaluating 'stdout.split')
      at parseFirstLsRemoteCommit
      at collectR11PreflightSnapshot
      at scripts/__tests__/rebrand-r11-preflight.test.ts:328:22

(fail) collectR11PreflightSnapshot > collects backup branch commit evidence without crashing
```

The test also hit Bun's default 5s timeout because the collector performs real
GitHub and Git reads; the regression test timeout was raised to 15 seconds.

## 6. Implementation changes

- Fixed backup branch commit parsing by passing the already-collected
  `remoteBackupBranch` stdout string to `parseFirstLsRemoteCommit()`.
- Kept the T446 target guard logic unchanged.
- Kept the script report-only; no refs, tags, mirrors, or history were
  modified.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run rebrand:r11-preflight || true`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite || true`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`: 30 pass,
  0 fail, 133 expect calls.
- `bun run rebrand:r11-preflight || true`: prints a red report instead of
  crashing. In the dirty pre-commit worktree it reports 5 blockers:
  `no-active-goal`, `fork-review`, `rebrand-tag-local-sync`,
  `rebrand-tag-on-main`, and `worktree-clean`.
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite
  || true`: prints a red report instead of crashing. In the dirty pre-commit
  worktree it reports 8 blockers: `fork-review`, `rebrand-tag-local-sync`,
  `rebrand-tag-on-main`, `backup-tag`, `backup-branch`, `offline-mirror`,
  `remote-branch-review`, and `worktree-clean`.
- `bun run validate:docs`: green; agent contract reports 412 tickets and
  7 required docs.
- `bun run validate:rebrand`: green; no forbidden tokens outside the allowlist.
- `bun run validate:roadmap`: green; reports 46 phases, 110 tickets across
  detail files, and 14 rebrand master-roadmap log rows.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 7 existing warnings and 0 errors.
- `git diff --check`: exit 0.

## 9. Build output summary

No build expected for this report-only script/test fix.

## 10. Remaining risks

R.11 remains blocked on hard prerequisites. This ticket does not authorize tag
mutation, backup creation, mirror creation, `git filter-repo`, force-push, or
branch cleanup.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED collector test fails with the current `TypeError` | PASS | Targeted test failed at `parseFirstLsRemoteCommit` with `stdout.split` on undefined |
| Preflight collector no longer crashes | PASS | Targeted collector regression passes |
| Default preflight prints a red report instead of crashing | PASS | Default preflight prints red blocker table; no crash |
| Pre-rewrite preflight prints a red report instead of crashing | PASS | Pre-rewrite preflight prints red blocker table; no crash |
| Targeted test and validators pass | PASS | Targeted test, docs/rebrand/roadmap validators, typecheck, lint, and diff-check passed |
| No destructive R.11 action is performed | PASS | No tag mutation, backup creation, mirror creation, filter-repo, force-push, or branch cleanup commands were run |
