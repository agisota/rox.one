# T304 - Parallel chat scroll E2E proof

Status: TODO

## Context

T303 fixed the identified root cause for parallel chat transcript snap-down in `ChatDisplay`: resize-driven auto-follow now respects sticky-bottom intent, and `PanelSlot` treats wheel/trackpad interaction as panel focus intent.

The fix has unit/type/build/smoke proof, but it still lacks a real UI proof where ROX ONE runs multiple concurrent chat sessions, the second/third transcript is manually scrolled upward, and streaming output continues without forcing that transcript back to the bottom.

This ticket is the Rox To-Do Project follow-up for closing that verification gap without mixing it into the already-committed T303 root-cause fix.

## Goal

Produce durable automated or manual evidence that the T303 behavior holds in a real multi-panel or same-panel ROX ONE session workflow while parallel chats continue streaming.

## Required UI

- App shell multi-panel layout.
- `ChatDisplay` transcript scroll area.
- Session creation / switching surface used by the app's current UI.
- Evidence artifact directory for screenshots/video/trace when available.

## Required Data/API

- Prefer fake providers or deterministic local streaming fixtures.
- Do not require live paid provider traffic for the proof.
- Do not persist production user session data in evidence.

## Required Automations

- Add or extend an Electron UI smoke/E2E route that can create/open at least two chat transcripts and simulate streaming transcript growth.
- Capture enough evidence to prove scroll position remains away from bottom after user intent.
- Redact tokens, URLs, and user data in logs/evidence.

## Required Subagents

Optional. Use a test-harness explorer only if the current Electron UI smoke/CDP helpers are unclear.

## TDD Requirements

Before implementation:

1. Inspect the existing Electron UI smoke and fake-provider harness.
2. Add a failing E2E or deterministic UI harness assertion for the T303 scenario.
3. Confirm the failure represents missing coverage or a real regression, not a brittle selector.
4. Implement the minimal harness/support changes needed to pass.

## Implementation Requirements

- Do not rewrite the T303 scroll policy unless the E2E proof finds a new root cause.
- Do not use “open every new chat in a separate panel” as the fix condition; both same-panel and multi-panel flows should preserve manual transcript reading.
- Prefer CDP/Playwright-style durable evidence: screenshot, video, trace, or structured scroll-position log.
- Keep this commit scoped to verification harness/docs unless the proof exposes a real product bug.

## Validation Commands

Current known passing baseline from the T303 recheck:

- `bun test apps/electron/src/renderer/components/app-shell/__tests__/chat-scroll-behavior.test.ts`
- `cd apps/electron && ~/.bun/bin/bunx eslint src/renderer/components/app-shell/ChatDisplay.tsx src/renderer/components/app-shell/PanelSlot.tsx src/renderer/components/app-shell/chat-scroll-behavior.ts src/renderer/components/app-shell/__tests__/chat-scroll-behavior.test.ts`
- `cd apps/electron && bun run typecheck`
- `bun run electron:build:renderer`
- `bun run electron:smoke`

Expected new proof command should be one of:

- `bun run electron:ui-smoke:packaged:mac` after adding the scenario, or
- a new focused script such as `bun run electron:ui-smoke:parallel-chat-scroll`.

Full Electron lint currently has an unrelated pre-existing blocker:

- `apps/electron/src/renderer/components/app-shell/TopBar.tsx:434` uses disallowed `shadow-sm`.

## Acceptance Criteria

- [ ] A deterministic UI/E2E proof creates or opens at least two concurrent chat transcripts.
- [ ] The proof scrolls the second or third transcript away from bottom.
- [ ] The proof simulates or observes continued transcript growth after the scroll-up action.
- [ ] The proof asserts the scroller does not snap back to bottom while `isStickToBottom` is false.
- [ ] The proof separately asserts a sticky-bottom background transcript still auto-follows new output.
- [ ] Evidence artifacts are saved under an evidence path and referenced in the worklog.
- [ ] Targeted T303 unit regression still passes.
- [ ] Electron typecheck/build/smoke still pass.
- [ ] Full lint is either green or its unrelated blocker is documented.
- [ ] Worklog complete.
- [ ] Commit created with only task-owned files staged.

## Worklog

Update `docs/worklog/T304-parallel-chat-scroll-e2e-proof.md`.
