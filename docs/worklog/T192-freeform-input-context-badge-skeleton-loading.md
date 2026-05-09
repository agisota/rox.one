# T192 - FreeFormInputContextBadge Skeleton Loading State

## 1. Task summary

Add a `loading?: boolean` prop to `FreeFormInputContextBadge`. When `true`, render a skeleton variant using Tailwind's `animate-pulse` + `bg-muted` for an icon-sized block (`h-4 w-4`) and a label-sized block (`h-3 w-16`), both sized to match the badge geometry. Default behavior (`loading=false`) is unchanged.

## 2. Repo context discovered

- `FreeFormInputContextBadge` renders a chip with a small icon and a short text label. The existing layout uses flex with `items-center gap-1.5` (or similar); the skeleton blocks are sized to match the icon and label respectively.
- The badge does not own async state — it is a pure display component. The `loading` prop is controlled entirely by the consumer. No consumer currently passes `loading=true`; this ticket ships the primitive.
- Tailwind's `animate-pulse` is the codebase-standard skeleton animation (used in other parts of the experience layer). `bg-muted` maps to the design system's muted surface token, giving a neutral grey pulse.
- The skeleton wrapper uses the same outer class string as the normal badge render so the toolbar row does not shift height or width while data is loading. This prevents layout shift during the transition from skeleton → real content.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/FreeFormInputContextBadge.tsx` — full read; confirmed prop interface, layout classes, icon and label render structure
- `apps/electron/tailwind.config.ts` — confirmed `animate-pulse` is a Tailwind built-in (no custom keyframe needed)
- `apps/electron/src/renderer/styles/globals.css` — confirmed `bg-muted` maps to `hsl(var(--muted))`

## 4. Tests added first

Not applicable. The `loading` prop is a visual primitive with no current consumer. Automated tests require a consumer that drives `loading=true` and asserts skeleton DOM nodes; that belongs to the consumer integration ticket.

## 5. Expected failing test output

Not applicable.

## 6. Implementation changes

**`apps/electron/src/renderer/components/app-shell/input/FreeFormInputContextBadge.tsx`:**

- Props interface: added `loading?: boolean` with JSDoc `"When true, render a skeleton placeholder while async context data is loading."`.
- Component destructuring: added `loading = false` default.
- Early return before the normal render:
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
  where `badgeWrapperClasses` is the same class string used on the normal badge wrapper (extracted to a constant to avoid duplication).

Net change: +14 lines in one file.

## 7. Validation commands run

```bash
bun run typecheck:electron
```

## 8. Passing test output summary

```text
bun run typecheck:electron
PASS
```

No RTL test run required. No consumer drives `loading=true` yet; no test to run.

## 9. Build output summary

No production bundle size change beyond the 14 added source lines. No new CSS generated: `animate-pulse` and `bg-muted` are already present in the Tailwind output.

## 10. Remaining risks

- **`loading` prop is currently unwired.** No caller passes `loading=true`. The skeleton is complete but invisible in production until a consumer (likely the context provider that fetches the badge data) plumbs async loading state down to this component. The risk is that the prop sits unused. Mitigation: the prop is documented in the interface JSDoc and this worklog.
- **Skeleton geometry may drift if normal badge layout changes.** The skeleton block sizes (`h-4 w-4`, `h-3 w-16`) are chosen to match the current badge icon and label dimensions. If the badge typography or icon size changes in a future design iteration without updating the skeleton sizes, the skeleton will not match the real badge and may cause visible layout shift on load completion. Future contributors should update both the normal and skeleton geometries together.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `FreeFormInputContextBadge` accepts `loading?: boolean` | PASS | `15641a4` — `loading?: boolean` in props interface with JSDoc |
| `loading=true` renders icon placeholder `h-4 w-4 animate-pulse bg-muted` | PASS | `15641a4` — skeleton early return with `<span className="rounded bg-muted h-4 w-4 animate-pulse" />` |
| `loading=true` renders label placeholder `h-3 w-16 animate-pulse bg-muted` | PASS | `15641a4` — `<span className="rounded bg-muted h-3 w-16 animate-pulse" />` |
| Skeleton wrapper matches badge geometry | PASS | `15641a4` — `badgeWrapperClasses` constant shared between normal and skeleton render |
| Default behavior (`loading=false`) unchanged | PASS | `15641a4` — normal render path unchanged; `loading = false` default in destructuring |
| Typecheck passes | PASS | `bun run typecheck:electron` — PASS |
| Commit created | PASS | `15641a4` — `feat(composer): FreeFormInputContextBadge skeleton loading state [T192]` |
