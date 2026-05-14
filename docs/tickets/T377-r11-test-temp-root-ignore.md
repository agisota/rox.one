# T377 - R.11 test temp root ignore

Status: DONE

## Context

R.11 requires a clean local worktree before any backup or history-rewrite step.
Two server-core observability tests intentionally create local temp roots under
the repository cwd, and those generated roots were showing as untracked files.

## Goal

Ignore the exact generated test temp roots so normal test runs do not make the
primary worktree look dirty during R.11 readiness checks.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

No runtime automation changes. This is a `.gitignore` hygiene update.

## Required Subagents

None. The source of the untracked paths is directly visible in test fixtures.

## TDD Requirements

Use `git check-ignore` as the RED/GREEN check: before this ticket it returned
non-zero for the generated temp roots; after the change it must identify the
new `.gitignore` rules.

## Implementation Requirements

- Ignore `.tmp-test-file-audit-sink/`.
- Ignore `.tmp-test-host-audit-producer/`.
- Do not delete the existing generated temp contents.
- Do not widen the ignore pattern beyond the two known test roots.
- Do not run R.11 backup or rewrite steps.

## Validation Commands

- `git check-ignore -v .tmp-test-file-audit-sink .tmp-test-host-audit-producer`
- `git status --short --branch`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] Both generated test temp roots are ignored.
- [x] Existing generated temp contents are not deleted.
- [x] Primary worktree status no longer reports those temp roots as untracked.
- [x] Documentation/rebrand validation remains green.
- [x] Commit created.

## Worklog

See `docs/worklog/T377-r11-test-temp-root-ignore.md`.
