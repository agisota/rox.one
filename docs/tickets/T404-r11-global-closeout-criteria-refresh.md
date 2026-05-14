# T404 - R.11 global closeout criteria refresh

Status: DONE

## Context

The rebrand goal's global stopping condition requires both:

- `docs/release/rebrand-mapping-2026-05-13.md` updated with closeout commit
  SHAs.
- `git log -p --all` showing zero forbidden-token matches outside the
  legal-preserve allowlist.

T298 listed the history scan as a validation command but did not carry either
requirement in its acceptance list. The mapping report also had no R.11 slot,
which made the missing closeout SHA less visible.

## Goal

Make the unresolved global R.11 closeout requirements explicit in the T298
ticket/worklog and in the mapping report without executing any destructive R.11
step.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Use read-only validation only. Do not run history rewrite, mutate refs, create
backups, create mirrors, delete branches, force-push, or call `update_goal`.

## Required Subagents

None. This is a bounded documentation/evidence refresh.

## TDD Requirements

Use a failing grep-style documentation check first to prove T298 lacks
mapping-report and zero-history acceptance coverage before editing.

## Implementation Requirements

- Add T298 acceptance items for the mapping-report R.11 closeout SHA and the
  final `git log -p --all` zero-history gate.
- Add matching blocked rows to T298's worklog acceptance matrix.
- Add an explicit R.11 pending row to the mapping report without pretending it
  is a closeout SHA.
- Preserve T298 `Status: BLOCKED`.

## Validation Commands

- `if rg -n "mapping report.*R\\.11|R\\.11.*mapping report|history.*zero|git log -p --all.*zero" docs/tickets/T298-rebrand-git-history-rewrite.md docs/worklog/T298-rebrand-git-history-rewrite.md; then exit 1; else echo "RED: T298 lacks mapping-report and zero-history acceptance coverage"; fi`
- `rg -n "R\\.11 closeout commit SHA|git log -p --all|BLOCKED - pending destructive rewrite closeout SHA|Mapping report records R\\.11 closeout SHA" docs/tickets/T298-rebrand-git-history-rewrite.md docs/worklog/T298-rebrand-git-history-rewrite.md docs/release/rebrand-mapping-2026-05-13.md`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED documentation check proves T298 lacked mapping-report and zero-history
  acceptance coverage.
- [x] T298 ticket includes mapping-report and history-scan acceptance items.
- [x] T298 worklog marks both requirements blocked.
- [x] Mapping report has an explicit R.11 pending slot that is not presented as
  a closeout SHA.
- [x] T298 remains `Status: BLOCKED`.
- [x] Destructive R.11 actions are not executed.
- [x] Relevant validation passes.
- [x] Commit created.

## Worklog

See `docs/worklog/T404-r11-global-closeout-criteria-refresh.md`.
