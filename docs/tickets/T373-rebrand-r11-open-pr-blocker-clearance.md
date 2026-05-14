# T373 - Rebrand R.11 open PR blocker clearance

Status: DONE

## Context

R.11 history rewrite preflight was blocked by open PRs #171 and #189. Both
PRs were conflict-only blockers against current `origin/main`; neither blocker
should be bypassed with the destructive rewrite still pending.

## Goal

Resolve the two open PR blockers safely, merge only PR-scoped diffs, and
capture fresh R.11 preflight evidence showing the open-PR gate is now green.

## Required UI

None.

## Required Data/API

No product data or runtime API changes in this repair branch. The work updates
GitHub PR state for PR #171 and PR #189.

## Required Automations

- Use isolated worktrees for each PR conflict resolution.
- Run `bun run rebrand:r11-preflight` after the PR state changes.

## Required Subagents

None. The conflict surfaces were bounded to one renderer file per PR and did
not require parallel repo discovery.

## TDD Requirements

Use the R.11 preflight as the RED/GREEN gate for this blocker:

1. Confirm `no-open-prs` is red while PR #171 and PR #189 are open.
2. Resolve and merge both PRs.
3. Confirm `no-open-prs` is green and document remaining hard blockers.

## Implementation Requirements

- Do not run `git filter-repo`.
- Do not create backup tags, backup branches, or offline mirrors while
  `no-active-goal` remains red.
- Do not force-push any protected branch.
- Keep each PR merge diff limited to the PR's intended files.

## Validation Commands

- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`
- PR-specific targeted checks documented in the worklog
- `bun run rebrand:r11-preflight`
- `gh pr list --state open --json number,title,mergeable,headRefName,url --limit 20`

## Acceptance Criteria

- [x] PR #171 is merged or closed with evidence.
- [x] PR #189 is merged or closed with evidence.
- [x] `gh pr list --state open` returns an empty list.
- [x] `bun run rebrand:r11-preflight` reports `no-open-prs` as pass.
- [x] Remaining R.11 blockers are documented.
- [x] No destructive R.11 command was run.

## Worklog

See `docs/worklog/T373-rebrand-r11-open-pr-blocker-clearance.md`.
