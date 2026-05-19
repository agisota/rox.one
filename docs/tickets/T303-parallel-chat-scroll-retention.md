# T303 - Parallel chat scroll retention

Status: DONE

## Context

ROX ONE supports multiple active chat sessions and multiple visible content panels. Users can run several sessions in parallel, but when inspecting the second or third chat, the transcript can snap back to the bottom and make older history effectively unscrollable.

Relevant product goals:

- local desktop app
- concurrent agent sessions
- multi-panel chat workflows
- frictionless transcript reading while sessions continue streaming

## Goal

Keep chat history scrollable in every visible panel while parallel sessions continue producing output. Background/unfocused panels may stay at the bottom only while the user has not manually scrolled away from the bottom.

## Required UI

- Chat transcript scroll area in `ChatDisplay`.
- Multi-panel content slots in `PanelSlot`.
- No new visible controls.

## Required Data/API

- No persistence or IPC changes.
- Maintain per-renderer scroll state only.

## Required Automations

- None.

## Required Subagents

Not required for this narrow UI/root-cause fix; relevant files are localized by repository search.

## TDD Requirements

Before implementation:

1. Add a focused unit test for scroll resize behavior.
2. Confirm it fails against the current behavior.
3. Implement the minimal change.
4. Run targeted test, typecheck/build as relevant.

## Implementation Requirements

- Do not change session creation semantics unless evidence shows it is the root cause.
- Do not force every new chat into a separate panel as a workaround.
- Preserve auto-follow behavior for panels still stuck to the bottom.
- Stop auto-follow when a user scrolls an unfocused/background panel upward.
- Treat wheel/trackpad interaction with a panel as intent to focus that panel.

## Validation Commands

- `bun test apps/electron/src/renderer/components/app-shell/__tests__/chat-scroll-behavior.test.ts`
- `cd apps/electron && bun run typecheck`
- `bun run electron:build:renderer`

## Acceptance Criteria

- [x] Unfocused/background chat panels do not snap to bottom after the user scrolls up.
- [x] Background panels still auto-follow streaming output while already at bottom.
- [x] Wheel/trackpad interaction focuses the target panel.
- [x] Targeted tests pass.
- [x] Electron renderer typecheck/build passes or blocker is documented.
- [x] Worklog complete.
- [x] Commit created with only task-owned files staged.

## Worklog

Update `docs/worklog/T303-parallel-chat-scroll-retention.md`.
