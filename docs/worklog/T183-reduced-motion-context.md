# T183 - ReducedMotionContext Provider + InputContainer Integration

## 1. Task summary

Introduce `ReducedMotionContext.tsx` — a React context provider that reads the OS `prefers-reduced-motion: reduce` media query, exposes the boolean to the component tree, and sets `<html data-reduced-motion="true">`. Mount in `main.tsx`. Add a global CSS rule. Integrate in `InputContainer.tsx` to skip motion/react animations when reduced motion is active.

## 2. Repo context discovered

- `motion/react` (formerly Framer Motion) is the animation library. Inspected its installed version's exports: `useReducedMotion` is **not exported** in this version. The provider must use `window.matchMedia('(prefers-reduced-motion: reduce)')` directly.
- `InputContainer.tsx` uses `useAnimate` (motion/react) for height transition via a `heightMotionValue`. The `animate()` call is the one that needs to be bypassed.
- `AnimatePresence` in `InputContainer` wraps the expand/collapse of the toolbar section; transition duration must collapse to 0 when reduced.
- `main.tsx` is the renderer entry point where global providers are mounted. It already wraps the app with several context providers.
- `index.css` is the global stylesheet; Tailwind `animate-*` utilities and CSS `transition` properties are applied throughout. A data-attribute CSS rule covering all descendants is the safest global approach.
- `.always-animate` escape hatch class added so individual components that must animate regardless (e.g., loading spinners that convey state via animation) can opt out of the suppression.
- CSS uses `animation-duration: 0.001ms; transition-duration: 0.001ms` rather than `none` — this keeps `transitionend`/`animationend` events firing so downstream JavaScript listeners (e.g., focus management callbacks) do not break.

## 3. Files inspected

- `apps/electron/src/renderer/main.tsx` — provider mount point
- `apps/electron/src/renderer/index.css` — global stylesheet
- `apps/electron/src/renderer/components/app-shell/input/InputContainer.tsx` — animation target
- `apps/electron/src/renderer/context/` — existing context files (ThemeContext, etc.)
- `node_modules/motion/dist/` — export surface check for `useReducedMotion`

## 4. Tests added first

DOM-bearing test (matchMedia mock) deferred to T186. Pre-implementation:

- Confirmed TypeScript types for `MediaQueryList` and `MediaQueryListEvent` compile cleanly.
- Verified `useReducedMotionPreference()` hook return type is `boolean`.

## 5. Expected failing test output

No bun:test failure. The pre-fix behavior is: `InputContainer` always animates height changes regardless of OS preference. The "failing" state is observable via manual testing in an OS with reduced motion enabled.

## 6. Implementation changes

**New file: `apps/electron/src/renderer/context/ReducedMotionContext.tsx`** (53 lines)

- Creates `ReducedMotionContext` with `React.createContext<boolean>(false)`.
- `ReducedMotionProvider` component:
  - Reads `window.matchMedia('(prefers-reduced-motion: reduce)')` on mount.
  - Sets initial state from `mql.matches`.
  - Adds `change` event listener to update state if OS preference changes at runtime.
  - Sets `document.documentElement.setAttribute('data-reduced-motion', 'true')` when active; removes attribute when not.
  - Removes event listener on unmount.
- `useReducedMotionPreference()` hook: returns the boolean from context.

**`apps/electron/src/renderer/main.tsx`** (+11 lines, -2 lines)

- Imports `ReducedMotionProvider`.
- Wraps app tree with `<ReducedMotionProvider>` as outermost provider (before ThemeProvider) so the data-attribute is set before any animated content paints.

**`apps/electron/src/renderer/index.css`** (+18 lines)

```css
[data-reduced-motion="true"] *:not(.always-animate) {
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.001ms !important;
}
```

**`apps/electron/src/renderer/components/app-shell/input/InputContainer.tsx`** (+20 lines, -2 lines)

- Imports `useReducedMotionPreference` from `@/context/ReducedMotionContext`.
- `const prefersReducedMotion = useReducedMotionPreference()`
- In the height animation callback: when `prefersReducedMotion` is true, calls `heightMotionValue.set(targetHeight)` directly instead of `animate(heightMotionValue, targetHeight, { ... })`.
- In `AnimatePresence` props: passes `{duration: prefersReducedMotion ? 0 : undefined}` to the transition.

## 7. Validation commands run

```bash
bun run typecheck:electron
bun run lint:electron
bun run electron:build
bun run validate:agent-contract
git diff --check
```

## 8. Passing test output summary

```text
bun run typecheck:electron
PASS

bun run lint:electron
PASS

bun run validate:agent-contract
[agent-contract] ok: 11 skills, 126 tickets, 7 required docs

git diff --check
PASS
```

## 9. Build output summary

```text
bun run electron:build
PASS
```

Vite reported the known non-blocking large-chunk warning (pre-existing). No new warnings introduced.

## 10. Remaining risks

- **Runtime toggle edge case.** If the user changes their OS preference while the app is open, `ReducedMotionProvider` updates the data-attribute and React state. However, in-flight `motion/react` animations that started before the preference changed will complete normally. This is acceptable behavior.
- **`motion/react` pre-existing animations outside `InputContainer`.** The CSS rule covers all `[data-reduced-motion="true"]` descendants, including Tailwind `animate-*` utilities. `motion/react`'s JavaScript-driven animations (WAAPI or RAF-based) are not affected by the CSS rule — only those `InputContainer` animations explicitly guarded by the `prefersReducedMotion` boolean. A full audit of all `motion/react` animation call sites is deferred to Pillar 3.
- **DOM-bearing self-test deferred.** matchMedia mocking requires a DOM; full coverage lands with T186.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `ReducedMotionContext.tsx` exported and mounted in `main.tsx` | PASS | `context/ReducedMotionContext.tsx`; `main.tsx` wraps with `<ReducedMotionProvider>` |
| `<html data-reduced-motion="true">` set when OS preference active | PASS | `ReducedMotionProvider` sets/removes attribute on state change |
| Global CSS rule disables animations for `[data-reduced-motion="true"]` descendants | PASS | `index.css` `[data-reduced-motion="true"] *:not(.always-animate)` rule |
| `InputContainer.tsx` skips `animate()` when reduced | PASS | `heightMotionValue.set()` path guarded by `prefersReducedMotion` |
| CSS uses `0.001ms` so `transitionend` events still fire | PASS | `animation-duration: 0.001ms; transition-duration: 0.001ms` (not `none`) |
| Typecheck passes | PASS | `bun run typecheck:electron` |
| Lint passes | PASS | `bun run lint:electron` |
| Build passes | PASS | `bun run electron:build` |
| Worklog complete | PASS | This document |
| Commit created | PASS | `3d46d84` — `feat(composer): ReducedMotionProvider + InputContainer integration [T183]` |
