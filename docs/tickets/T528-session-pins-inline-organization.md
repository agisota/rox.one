# T528 - Session pins and quick organization

Status: DONE

## Context

ROX.ONE Agent Workbench already supports direct session rename and labels, but
the primary list UX still hides those actions behind menus and has no distinct
pin-to-top model. This is the first concrete slice of the onboarding/session
workspace goal.

## Goal

Add durable, unlimited session pinning and make the session list consistently
sort pinned sessions before normal recent sessions. Preserve the existing
direct rename and labels behavior as non-agent operations, and prepare the UI
surface for faster organization controls.

## Required UI

- Session menu exposes Pin/Unpin separately from Flag/Unflag.
- Session rows show pinned sessions with an explicit pinned indicator.
- Existing direct rename stays non-agent based.
- Existing labels stay non-agent based.

## Required Data/API

- Persist `pinnedAt?: number` in session headers/config.
- Add `pin` and `unpin` session commands.
- Add `pinSession` and `unpinSession` manager operations.
- Sort all session list metadata pinned-first, then by pin recency for pinned
  sessions and last activity for unpinned sessions.

## Required Automations

- Backend emits session pin/unpin metadata events so secondary windows update.
- Renderer event processing updates local state from pin/unpin events.

## Required Subagents

None for this slice. The touched path is already mapped: shared session
types/persistence, server-core session manager, renderer session atoms/search,
and session list/menu components.

## TDD Requirements

Before implementation:

1. Add shared persistence/sorting unit tests.
2. Add server-core cold-session persistence regression for pin/unpin.
3. Add renderer atom ordering regression for pinned sessions.
4. Run targeted tests and confirm expected failure.

## Implementation Requirements

Implement minimal code required to pass tests. Do not add unrelated onboarding,
account, marketplace, theme, MCP, or build-gate changes in this ticket.

## Validation Commands

- `bun test packages/shared/src/sessions/__tests__/pinned-sessions.test.ts`
- `bun test packages/server-core/src/sessions/cold-session-metadata.test.ts`
- `bun test apps/electron/src/renderer/atoms/__tests__/sessions.test.ts apps/electron/src/renderer/hooks/__tests__/useSessionSearch.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run build`

## Acceptance Criteria

- [ ] `pinnedAt` is persisted and round-trips through session JSONL.
- [ ] Pinned sessions are sorted before unpinned sessions without a pin limit.
- [ ] Pin/unpin commands persist cold-session metadata.
- [ ] Renderer ordering honors pinned sessions after initialization and refresh.
- [ ] Pin/unpin events update live renderer state.
- [ ] Existing direct rename and labels remain non-agent operations.
- [ ] Tests pass.
- [ ] Build passes when applicable.
- [ ] Worklog complete.
- [ ] Commit created.

## Worklog

Update `docs/worklog/T528-session-pins-inline-organization.md`.
