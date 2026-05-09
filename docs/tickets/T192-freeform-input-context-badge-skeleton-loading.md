# T192 - FreeFormInputContextBadge Skeleton Loading State

Status: DONE

## Context

`FreeFormInputContextBadge` displays a context indicator chip (icon + label) in the composer toolbar. When the underlying data is loading asynchronously, the badge previously either hid entirely or displayed stale content, giving no feedback that fresh data is incoming. The design calls for a skeleton placeholder sized to match the badge geometry while data is in flight.

## Goal

Add an optional `loading?: boolean` prop to `FreeFormInputContextBadge`. When `true`, render a skeleton variant using Tailwind's `animate-pulse` and `bg-muted` classes for two placeholder blocks (icon-sized `h-4 w-4` and label-sized `h-3 w-16`). Default behavior (`loading=false`) is unchanged.

## Required UI

- New `loading?: boolean` prop (default `false`).
- Skeleton variant:
  - Icon placeholder: `rounded bg-muted h-4 w-4 animate-pulse`.
  - Label placeholder: `rounded bg-muted h-3 w-16 animate-pulse`.
  - Wrapper preserves existing badge layout classes so geometry matches the real badge.
- Normal variant (existing): unchanged.

## Required Data/API

None. The `loading` prop is driven by the consumer; the badge component has no async logic.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Not applicable for this ticket. The `loading` prop is a visual primitive; no consumer currently passes `loading=true`. Consumer integration (plumbing async data state) is deferred; automated tests will ship with the consumer ticket.

## Implementation Requirements

- `apps/electron/src/renderer/components/app-shell/input/FreeFormInputContextBadge.tsx`:
  - Add `loading?: boolean` to the props interface (JSDoc: `"When true, render a skeleton placeholder while async context data is loading."`).
  - Default `loading = false` in destructuring.
  - Before the normal render return, add an early return when `loading` is true:
    ```tsx
    if (loading) {
      return (
        <span className={badgeWrapperClasses}>
          <span className="rounded bg-muted h-4 w-4 animate-pulse" />
          <span className="rounded bg-muted h-3 w-16 animate-pulse" />
        </span>
      )
    }
    ```
  - `badgeWrapperClasses` reuses the same class string as the normal render to preserve geometry.

## Validation Commands

- `bun run typecheck:electron`

## Acceptance Criteria

- [x] `FreeFormInputContextBadge` accepts `loading?: boolean`.
- [x] When `loading=true`, renders icon placeholder (`h-4 w-4 animate-pulse bg-muted`) and label placeholder (`h-3 w-16 animate-pulse bg-muted`).
- [x] Skeleton wrapper matches badge geometry (same layout classes as normal variant).
- [x] Default behavior (`loading=false`) is unchanged.
- [x] Typecheck passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T192-freeform-input-context-badge-skeleton-loading.md`.
