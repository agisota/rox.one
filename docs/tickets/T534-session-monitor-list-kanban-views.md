# T534 - Session monitor list and Kanban views

Status: DONE

## Context

The active product goal asks for better session monitoring with both list and
Kanban views. The existing session list already supports pinning, inline rename,
quick labels, unread/status/date grouping, and direct session commands. This
ticket adds a narrow UI slice on top of that existing surface instead of
rebuilding session organization.

## Goal

Add a persistent session monitor view switch:

- List view keeps the existing grouped session list behavior.
- Kanban view shows sessions grouped into status columns for fast monitoring.

## Required UI

- Add a compact List/Kanban segmented control in the session monitor header.
- Persist the selected monitor view locally.
- Keep search results in list mode while search is active.
- Kanban columns show configured session statuses in order and include empty
  configured statuses.
- Unknown/custom status columns render after configured statuses.

## Required Data/API

- Reuse existing `SessionMeta.sessionStatus` and session status configuration.
- Do not add backend commands or new persistence formats.

## TDD Requirements

Before implementation:

1. Add tests for view-mode normalization and Kanban column construction.
2. Add RTL coverage for the List/Kanban toolbar callback contract.
3. Run the targeted test and confirm the expected missing-module failure.

## Validation Commands

- `bun run test:rtl -- src/renderer/components/app-shell/__tests__/SessionMonitorView.rtl.test.tsx`
- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run lint:i18n:parity`
- `bun run lint:i18n:coverage`
- `git diff --check`

## Acceptance Criteria

- [x] List/Kanban monitor toggle is visible in the session monitor header.
- [x] Selected monitor view persists locally.
- [x] Kanban view groups visible sessions by session status.
- [x] Configured status columns keep configured order and show empty columns.
- [x] Unknown/custom status columns render after configured statuses.
- [x] Active search renders list results even when Kanban is selected.
- [x] Tests pass.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T534-session-monitor-list-kanban-views.md`.
