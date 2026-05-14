# T376 - Rebrand goal completion audit

Status: DONE
Phase: R.11 completion audit
Ticket: docs/tickets/T376-rebrand-goal-completion-audit.md

## 1. Task summary

Audit the active rebrand goal against current repo evidence before any attempt
to mark it complete. The audit shows the goal is not complete and R.11 remains
blocked.

## 2. Repo context discovered

Active objective from `get_goal`:

```text
follow the instructions in
  docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md
```

Concrete deliverables from the goal file:

1. R.0 through R.10 rebrand phases must be complete.
2. R.11 must run only after every hard prerequisite passes.
3. R.11 must create the backup tag, backup branch, and offline mirror before
   any history rewrite.
4. R.11 must run `git filter-repo`, legal-preserve byte diffs, force-push with
   lease, post-rewrite validation, and re-point `rebrand-v1`.
5. T260 through T298 must be `Status: DONE` with matching worklogs and commit
   SHAs.
6. `validate:rebrand`, typecheck, lint, full tests, build, docs, and
   agent-contract must be green on `main`.
7. RBAC Phase 2 must be merged on the rewritten ancestry.
8. The mapping report must be updated with closeout SHAs.
9. `git log -p --all` must show zero forbidden-token matches outside the
   legal-preserve allowlist.

Prompt-to-artifact checklist:

| Requirement | Evidence inspected | Current state |
| --- | --- | --- |
| Active goal is the rebrand sweep | `get_goal` reports this goal active | In scope |
| R.0-R.10 phase ledger exists | `.swarm/master-roadmap-log.md` has R.0 through R.10 entries | Green |
| T260-T297 rebrand tickets have matching worklogs | Ticket/worklog file listing and status scan | Green at file/status level |
| T298 R.11 closeout is done | `docs/tickets/T298-rebrand-git-history-rewrite.md` | Blocked: `Status: BLOCKED` |
| T223 C.4 closeout is done | `docs/tickets/T223-c4-followups-closeout.md` | Green |
| T229 RBAC closeout is done | `docs/tickets/T229-rbac-integration-tests.md` and roadmap log | Green |
| No open PRs | `gh pr list --state open ... --limit 200` | Green: `[]` |
| No active Codex goal | `get_goal` | Blocked: this goal is active |
| Fork review | `gh api repos/agisota/rox-one-terminal/forks --jq 'length'` | Green: `0` |
| `rebrand-v1` exists | `git ls-remote --tags origin rebrand-v1 ...` | Green: tag exists |
| `rebrand-v1` is post-rewrite | R.11 has not run | Blocked |
| Current main is synced | `git rev-list --left-right --count origin/main...HEAD` | Green: `0 0` |
| Current primary worktree is clean | `git status --porcelain` | Blocked by two pre-existing untracked temp dirs |
| Clean worktree preflight | `/home/dev/rox-m11-repair`, `bun run rebrand:r11-preflight` | Red on 3 hard blockers |
| Backup tag exists | `git ls-remote --tags origin ... pre-rebrand...` | Blocked: missing |
| Offline mirror exists | `ls -ld /tmp/rox-one-terminal-backup-2026-05-13.git` | Blocked: missing |
| History rewrite ran | T298 status and absence of backup artifacts | Blocked: not run |
| Legal-preserve byte diffs ran post-rewrite | T298 acceptance matrix | Blocked: not run |
| Force-push completed with lease | T298 acceptance matrix | Blocked: not run |
| Post-rewrite validation matrix ran | T298 acceptance matrix | Blocked: not run |
| Mapping report has closeout SHAs | `docs/release/rebrand-mapping-2026-05-13.md` | R.10 present; R.11 absent |
| `git log -p --all` forbidden-token gate | lightweight history grep commands | Blocked: old tokens still present in history |

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `.swarm/master-roadmap-log.md`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `docs/tickets/T375-rebrand-r11-post-merge-blocker-audit.md`
- `docs/worklog/T375-rebrand-r11-post-merge-blocker-audit.md`
- `docs/release/rebrand-mapping-2026-05-13.md`
- `docs/tickets/T223-c4-followups-closeout.md`
- `docs/tickets/T229-rbac-integration-tests.md`

## 4. Tests added first

No code test was added. This is a completion audit artifact. The RED gates are
the existing report-only R.11 preflight and the history grep evidence.

## 5. Expected failing test output

R.11 preflight remains red:

```text
no-active-goal       fail    Missing ROX_R11_NO_ACTIVE_GOAL=1 ac...
backup-tag           fail    pre-rebrand-history-rewrite-backup ...
offline-mirror       fail    /tmp/rox-one-terminal-backup-2026-0...
red - 3 R.11 prerequisite(s) failing
```

History still contains old tokens because R.11 has not run:

```text
32629fc5 Keep user-data migration priority fixture on current root
9cb67492 fix(config): restore Priority test coverage + fix conflict guard for rox-agent precedence (#120)
f05d4c7c fix(config): restore Priority test coverage + fix conflict guard for rox-agent precedence
```

## 6. Implementation changes

- Added this completion-audit ticket and worklog.
- Refreshed `docs/worklog/T298-rebrand-git-history-rewrite.md` with current
  blocker evidence.
- Did not run `git filter-repo`.
- Did not create or push backup refs.
- Did not create the offline mirror.
- Did not force-push any refs.
- Did not call `update_goal`.

## 7. Validation commands run

- `get_goal`
- `git status --short --branch`
- `git status --porcelain`
- `git rev-list --left-right --count origin/main...HEAD`
- `gh pr list --state open --json number,title,headRefName,url --limit 200`
- `gh api repos/agisota/rox-one-terminal/forks --jq 'length'`
- `git ls-remote --tags origin rebrand-v1 pre-rebrand-history-rewrite-backup`
- `git show-ref --dereference --tags rebrand-v1 pre-rebrand-history-rewrite-backup`
- `bun run rebrand:r11-preflight`
- `git log --all --oneline --regexp-ignore-case --grep='rox-agent\\|Rox Agents' -n 5`
- `git log -p --all --regexp-ignore-case -G'rox-agent|Rox Agents|@rox-agent' --oneline -n 3 -- . ':(exclude).git'`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Open PR check:

```text
[]
```

Fork review:

```text
0
```

Main sync:

```text
0	0
```

Remote tag check:

```text
e32deed37b33fe3296edde6228adb1f76255027d	refs/tags/rebrand-v1
```

Documentation validation:

```text
[agent-contract] ok: 11 skills, 340 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md
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

No build was run for this docs-only audit. The goal is already blocked before
the destructive R.11 phase, and a post-rewrite build cannot exist until R.11 is
legitimately unblocked and executed.

## 10. Remaining risks

The active goal cannot be closed. The missing pieces are not paperwork gaps:
they are the actual R.11 destructive phase and its required safeguards. The
current active `/goal` state is itself one of the hard prerequisites that must
be cleared before backup creation or history rewrite can begin.

The primary worktree also contains two pre-existing untracked temp directories:

```text
.tmp-test-file-audit-sink/
.tmp-test-host-audit-producer/
```

They were not removed because they were pre-existing untracked files.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Completion criteria are restated as concrete deliverables | Green | Section 2 lists the concrete R.0-R.11 deliverables |
| Prompt-to-artifact checklist exists | Green | Section 2 maps goal requirements to evidence |
| Current R.11 preflight blockers are recorded | Green | Section 5 records active-goal, backup-tag, and offline-mirror failures |
| Current history-grep blocker evidence is recorded | Green | Section 5 records old-token hits in git history |
| T298 blocker state is refreshed | Green | T298 worklog updated in this commit |
| Destructive R.11 actions are not executed | Green | No backup, filter-repo, mirror, force-push, or update_goal action was run |
| Documentation/rebrand validation remains green | Green | `validate:docs`, `validate:rebrand`, and `git diff --check` passed |
| Commit created | Green | Local Lore commit created for this audit |
