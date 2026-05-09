# T198 - Dead CSS Class Wiring

## 1. Task summary

Wire `.composer-mode-active` onto the active mode option in `ProductModeToolbar.tsx:215` and `.composer-permission-active` onto the trigger chip in `CompactPermissionModeSelector.tsx:94`. 2-line diff. Close the architect-flagged dead-code finding from PR-B1. Slash-mention `it.todo` resolution and Radix Dialog audit are deferred to the B4-cleanup PR.

## 2. Repo context discovered

- T184 defined `.composer-mode-active` and `.composer-permission-active` in the global CSS as semantic reservation classes — intended to mark active states for theming and potential JS selectors. Neither class was applied to any JSX element at definition time. The architect flagged both in the PR-B1 review as dead CSS that should be wired or removed.
- `ProductModeToolbar.tsx:215`: this line is inside the active mode option render path. The element already has `bg-accent ring-1 ring-ring` applied conditionally for the active state. Adding `composer-mode-active` alongside these classes is additive; it does not change the visual output (the class has no CSS rules of its own — it is a semantic marker for external selectors, automation hooks, or future theming).
- `CompactPermissionModeSelector.tsx:94`: this line is the trigger chip element. It renders when the permission mode is active; adding `composer-permission-active` is similarly additive.
- The two-class addition is intentionally minimal. The architect's finding was about dead CSS — the fix is to wire the classes, not to add visual behavior.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/ProductModeToolbar.tsx` — read around line 215; confirmed active mode option conditional render, existing `bg-accent ring-1 ring-ring` class string
- `apps/electron/src/renderer/components/app-shell/CompactPermissionModeSelector.tsx` — read around line 94; confirmed trigger chip element, existing class string
- `apps/electron/src/renderer/styles/globals.css` — confirmed `.composer-mode-active` and `.composer-permission-active` definitions (empty rule blocks: `{}` — semantic reservation only)

## 4. Tests added first

Not applicable. Pure className additions with no behavioral delta. No existing tests assert these class names. Future tests may use them as DOM selectors.

## 5. Expected failing test output

Not applicable.

## 6. Implementation changes

**`apps/electron/src/renderer/components/app-shell/ProductModeToolbar.tsx` (line 215):**

```diff
-  className={cn('...existing classes...', isActive && 'bg-accent ring-1 ring-ring')}
+  className={cn('...existing classes...', isActive && 'bg-accent ring-1 ring-ring composer-mode-active')}
```

**`apps/electron/src/renderer/components/app-shell/CompactPermissionModeSelector.tsx` (line 94):**

```diff
-  className="...existing classes..."
+  className="...existing classes... composer-permission-active"
```

Net change: 2 lines modified across 2 files.

## 7. Validation commands run

```bash
bun run typecheck:electron
```

## 8. Passing test output summary

```text
bun run typecheck:electron
PASS
```

No RTL test run required. No behavioral change.

## 9. Build output summary

No production bundle size change. Both class names are already defined in the global CSS (empty rule blocks); adding them to JSX elements does not generate new CSS. The only change is that these class names now appear in the rendered DOM.

## 10. Remaining risks

- **Slash-mention `it.todo` and Radix Dialog audit deferred.** These were the other two sub-tasks in the original T198 scope. They are not blocked by anything in Pillar 3 but were explicitly descoped to keep this commit focused on the dead-CSS fix only. The deferred work is tracked as the B4-cleanup PR. If B4-cleanup is not scheduled promptly, the `it.todo` count will persist in CI reports and may mask future `todo → skip` regressions.
- **`.composer-mode-active` is conditionally applied.** The class is only in the DOM when `isActive` is true. If a future automation or E2E test selects by `.composer-mode-active`, it must account for this conditionality: the class is absent when no mode is active and present when one is. This is the intended behavior but should be documented in any automation guide that references this class.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `composer-mode-active` applied to `ProductModeToolbar.tsx:215` | PASS | `62ecdc1` — `cn(..., isActive && 'bg-accent ring-1 ring-ring composer-mode-active')` |
| `composer-permission-active` applied to `CompactPermissionModeSelector.tsx:94` | PASS | `62ecdc1` — trigger chip className updated |
| Both CSS classes now reachable in the DOM | PASS | `62ecdc1` — classes applied to JSX elements; no longer dead |
| Architect dead-code finding from PR-B1 closed | PASS | `62ecdc1` — both classes wired |
| No behavioral changes | PASS | `62ecdc1` — pure className additions; no conditional logic or state changes |
| Typecheck passes | PASS | `bun run typecheck:electron` — PASS |
| Commit created | PASS | `62ecdc1` — `chore(composer): wire .composer-mode-active + .composer-permission-active onto active states [T198]` |
