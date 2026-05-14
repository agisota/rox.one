# T432 - R.11 commit-count audit coverage

Status: DONE

## Context

The R.11 goal requires the closeout worklog to record pre/post commit counts
and requires `git log --oneline | wc -l` to show the expected post-rewrite
commit count with any filter-repo delta documented. T298 tracks this, but the
durable completion audit does not yet map the commit-count artifact.

## Goal

Update the durable R.11 completion audit so commit-count evidence is listed as
a blocked post-rewrite artifact until the destructive rewrite can run.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend the R.11 completion-audit regression so it requires the pre/post
commit-count artifact, the `git log --oneline | wc -l` validation command, and
blocked post-rewrite timing.

## Required Subagents

None. This is a narrow report-only audit coverage change.

## TDD Requirements

Add the failing completion-audit assertion first and confirm it fails because
the durable audit does not yet mention the commit-count artifact.

## Implementation Requirements

- Update `docs/release/r11-completion-audit-2026-05-14.md`.
- Preserve `Status: NOT ACHIEVED`.
- Do not run `git filter-repo`, count rewritten commits, or create post-rewrite
  claims before R.11 is unblocked.
- Do not mutate refs, tags, branches, backups, mirrors, history, or runtime
  source files.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED completion-audit assertion proves the commit-count artifact is
  missing from the durable audit.
- [x] Completion audit maps pre/post commit counts to blocked post-rewrite
  evidence.
- [x] Audit references `git log --oneline | wc -l` and `git rev-list --count
  main`.
- [x] Targeted validation, docs validation, rebrand validation, and whitespace
  checks pass.

## Worklog

Update `docs/worklog/T432-r11-commit-count-audit-coverage.md`.
