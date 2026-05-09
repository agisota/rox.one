# T127 - Experience Visible Demo Console

Status: complete

## Context

The Experience tabs had five demo sessions per tab in data, but the visible UI
did not explain how to use them, how to configure them, what to expect, or which
buttons had meaningful local feedback. Some tab-level state derived from demo
truth was also too thin for Quest Map and Agent Forge.

## Goal

Make all six Experience tabs visibly populated with actionable demo content:
five examples per tab, clear usage/setup/outcome guidance, MCP preset context,
and buttons that produce visible local feedback.

## Acceptance Criteria

- [x] Each of the six Experience tabs renders five visible sanitized demos.
- [x] Every demo exposes usage, setup, expected-outcome, MCP preset, and action metadata.
- [x] The Experience UI renders a visible demo console with action buttons.
- [x] Deep Missions draft save button produces visible feedback.
- [x] Mission Control approval button produces visible feedback.
- [x] Quest Map demo truth lands on visible quest graph nodes.
- [x] Agent Forge demo truth includes contracts/reviews/tests for usable package actions.
- [x] Tests pass.
- [x] Worklog complete.

## Validation Commands

- `bun test apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx apps/electron/src/renderer/components/workbench/__tests__/workbench-interactions.test.ts`
- `bun run typecheck:all`
- `bun run electron:build`
- `git diff --check`

## Worklog

Update `docs/worklog/T127-experience-visible-demo-console.md`.
