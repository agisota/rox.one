# T496 - R.11 post-PR #228 blocker refresh

Status: DONE

## Context

PR #228 merged after T495 stabilized the hosted `transform_data` EBADF failure.
The durable R.11 audit still needs a current post-merge blocker snapshot so the
remaining worklist is grounded in current `main`, not older report-only
branches.

## Goal

Record the post-PR #228 R.11 state: green PR #228 hosted checks, current
`main` at `a93d6bae`, and the remaining R.11 blockers that still prevent
backup creation, `git filter-repo`, force-push, or marking T298 done.

## Required UI

None.

## Required Data/API

No runtime data or public API changes.

## Required Automations

None.

## Required Subagents

Use read-only subagents for repo, git, validation, and worklog checklist
review. Their output is advisory; durable evidence must come from local
commands and GitHub CLI status.

## TDD Requirements

- Confirm RED before editing: this T496 ticket, matching worklog, snapshot, and
  completion-audit section are absent.
- Keep the change report-only.

## Implementation Requirements

- Do not mutate tags, branches, backup refs, offline mirrors, history,
  force-pushed refs, or `/goal` state.
- Record PR #228 merge and hosted validation status.
- Record current report-only preflight, pre-rewrite, history-scan, and
  legal-preserve blockers.
- Record that `.omc/state/last-tool-error.json` is a dirty worktree blocker and
  is not part of this commit.
- Keep T298 blocked.

## Validation Commands

- `test ! -f docs/tickets/T496-r11-post-228-blocker-refresh.md`
- `test ! -f docs/worklog/T496-r11-post-228-blocker-refresh.md`
- `test ! -f docs/release/r11-post-228-blocker-refresh-2026-05-16.md`
- `rg -q "Post-PR #228 Blocker Refresh" docs/release/r11-completion-audit-2026-05-15.md`
  (expected RED before implementation)
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun test ./packages/session-tools-core/src/handlers/transform-data-spawn-retry.isolated.ts ./packages/session-tools-core/src/handlers/transform-data.test.ts`
- `git diff --check`

## Acceptance Criteria

- [x] RED checks prove the ticket, worklog, snapshot, and audit section were
  absent.
- [x] Snapshot records PR #228 merge and hosted check success.
- [x] Snapshot records current `main` and `origin/main` are synchronized.
- [x] Snapshot records `rebrand-tag-local-sync` passes and
  `rebrand-tag-on-main` still fails.
- [x] Snapshot records `remote-branch-review` now reports 159 non-main,
  non-R.11-backup heads.
- [x] Snapshot records `worktree-clean` is blocked by
  `.omc/state/last-tool-error.json`.
- [x] History-scan and legal-preserve blockers remain explicit.
- [x] T298 and the completion audit point at this post-PR #228 snapshot.
- [x] T495 hosted-proof risk is reconciled.
- [x] Validators pass.
- [x] No destructive R.11 action is performed.

## Worklog

See `docs/worklog/T496-r11-post-228-blocker-refresh.md`.
