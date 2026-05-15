# T497 - R.11 worktree clean runtime state

Status: DONE
Phase: R.11 local worktree cleanup
Ticket: docs/tickets/T497-r11-worktree-clean-runtime-state.md

## 1. Task summary

Clear the tracked OMC runtime-state diff that blocked the R.11
`worktree-clean` row after PR #229 merged.

## 2. Repo context discovered

Local `main` and `origin/main` were synchronized at
`e565bf7da80f2e56b29867c6d9b4e7a57a5975e4`. The only dirty file was
`.omc/state/last-tool-error.json`, and its diff recorded an older local Bash
failure unrelated to source, release documentation, or R.11 artifacts.

Before cleanup, acknowledged R.11 preflight failed on `rebrand-tag-on-main`,
`current-branch`, and `worktree-clean`. After restoring only the OMC
runtime-state file, the same preflight failed only on `rebrand-tag-on-main` and
`current-branch` while the report branch was checked out.

## 3. Files inspected

- `AGENTS.md`
- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `.omc/state/last-tool-error.json`
- `docs/release/r11-completion-audit-2026-05-15.md`
- `docs/release/r11-post-228-blocker-refresh-2026-05-16.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `scripts/rebrand-r11-preflight.ts`

## 4. Tests added first

No code test was added for this local runtime-state cleanup. The RED checks
were:

```bash
test ! -f docs/tickets/T497-r11-worktree-clean-runtime-state.md
test ! -f docs/worklog/T497-r11-worktree-clean-runtime-state.md
test ! -f docs/release/r11-worktree-clean-runtime-state-2026-05-16.md
rg -q "Worktree Clean Runtime State" docs/release/r11-completion-audit-2026-05-15.md
ROX_R11_NO_ACTIVE_GOAL=1 ROX_R11_EXPECTED_FORKS=2 bun run rebrand:r11-preflight
```

The three absence checks exited 0. The audit phrase check exited 1. The
pre-cleanup preflight exited red with `worktree-clean` failing.

## 5. Expected failing test output

The intended RED signals were:

```text
audit_section_present=1
worktree-clean fail git status --porcelain is not empty.
```

## 6. Implementation changes

- Restored `.omc/state/last-tool-error.json` to `HEAD`.
- Added `docs/tickets/T497-r11-worktree-clean-runtime-state.md`.
- Added `docs/worklog/T497-r11-worktree-clean-runtime-state.md`.
- Added `docs/release/r11-worktree-clean-runtime-state-2026-05-16.md`.
- Updated `docs/release/r11-completion-audit-2026-05-15.md` with the T497
  cleanup result.
- Updated `docs/worklog/T298-rebrand-git-history-rewrite.md` with a T497
  anchor and remaining blocker state.
- Did not mutate refs, tags, branches, mirrors, history, force-pushed refs, or
  `/goal` state.

## 7. Validation commands run

- `test ! -f docs/tickets/T497-r11-worktree-clean-runtime-state.md`
- `test ! -f docs/worklog/T497-r11-worktree-clean-runtime-state.md`
- `test ! -f docs/release/r11-worktree-clean-runtime-state-2026-05-16.md`
- `rg -q "Worktree Clean Runtime State" docs/release/r11-completion-audit-2026-05-15.md`
  (RED before implementation)
- `ROX_R11_NO_ACTIVE_GOAL=1 ROX_R11_EXPECTED_FORKS=2 bun run rebrand:r11-preflight`
  before cleanup
- `git restore -- .omc/state/last-tool-error.json`
- `git status --short --branch`
- `ROX_R11_NO_ACTIVE_GOAL=1 ROX_R11_EXPECTED_FORKS=2 bun run rebrand:r11-preflight`
  after cleanup
- `ROX_R11_NO_ACTIVE_GOAL=1 ROX_R11_EXPECTED_FORKS=2 bun run rebrand:r11-preflight --stage pre-rewrite`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `git diff --check`

## 8. Passing test output summary

Pre-cleanup acknowledged preflight:

```text
rebrand-tag-on-main fail
current-branch fail
worktree-clean fail
red - 3 R.11 pre-backup prerequisite(s) failing
```

Post-cleanup acknowledged preflight before docs edits:

```text
rebrand-tag-on-main fail
current-branch fail
worktree-clean pass
red - 2 R.11 pre-backup prerequisite(s) failing
```

Targeted validation for the docs commit:

```text
bun run validate:docs
[agent-contract] ok: 11 skills, 464 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md

bun run validate:rebrand
rebrand validation passed: no forbidden tokens outside the allowlist

bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts
30 pass, 0 fail, 337 expect() calls

git diff --check
exit 0
```

## 9. Build output summary

No build is required for this report-only local cleanup and documentation
update.

## 10. Remaining risks

R.11 remains blocked by `rebrand-tag-on-main` even after local worktree cleanup.
The subsequent backup, pre-rewrite, legal-preserve, history-scan, force-push,
and post-rewrite validation gates remain unavailable until that ref-policy
blocker is resolved on clean `main`.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED checks prove the ticket, worklog, snapshot, and audit section were absent | PASS | T497 files absent; audit phrase check exited 1 |
| Pre-cleanup preflight records `worktree-clean` red | PASS | Acknowledged preflight reported `worktree-clean fail` |
| Only `.omc/state/last-tool-error.json` is restored | PASS | `git restore -- .omc/state/last-tool-error.json`; no other file changed by cleanup |
| Post-cleanup preflight records `worktree-clean` green | PASS | Acknowledged preflight reported `worktree-clean pass` before docs edits |
| Remaining pre-backup blockers are limited to `rebrand-tag-on-main` plus `current-branch` while this report branch is checked out | PASS | Post-cleanup acknowledged preflight reported two blockers |
| Validators pass | PASS | `validate:docs`, `validate:rebrand`, audit test, and `git diff --check` passed |
| No destructive R.11 action is performed | PASS | No tag, branch, backup, mirror, history, force-push, or goal-state mutation |
