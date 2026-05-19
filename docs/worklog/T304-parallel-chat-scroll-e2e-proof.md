# T304 - Parallel chat scroll E2E proof

## 1. Task summary

Create a Rox To-Do Project follow-up for the remaining verification gap after T303: prove the parallel-chat scroll fix in a real Electron UI/multi-session flow, not only with a pure policy regression and startup smoke.

## 2. Repo context discovered

- Checkout: `/Users/marklindgreen/Projects/rox-one-terminal`.
- Started from `feature/hermes-tab` at T303 commit `5c6a4c0c Preserve transcript reading during parallel chat streaming`.
- Created separate branch `mac/parallel-chat-scroll-e2e-proof` for this follow-up ticket.
- T303 code path reviewed: `ChatDisplay` now uses `getResizeAutoScrollBehavior` to gate resize auto-scroll by sticky-bottom state, and `PanelSlot` focuses panels on pointer, wheel, and focus capture.
- Existing package scripts include `electron:smoke`, `electron:ui-smoke:packaged:mac`, and `e2e:core`; no dedicated parallel-chat-scroll UI proof exists yet.
- The worktree has unrelated pre-existing `.agents/skills/*` and `.omc/*` changes that must not be staged into this ticket commit.

## 3. Files inspected

- `AGENTS.md`
- `package.json`
- `apps/electron/package.json`
- `apps/electron/src/renderer/components/app-shell/ChatDisplay.tsx`
- `apps/electron/src/renderer/components/app-shell/PanelSlot.tsx`
- `apps/electron/src/renderer/components/app-shell/chat-scroll-behavior.ts`
- `apps/electron/src/renderer/components/app-shell/__tests__/chat-scroll-behavior.test.ts`
- `docs/tickets/T303-parallel-chat-scroll-retention.md`
- `docs/worklog/T303-parallel-chat-scroll-retention.md`
- `scripts/e2e-core-scenarios.ts`
- `scripts/electron-ui-smoke-packaged-mac.ts`

## 4. Tests added first

No product or test-harness implementation was added in this commit. This is a tracking/evidence-gap ticket only, created because the current confidence is not absolute without a real UI multi-session streaming proof.

## 5. Expected failing test output

Not applicable for this tracking commit. The expected gap is absence of an E2E/manual proof command for “parallel streaming continues while the second/third chat is scrolled upward”.

## 6. Implementation changes

- Added `docs/tickets/T304-parallel-chat-scroll-e2e-proof.md` with TODO status and acceptance criteria for the missing real UI proof.
- Added this worklog with the verification evidence collected during the recheck.
- No application code changed.

## 7. Validation commands run

```bash
bun test apps/electron/src/renderer/components/app-shell/__tests__/chat-scroll-behavior.test.ts
cd apps/electron && ~/.bun/bin/bunx eslint src/renderer/components/app-shell/ChatDisplay.tsx src/renderer/components/app-shell/PanelSlot.tsx src/renderer/components/app-shell/chat-scroll-behavior.ts src/renderer/components/app-shell/__tests__/chat-scroll-behavior.test.ts
cd apps/electron && bun run typecheck
bun run electron:build:renderer
bun run electron:smoke
cd apps/electron && bun run lint
```

## 8. Passing test output summary

Targeted T303 regression passed:

```text
3 pass
0 fail
4 expect() calls
Ran 3 tests across 1 file.
```

Targeted ESLint for all task-owned T303 files exited with code 0.

Renderer typecheck passed:

```text
$ tsc --noEmit
```

Electron smoke passed:

```text
[main] App initialized successfully
[smoke] Electron headless startup passed
```

## 9. Build output summary

Renderer production build passed twice during this recheck, including inside `electron:smoke`:

```text
vite v6.4.2 building for production...
✓ 5689 modules transformed.
✓ built in 17.54s
```

The build retained existing Vite chunk-size warnings and the known `outDir` warning; no build failure was observed.

## 10. Remaining risks

- The T303 root cause is strongly supported by code review plus regression/type/build/smoke proof, but still not proven by a real multi-panel parallel streaming UI scenario.
- Full Electron lint still fails on an unrelated existing issue:

```text
apps/electron/src/renderer/components/app-shell/TopBar.tsx
  434:19  error  Disallowed shadow class "shadow-sm"
```

- The future T304 proof should avoid paid/live provider dependencies by using fake providers or deterministic transcript growth fixtures.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| T303 root-cause code path reviewed | Pass | `ChatDisplay` resize observer gates auto-scroll via sticky-bottom helper; `PanelSlot` handles wheel/focus intent |
| Targeted T303 unit regression passes | Pass | `bun test apps/electron/src/renderer/components/app-shell/__tests__/chat-scroll-behavior.test.ts` |
| Task-owned T303 lint passes | Pass | Targeted `bunx eslint` on T303 files exited 0 |
| Electron renderer typecheck passes | Pass | `cd apps/electron && bun run typecheck` |
| Electron renderer build passes | Pass | `bun run electron:build:renderer` |
| Electron startup smoke passes | Pass | `bun run electron:smoke` |
| Real multi-panel/same-panel streaming UI proof exists | TODO | This ticket tracks the missing proof |
| Full Electron lint | Blocked unrelated | `TopBar.tsx:434` nonstandard `shadow-sm` |
| Worklog complete for tracking commit | Pass | This document |
