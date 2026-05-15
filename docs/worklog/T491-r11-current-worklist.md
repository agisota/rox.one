# T491 - R.11 current worklist

Status: DONE
Phase: R.11 report-only worklist refresh
Ticket: docs/tickets/T491-r11-current-worklist.md

## 1. Task summary

Add a current, single-list R.11 remaining-work section to the durable
completion audit after PR #225 merged into `main`.

## 2. Repo context discovered

PR #225 merged as `f68e748d19233b160b0983b79435d56e8e7b4249`. Local `main`
and `origin/main` are synchronized and the worktree is clean. There are no
open PRs.

R.11 remains blocked. The current default preflight is red on
`no-active-goal`, `fork-review`, and `rebrand-tag-on-main`. With the explicit
operator acknowledgements used only for report-only diagnosis, pre-backup still
fails `rebrand-tag-on-main`. Explicit pre-rewrite additionally fails
`backup-tag`, `backup-branch`, `offline-mirror`, and `remote-branch-review`.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/release/r11-completion-audit-2026-05-15.md`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `scripts/rebrand-r11-preflight.ts`
- `scripts/rebrand-r11-history-scan.ts`
- `scripts/rebrand-r11-legal-preserve.ts`

## 4. Tests added first

No code test was added. The RED checks were:

```bash
test ! -f docs/tickets/T491-r11-current-worklist.md
test ! -f docs/worklog/T491-r11-current-worklist.md
rg -q "Current Remaining Worklist" docs/release/r11-completion-audit-2026-05-15.md
```

The ticket and worklog absence checks exited 0. The audit phrase check exited
1 before implementation, proving the section was absent.

## 5. Expected failing test output

The expected failing signal was:

```text
worklist_phrase_present=1
```

from the pre-edit `rg -q` check. Exit code 1 means the current-worklist
section still needed to be written.

## 6. Implementation changes

- Added `docs/tickets/T491-r11-current-worklist.md`.
- Added this 11-section worklog.
- Updated `docs/release/r11-completion-audit-2026-05-15.md` with a
  post-PR #225 evidence snapshot and remaining-work checklist.
- Updated `docs/worklog/T298-rebrand-git-history-rewrite.md` with a T491
  anchor.
- Did not mutate refs, backup artifacts, mirrors, history, force-pushes, or
  goal state.

## 7. Validation commands run

- `test ! -f docs/tickets/T491-r11-current-worklist.md`
- `test ! -f docs/worklog/T491-r11-current-worklist.md`
- `rg -q "Current Remaining Worklist" docs/release/r11-completion-audit-2026-05-15.md`
  (RED before implementation)
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 ROX_R11_EXPECTED_FORKS=2 bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 ROX_R11_EXPECTED_FORKS=2 bun run rebrand:r11-preflight --stage pre-rewrite`
- `bun run rebrand:r11-history-scan`
- `bun run rebrand:r11-legal-preserve`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Fresh report-only evidence captured after PR #225:

```text
main...origin/main = 0 0
HEAD = f68e748d Merge pull request #225 from agisota/docs/r11-audit-moving-head-wording
open PRs = []
```

Expected red R.11 gates:

```text
default preflight: red - no-active-goal, fork-review, rebrand-tag-on-main
ack preflight: red - rebrand-tag-on-main
ack pre-rewrite: red - rebrand-tag-on-main, backup-tag, backup-branch, offline-mirror, remote-branch-review
history scan: red - 81 forbidden-token patch lines
legal preserve: red - backup ref missing for LICENSE, NOTICE, TRADEMARK.md; Dockerfile attribution passes
```

Evidence hashes:

```text
ea99074e9b79d4b5caa258e2d8db1fbcb03b435c16ea0e938b4d1e16ff60da4d  /tmp/r11-preflight-post-pr225-20260515T025017Z.log
18ab339154b2cba0c48f28d05100047cbf905ea4b77f4732dd80a0c3e9cf3a73  /tmp/r11-preflight-ack-post-pr225-20260515T025017Z.log
720951d743c94702ca5570c591db626a3af731e526bade93d2e59214f790931b  /tmp/r11-prewrite-ack-post-pr225-20260515T025017Z.log
e61ea1799af5aebe9a4ebe1a057553a0ace7d7778427d2d4f0dfd4da13af12d2  /tmp/r11-history-scan-post-pr225-20260515T025017Z.log
352f6a806d8835ef56da9aefa436dbbb39e5cc0f498a1ae7ddca7d94e2f48ab6  /tmp/r11-legal-preserve-post-pr225-20260515T025017Z.log
dca07d6acec0b3ec98be1ad40d7a946c950ba96f765ed26a439cc97cdf3ec047  /tmp/r11-git-status-post-pr225-20260515T025017Z.log
f0d9d29c83c9767c75d64b3b0130c7d0d516cab1cd48903ec5c5962abb210baa  /tmp/r11-remote-refs-post-pr225-20260515T025017Z.log
```

Report-only validators passed after implementation:

```text
bun run validate:docs
bun run validate:rebrand
git diff --check
```

## 9. Build output summary

No build is required for this report-only documentation update. The future R.11
rewrite must run the full post-rewrite build matrix before T298 can become
`DONE`.

## 10. Remaining risks

R.11 remains blocked. The destructive path still requires truthful clearance of
the active-goal, fork-review, tag-on-main, backup artifact, offline mirror,
remote branch review, legal-preserve, history scan, and post-rewrite validation
gates.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED checks prove section was absent | PASS | T491 files absent; audit phrase check exited 1 |
| Current worklist added | PASS | Audit now has `Current Remaining Worklist` |
| Safe/destructive actions separated | PASS | Audit splits current state, safe work, and destructive R.11 sequence |
| T298 points at T491 | PASS | T298 representative anchors include T491 |
| Validators pass | PASS | `validate:docs`, `validate:rebrand`, `git diff --check` |
| No destructive R.11 action | PASS | Docs-only report update; no refs/history/mirror/goal mutation |
