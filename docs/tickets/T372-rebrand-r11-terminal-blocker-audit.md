# T372 - Rebrand R.11 terminal blocker audit

Status: DONE

## Context

The R.11 report-only preflight is reduced to four blockers. Each remaining
blocker is external, destructive, or explicitly prohibited while the preflight
is red.

## Goal

Record a fresh completion audit for the active rebrand-sweep goal and identify
the exact requirements that remain unmet before R.11 can start.

## Required UI

None.

## Required Data/API

No runtime data or product API changes.

## Required Automations

Use read-only GitHub and git checks plus `bun run rebrand:r11-preflight`.

## Required Subagents

None.

## TDD Requirements

The RED gate is the R.11 report-only preflight. Capture the current red output
before writing the audit.

## Implementation Requirements

- Do not run `git filter-repo`.
- Do not create backup tags, backup branches, or offline mirrors.
- Do not merge or close open PRs.
- Do not force-push.
- Do not mark the active goal complete.

## Validation Commands

- `bun run rebrand:r11-preflight`
- `gh pr view 189 --json ...`
- `gh pr view 171 --json ...`
- `gh api repos/agisota/rox-one-terminal/forks --jq 'length'`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] Fresh preflight blocker set is recorded.
- [x] Open PR state is recorded without mutation.
- [x] Fork state is recorded.
- [x] Prompt-to-artifact completion checklist is recorded.
- [x] Remaining hard stop conditions are explicit.
- [x] Documentation validation passes.
- [x] Rebrand validation passes.
- [x] Whitespace diff check passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T372-rebrand-r11-terminal-blocker-audit.md`.
