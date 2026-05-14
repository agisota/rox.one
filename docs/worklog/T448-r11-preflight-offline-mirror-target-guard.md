# T448 - R.11 preflight offline mirror target guard

Status: DONE
Phase: R.11 report-only safety guard
Ticket: docs/tickets/T448-r11-preflight-offline-mirror-target-guard.md

## 1. Task summary

Add a report-only pre-rewrite check that fails closed when the R.11 offline
mirror exists but its `main` ref does not match the current `main` commit.

## 2. Repo context discovered

T446 added backup tag and backup branch target checks. The offline mirror still
has a presence-only pre-rewrite check, so a stale mirror could satisfy the gate
without preserving the current `main` snapshot.

## 3. Files inspected

- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/tickets/T446-r11-preflight-backup-target-guard.md`
- `docs/worklog/T446-r11-preflight-backup-target-guard.md`
- `docs/tickets/T447-r11-preflight-backup-branch-collector-regression.md`
- `docs/worklog/T447-r11-preflight-backup-branch-collector-regression.md`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-r11-preflight.test.ts` with:

- `pre-rewrite stage fails when the offline mirror main target differs from main`
- assertions that the default pre-backup stage does not emit
  `offline-mirror-target`
- assertions that a missing offline mirror is not double-counted as a target
  mismatch
- `documents offline mirror target checks enforced by the pre-rewrite gate`

## 5. Expected failing test output

Before implementation, the targeted preflight test failed because the evaluator
ignored a mismatched offline mirror `main` target:

```text
Expected: false
Received: true

(fail) evaluateR11Preflight > pre-rewrite stage fails when the offline mirror main target differs from main
```

The runbook documentation test also failed because the R.11 goal did not yet
name the `offline-mirror-target` row:

```text
Expected to contain: "offline mirror `main` target must match `main`"

(fail) R.11 goal documentation > documents offline mirror target checks enforced by the pre-rewrite gate
```

## 6. Implementation changes

- Added `offlineMirrorMainCommit` and `offlineMirrorMatchesMain` to the R.11
  preflight snapshot.
- Added a pre-rewrite `offline-mirror-target` row when the offline mirror
  exists.
- Kept missing offline mirrors as a presence failure only, so the preflight
  does not double-count a missing mirror as a target mismatch.
- Collected the mirror `main` commit with `git --git-dir
  /tmp/rox-one-terminal-backup-2026-05-13.git rev-parse --verify
  refs/heads/main^{commit}` when the mirror path exists.
- Updated the R.11 goal/runbook to state that the offline mirror `main` target
  must match `main` before `git filter-repo`.

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

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`: 32 pass,
  0 fail, 140 expect calls.
- `bun run rebrand:r11-preflight || true`: prints a red report instead of
  crashing. In the dirty pre-commit worktree it reports 5 blockers:
  `no-active-goal`, `fork-review`, `rebrand-tag-local-sync`,
  `rebrand-tag-on-main`, and `worktree-clean`.
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite
  || true`: prints a red report instead of crashing. In the dirty pre-commit
  worktree it reports 8 blockers: `fork-review`, `rebrand-tag-local-sync`,
  `rebrand-tag-on-main`, `backup-tag`, `backup-branch`, `offline-mirror`,
  `remote-branch-review`, and `worktree-clean`.
- `bun run validate:docs`: green; agent contract reports 413 tickets and
  7 required docs.
- `bun run validate:rebrand`: green; no forbidden tokens outside the allowlist.
- `bun run validate:roadmap`: green; reports 46 phases, 110 tickets across
  detail files, and 14 rebrand master-roadmap log rows.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 7 existing warnings and 0 errors.
- `git diff --check`: exit 0.

## 9. Build output summary

No build expected for this report-only script/test/doc change unless validation
surfaces a runtime packaging issue.

## 10. Remaining risks

R.11 remains blocked on hard prerequisites. This ticket does not authorize tag
mutation, backup creation, mirror creation, `git filter-repo`, force-push, or
branch cleanup.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED tests fail because `offline-mirror-target` does not exist yet | PASS | Targeted test failed with `Expected: false`, `Received: true`; runbook test failed on missing target wording |
| Default pre-backup preflight does not require offline mirror target rows | PASS | Targeted test asserts no `offline-mirror-target` row in pre-backup mode |
| Pre-rewrite preflight fails when the offline mirror `main` target differs from `main` | PASS | Targeted test covers mismatched `offlineMirrorMainCommit` and requires a failing `offline-mirror-target` row |
| Missing offline mirror is not double-counted as a target mismatch | PASS | Pre-rewrite missing-artifact test asserts no `offline-mirror-target` row when the mirror is absent |
| R.11 runbook documents the offline mirror target row | PASS | Goal documentation test requires `offline-mirror-target` and the `main` target requirement |
| Targeted test and validators pass | PASS | Targeted test, docs/rebrand/roadmap validators, typecheck, lint, and diff-check passed |
| No destructive R.11 action is performed | PASS | No tag mutation, backup creation, mirror creation, filter-repo, force-push, or branch cleanup commands were run |
