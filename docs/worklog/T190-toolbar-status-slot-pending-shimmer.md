# T190 - ToolbarStatusSlot Pending Shimmer State

## 1. Task summary

Add an optional `pending` prop to `ToolbarStatusSlot`. When true and neither the escape overlay nor a browser status chip is active, render a 2px gradient shimmer line at the top edge and a centered small `Spinner`. Both use the `always-animate` CSS class so the loading affordance continues moving under `prefers-reduced-motion: reduce` (T183's opt-out mechanism). The pending tier is the lowest priority in the three-tier resolution chain.

## 2. Repo context discovered

- `ToolbarStatusSlot` already contained `AnimatePresence` from `motion/react` and a two-tier priority resolution: escape interrupt (`showEscapeOverlay`) is highest, browser instance status chip is second. The pending shimmer is inserted as the third tier at lowest priority.
- Priority derivation before T190:
  ```ts
  const showBrowser = !showEscapeOverlay && browserInstance !== null
  ```
  After T190:
  ```ts
  const showBrowser = !showEscapeOverlay && browserInstance !== null
  const showPending = !showEscapeOverlay && !showBrowser && pending
  ```
- `Spinner` from `@craft-agent/ui` was already used elsewhere in the composer surface. No new production dependency added.
- T183 introduced the `always-animate` CSS class as a global opt-out from the `prefers-reduced-motion` override. Any element that must keep animating regardless of user preference (e.g. loading indicators) adds this class. The shimmer div and Spinner both use it.
- The shimmer uses a Tailwind arbitrary `background` inline style (`linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%)`) rather than a design-token background because the shimmer gradient spans from transparent to accent and back — not a solid background fill that a single token can express. The `animate-shimmer-loading` keyframe is already defined in the Tailwind config from earlier composer polish work.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/ToolbarStatusSlot.tsx` — full component read; confirmed AnimatePresence wrapper, priority derivation, existing `Spinner` import path
- `apps/electron/src/renderer/styles/globals.css` — confirmed `always-animate` class definition (`animation-play-state: running !important`)
- `apps/electron/tailwind.config.ts` — confirmed `animate-shimmer-loading` keyframe exists

## 4. Tests added first

Not applicable for this ticket. The pending prop is a visual primitive with no current consumer driving `pending=true`. Automated tests would require a mock or real async state source to flip the prop. Consumer integration is deferred; test coverage ships with the consumer ticket.

## 5. Expected failing test output

Not applicable.

## 6. Implementation changes

**`apps/electron/src/renderer/components/app-shell/input/ToolbarStatusSlot.tsx`:**

- `ToolbarStatusSlotProps` interface: added `pending?: boolean` with JSDoc comment `"When true, render a transient pending shimmer (e.g. async data fetch in flight)."`.
- Component destructuring: added `pending = false` default.
- Priority comment updated to: `// Priority resolution: escape interrupt > browser status > pending shimmer`.
- Added: `const showPending = !showEscapeOverlay && !showBrowser && pending`.
- Added `{showPending && ...}` block inside the existing `AnimatePresence` return:
  - Outer `motion.div` with `key="pending"`, `data-testid="toolbar-status-pending"`, `aria-hidden="true"`, `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, `exit={{ opacity: 0 }}`, `transition={{ duration: 0.15 }}`.
  - Inner shimmer div: `absolute inset-x-0 top-0 h-[2px] z-10 overflow-hidden` containing a child div with `animate-shimmer-loading always-animate` and the gradient inline style.
  - Inner spinner div: `absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground` containing `<Spinner className="text-[10px] leading-none always-animate" />`.

Net change: +37 lines in one file.

## 7. Validation commands run

```bash
bun run typecheck:electron
```

## 8. Passing test output summary

```text
bun run typecheck:electron
PASS
```

No RTL test run needed for this ticket (no consumer integration to test; visual primitive only).

## 9. Build output summary

No production bundle size change beyond the 37 added source lines. No new dependencies. The shimmer animation is a keyframe already in the Tailwind config; no new CSS is generated.

## 10. Remaining risks

- **`pending` prop is currently unwired.** No caller passes `pending=true`. The visual primitive is complete; flipping it to `true` requires a consumer to plumb async data state from the parent context (e.g., browser-instance fetch in flight) down to `ToolbarStatusSlot`. Until that integration ships, the shimmer is never seen in production. The risk is that the prop sits unused and may be overlooked when the async data pattern is added later. Mitigation: the prop is documented in the interface JSDoc and this worklog.
- **`animate-shimmer-loading` keyframe dependency.** The shimmer animation relies on the `animate-shimmer-loading` Tailwind keyframe. If that keyframe is ever renamed or removed, the shimmer will freeze silently (no error). The `always-animate` class will still apply `animation-play-state: running`, but there will be nothing to run. This is low-risk given the keyframe is intentionally shared across the composer.
- **No automated test for the pending state.** The acceptance criteria matrix below records this explicitly. The RTL test will ship with the consumer integration ticket.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `ToolbarStatusSlot` accepts `pending?: boolean` | PASS | `a846796` — `ToolbarStatusSlotProps` interface includes `pending?: boolean` |
| Priority: shimmer only shows when escape overlay off + no browser status | PASS | `a846796` — `const showPending = !showEscapeOverlay && !showBrowser && pending` |
| Shimmer uses `always-animate` class | PASS | `a846796` — shimmer child div: `animate-shimmer-loading always-animate` |
| Spinner uses `always-animate` class | PASS | `a846796` — `<Spinner className="text-[10px] leading-none always-animate" />` |
| `data-testid="toolbar-status-pending"` on pending block | PASS | `a846796` — outer `motion.div` has `data-testid="toolbar-status-pending"` |
| `aria-hidden="true"` on pending block | PASS | `a846796` — outer `motion.div` has `aria-hidden="true"` |
| Typecheck passes | PASS | `bun run typecheck:electron` — PASS |
| Commit created | PASS | `a846796` — `feat(composer): ToolbarStatusSlot pending state with shimmer + always-animate [T190]` |
