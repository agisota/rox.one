# T127 - Experience Visible Demo Console Worklog

## Summary

Closed the gap between hidden demo data and visible Experience UI. The six
Experience tabs now show an actionable demo console with five examples per tab,
operator guidance, MCP preset context, and visible local feedback for demo
actions.

## Red Evidence

Added failing assertions before implementation:

```text
bun test apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx
TypeError: undefined is not an object (evaluating 'session.sourceSessionLabel.length')
Expected to contain: "Демо-контур"
```

## Changes

- Added `ExperienceDemoConsole` to the Experience route, above every tab screen.
- Extended demo sessions with visible source labels, usage steps, setup steps,
  expected outcomes, MCP presets, and five action buttons.
- Reused existing five demo specs per Experience tab; no raw transcripts or
  secrets are embedded.
- Mapped demo quest progress to real quest graph IDs so Quest Map displays
  actual demo progress.
- Generated contracts/review/test evidence for truth-derived Agent Forge demo
  packages so forge actions are usable.
- Added visible feedback for Deep Missions draft save.
- Added visible feedback for Mission Control approval.

## Validation

| Command | Result |
|---|---|
| `bun test apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx apps/electron/src/renderer/components/workbench/__tests__/workbench-interactions.test.ts` | PASS: 25 tests / 450 expects |
| `bun run typecheck:all` | PASS |
| `bun run electron:build` | PASS; Vite chunk-size warning only |
| `bun run electron:smoke` | PASS; Electron headless startup passed |
| `bun run lint:electron` | PASS |
| `git diff --check` | PASS |
| `bun run electron:start` | PASS; app initialized, 8 disk sessions loaded, known MCP/source presets include `byterover`, `exa`, `firecrawl`, `github`, `playwright`, `zai-mcp-server`, and a ROX window was revealed |

## Remaining Risk

- Accessibility-tree click proof could not be captured in this environment:
  Computer Use returned Apple event `-1743` and `appNotFound("ROX.ONE")`.
  Route-level render tests, interaction tests, build, smoke, lint, and live
  Electron startup logs cover the implemented UI behavior.
