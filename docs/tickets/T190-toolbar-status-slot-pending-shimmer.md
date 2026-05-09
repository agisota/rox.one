# T190 - ToolbarStatusSlot Pending Shimmer State

Status: DONE

## Context

ToolbarStatusSlot already manages two display tiers via AnimatePresence: the escape-interrupt overlay (highest priority) and the live browser-instance status chip. There was no affordance for a third, lower-priority tier: a transient loading indicator while async data (e.g. a browser-instance fetch) is in flight. Without it, the slot goes blank during those fetches, giving no signal that work is happening.

## Goal

Add an optional `pending` prop to `ToolbarStatusSlot`. When `true` and neither the escape overlay nor a browser status chip is showing, render a 2px gradient shimmer line along the top edge plus a small `Spinner`. Both elements opt out of the T183 prefers-reduced-motion override via the `always-animate` CSS class, so the loading affordance continues to move even when the user has `prefers-reduced-motion: reduce` set.

## Required UI

- `ToolbarStatusSlot` gains `pending?: boolean` prop (default `false`).
- Priority resolution: escape interrupt > browser status > pending shimmer. The `showPending` flag is only true when neither of the higher tiers is active.
- Shimmer: `position: absolute`, `inset-x-0 top-0 h-[2px]`, `animate-shimmer-loading always-animate` class, gradient via Tailwind arbitrary `background` — `linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%)`.
- Spinner: centered in the slot, `text-[10px]`, `always-animate` class. Reuses existing `Spinner` from `@craft-agent/ui`.
- Entire pending block is wrapped in `motion.div` with `key="pending"`, `opacity: 0→1→0`, `duration: 0.15`, `aria-hidden="true"` (decorative).
- `data-testid="toolbar-status-pending"` on the outer motion.div for test addressability.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Not applicable in this ticket. The pending prop is a visual primitive; no consumer currently drives `pending=true`, so automated tests would require a test harness wiring async state — deferred to the consumer integration ticket.

## Implementation Requirements

- `apps/electron/src/renderer/components/app-shell/input/ToolbarStatusSlot.tsx`:
  - Add `pending?: boolean` to `ToolbarStatusSlotProps` interface (JSDoc: "When true, render a transient pending shimmer (e.g. async data fetch in flight).").
  - Default `pending = false` in destructuring.
  - Update the priority comment: `// Priority resolution: escape interrupt > browser status > pending shimmer`.
  - Add `const showPending = !showEscapeOverlay && !showBrowser && pending`.
  - Add `{showPending && <motion.div ...> ... </motion.div>}` block inside the existing `AnimatePresence` return.

## Validation Commands

- `bun run typecheck:electron`

## Acceptance Criteria

- [x] `ToolbarStatusSlot` accepts `pending?: boolean`.
- [x] Priority resolution: shimmer only shows when escape overlay is off and no browser status is active.
- [x] Shimmer line uses `always-animate` class (survives T183 reduced-motion override).
- [x] Spinner uses `always-animate` class.
- [x] `data-testid="toolbar-status-pending"` present on the pending block.
- [x] `aria-hidden="true"` on the pending block (decorative).
- [x] Typecheck passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T190-toolbar-status-slot-pending-shimmer.md`.
