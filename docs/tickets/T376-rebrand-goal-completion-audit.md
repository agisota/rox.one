# T376 - Rebrand goal completion audit

Status: DONE

## Context

The active Codex goal points at
`docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`. Before the
goal can be closed, every explicit global stopping condition must be mapped to
real evidence.

## Goal

Record a prompt-to-artifact audit of the rebrand goal's current state and make
the remaining R.11 blockers explicit.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Use read-only commands and report-only validators only. Do not create R.11
backup refs, mirrors, rewritten history, or force-pushed refs.

## Required Subagents

None. The audit is bounded to existing repo artifacts and command output.

## TDD Requirements

Use the goal's report-only preflight and history grep checks as the RED gates.
They must remain red until R.11 is legitimately unblocked and executed.

## Implementation Requirements

- Restate the goal as concrete completion criteria.
- Map each explicit global stopping condition to concrete evidence.
- Identify missing, incomplete, weakly verified, or uncovered requirements.
- Refresh the T298 blocker state with current evidence.
- Do not call `update_goal`.
- Do not run `git filter-repo`.
- Do not create R.11 backup artifacts while preflight is red.

## Validation Commands

- `get_goal`
- `bun run rebrand:r11-preflight`
- `gh pr list --state open --json number,title,headRefName,url --limit 200`
- `gh api repos/agisota/rox-one-terminal/forks --jq 'length'`
- `git ls-remote --tags origin rebrand-v1 pre-rebrand-history-rewrite-backup`
- `git log --all --oneline --regexp-ignore-case --grep='rox-agent\\|Rox Agents' -n 5`
- `git log -p --all --regexp-ignore-case -G'rox-agent|Rox Agents|@rox-agent' --oneline -n 3 -- . ':(exclude).git'`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] Completion criteria are restated as concrete deliverables.
- [x] Prompt-to-artifact checklist exists.
- [x] Current R.11 preflight blockers are recorded.
- [x] Current history-grep blocker evidence is recorded.
- [x] T298 blocker state is refreshed.
- [x] Destructive R.11 actions are not executed.
- [x] Documentation/rebrand validation remains green.
- [x] Commit created.

## Worklog

See `docs/worklog/T376-rebrand-goal-completion-audit.md`.
