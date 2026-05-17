# T529 - Inline rename and quick session labels

Status: DONE

## Context

The session list now supports durable pinning, but the user still has to open a
menu/dialog path for common organization actions. Rename and label changes are
already direct session commands; this ticket makes those direct paths faster in
the list UI without introducing any agent-based title generation.

## Goal

Add fast, non-agent session organization controls in the session row:

- Inline rename from the row title by direct edit/commit.
- Quick label toggle from the row without opening the full session menu.

## Required UI

- Double-clicking a session title enters inline rename mode.
- Enter or blur commits a non-empty changed title through the direct
  `onRename` session callback.
- Escape cancels inline rename without changing the session.
- A compact icon-only labels control appears in the session row when labels are
  available.
- Label toggles update the session labels directly and support unlimited labels.

## Required Data/API

- Reuse existing `sessionCommand({ type: 'rename' })` and
  `sessionCommand({ type: 'setLabels' })` paths.
- Do not add new agent requests, title regeneration calls, or backend commands.

## TDD Requirements

Before implementation:

1. Add RTL coverage for inline title rename commit/cancel behavior.
2. Add helper/RTL coverage for quick label toggling.
3. Run those tests and confirm expected failure because the components do not
   exist yet.

## Validation Commands

- `bun run test:rtl -- src/renderer/components/app-shell/__tests__/SessionInlineTitle.rtl.test.tsx src/renderer/components/app-shell/__tests__/SessionQuickLabels.rtl.test.tsx`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `git diff --check`

## Acceptance Criteria

- [ ] Inline rename commits trimmed changed names through the direct rename
  callback.
- [ ] Inline rename ignores empty or unchanged values.
- [ ] Escape cancels inline rename.
- [ ] Quick labels add/remove labels by base label ID without using an agent.
- [ ] Session rows expose the new quick controls without regressing existing
  menu rename/labels.
- [ ] Tests pass.
- [ ] Build passes when applicable.
- [ ] Worklog complete.
- [ ] Commit created.

## Worklog

Update `docs/worklog/T529-inline-rename-quick-labels.md`.
