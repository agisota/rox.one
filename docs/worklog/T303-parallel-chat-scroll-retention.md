# T303 - Parallel chat scroll retention

## 1. Task summary

Fix the ROX ONE multi-session chat bug where second/third parallel chats can keep snapping to the newest output, making old transcript history effectively unscrollable.

## 2. Repo context discovered

- Checkout: `/Users/marklindgreen/Projects/rox-one-terminal`.
- Branch at start: `feature/hermes-tab`.
- Repository has unrelated pre-existing modified `.agents/skills/*` and `.omc/*` files; this task must not stage them.
- `ChatDisplay` owns transcript `ScrollArea`, reverse pagination, sticky-bottom state, and streaming auto-scroll.
- `PanelSlot` owns per-panel focus in multi-panel layouts and previously focused on pointer down only.
- Root cause: `ChatDisplay`'s `ResizeObserver` forced every unfocused panel to `scrollIntoView({ behavior: 'instant' })` on content resize, ignoring `isStickToBottomRef`. During parallel streaming, this made a background second/third panel snap back down even after the user scrolled up to read history.
- Interaction gap: `PanelSlot` did not focus a panel on wheel/trackpad scroll, so a user could scroll an unfocused panel while the UI still treated it as background.

## 3. Files inspected

- `AGENTS.md`
- `package.json`
- `apps/electron/package.json`
- `apps/electron/src/renderer/components/app-shell/ChatDisplay.tsx`
- `apps/electron/src/renderer/components/app-shell/PanelSlot.tsx`
- `apps/electron/src/renderer/components/app-shell/PanelStackContainer.tsx`
- `apps/electron/src/renderer/components/ui/scroll-area.tsx`
- `apps/electron/src/renderer/index.css`

## 4. Tests added first

Added `apps/electron/src/renderer/components/app-shell/__tests__/chat-scroll-behavior.test.ts` before implementation. The test locks the intended resize auto-scroll policy: unfocused panels must not force-scroll after the user has scrolled away from bottom, but background panels still instant-follow while sticky to bottom.

## 5. Expected failing test output

`bun test apps/electron/src/renderer/components/app-shell/__tests__/chat-scroll-behavior.test.ts` failed before implementation with the expected missing module error:

```text
error: Cannot find module '../chat-scroll-behavior' from '.../chat-scroll-behavior.test.ts'
0 pass
1 fail
1 error
```

## 6. Implementation changes

- Added `apps/electron/src/renderer/components/app-shell/chat-scroll-behavior.ts` with a small pure policy helper for resize-driven auto-scroll.
- Updated `ChatDisplay` `ResizeObserver` to use the helper:
  - focused + sticky-bottom: smooth follow;
  - unfocused + sticky-bottom: instant follow;
  - any panel + user scrolled away from bottom: no forced scroll.
- Updated `PanelSlot` to treat `wheel`/trackpad and focus events as panel intent, not only pointer down. This makes the panel the focused panel when the user scrolls or tabs into it.
- Did not change session creation or force new sessions into separate panels; the bug was scroll intent handling, not session concurrency.

## 7. Validation commands run

```bash
bun test apps/electron/src/renderer/components/app-shell/__tests__/chat-scroll-behavior.test.ts
cd apps/electron && bun run typecheck
bun run electron:build:renderer
bun run electron:smoke
cd apps/electron && bun run lint
cd apps/electron && ~/.bun/bin/bunx eslint src/renderer/components/app-shell/ChatDisplay.tsx src/renderer/components/app-shell/PanelSlot.tsx src/renderer/components/app-shell/chat-scroll-behavior.ts src/renderer/components/app-shell/__tests__/chat-scroll-behavior.test.ts
```

## 8. Passing test output summary

Targeted regression passed:

```text
3 pass
0 fail
4 expect() calls
Ran 3 tests across 1 file.
```

Electron renderer typecheck passed:

```text
$ tsc --noEmit
```

Targeted ESLint for task-owned files passed with exit code 0. Full `cd apps/electron && bun run lint` was also run and failed on an unrelated pre-existing `TopBar.tsx` shadow token violation, not on task-owned files:

```text
apps/electron/src/renderer/components/app-shell/TopBar.tsx
  434:19  error  Disallowed shadow class "shadow-sm"
```

## 9. Build output summary

Renderer production build passed:

```text
vite v6.4.2 building for production...
✓ 5689 modules transformed.
✓ built in 23.48s
```

Electron smoke passed after full app build and headless startup:

```text
[main] App initialized successfully
[smoke] Exit-on-ready requested; shutting down after successful startup
[smoke] Electron headless startup passed
```

Build retained pre-existing Vite chunk-size warnings; no new build error was introduced.

## 10. Remaining risks

- No manual visual/e2e reproduction was performed against a real multi-panel parallel streaming session in this pass. The pure policy regression covers the root branch that caused the snap-down behavior, and `electron:smoke` proves the app still starts.
- Full Electron lint is currently blocked by an unrelated existing `TopBar.tsx` `shadow-sm` violation; targeted ESLint for all task-owned TS/TSX files passes.
- If a future feature bypasses `ChatDisplay` sticky-bottom state or mounts a different transcript scroller, this helper should be reused instead of adding another unconditional resize scroll.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Unfocused/background chat panels do not snap to bottom after user scrolls up | Pass | `getResizeAutoScrollBehavior({ isFocusedPanel: false, isStickToBottom: false }) === 'none'` regression test |
| Background panels still auto-follow streaming output while already at bottom | Pass | `getResizeAutoScrollBehavior({ isFocusedPanel: false, isStickToBottom: true }) === 'instant'` regression test |
| Wheel/trackpad interaction focuses target panel | Pass | `PanelSlot` now wires `onWheelCapture={handlePanelIntent}` and `onFocusCapture={handlePanelIntent}` |
| Targeted tests pass | Pass | `bun test apps/electron/src/renderer/components/app-shell/__tests__/chat-scroll-behavior.test.ts` |
| Electron renderer typecheck/build passes or blocker documented | Pass | `cd apps/electron && bun run typecheck`; `bun run electron:build:renderer` |
| Electron smoke passes | Pass | `bun run electron:smoke` ended with `[smoke] Electron headless startup passed` |
| Task-owned lint passes | Pass | Targeted ESLint on `ChatDisplay.tsx`, `PanelSlot.tsx`, `chat-scroll-behavior.ts`, and test file exited 0 |
| Full Electron lint | Blocked unrelated | `TopBar.tsx:434` uses disallowed pre-existing `shadow-sm`; task-owned files clean |
| Worklog complete | Pass | This document updated with context, implementation, validation, risks, and acceptance matrix |
| Commit created with only task-owned files staged | Pass | This T303 Lore commit includes only the six task-owned files listed in §6 plus this worklog/ticket evidence. |
