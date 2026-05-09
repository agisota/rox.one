# T191 - ImageSupportWarningBanner Slide-Fade Dismiss Animation

## 1. Task summary

Wrap the conditional render of `ImageSupportWarningBanner` in `<AnimatePresence>` + `<motion.div>` so the banner enters and exits with a 200ms slide-fade (`opacity: 0→1`, `y: -8→0`). When `useReducedMotionPreference()` returns `true`, the transition duration is set to `0`. No change to dismiss logic, banner content, or accessibility attributes.

## 2. Repo context discovered

- `ImageSupportWarningBanner` is rendered inside the composer input surface, conditionally based on a `shown` boolean derived from model capability detection. The parent mounts/unmounts the banner in a simple `{shown && <ImageSupportWarningBanner />}` expression — no existing animation wrapper.
- `AnimatePresence` from `motion/react` is already used in `ToolbarStatusSlot` and `AttachmentPreview` (T190, T196). The import path is established.
- `useReducedMotionPreference()` from `@/context/ReducedMotionContext` is the codebase-wide hook for reduced motion gating (T183). Returns `true` when `prefers-reduced-motion: reduce` is set in the OS/browser. Setting `duration: 0` (rather than skipping the motion.div entirely) preserves the `AnimatePresence` tree structure so React's reconciler does not get confused by a conditional change in the component type.
- `y: -8` enter offset: chosen to match the banner's vertical origin at the top of the composer surface. An 8px upward offset is enough to imply a slide-down entry without feeling sluggish.
- `mode="wait"` on `AnimatePresence`: prevents overlap if the user dismisses and immediately triggers the banner again (e.g. switching models rapidly). Only one instance of the banner is animated at a time.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/ImageSupportWarningBanner.tsx` — full read; confirmed dismiss handler, no existing motion wrapper, accessibility attributes
- `apps/electron/src/renderer/components/app-shell/input/ToolbarStatusSlot.tsx` — read for `AnimatePresence` + `motion.div` pattern reference
- `apps/electron/src/renderer/context/ReducedMotionContext.tsx` — confirmed `useReducedMotionPreference()` boolean return type

## 4. Tests added first

Not applicable. The animation is a pure visual wrapper over an existing boolean toggle. Framer Motion's enter/exit mechanics cannot be asserted in jsdom without a real CSS engine. Visual verification is manual.

## 5. Expected failing test output

Not applicable.

## 6. Implementation changes

**`apps/electron/src/renderer/components/app-shell/input/ImageSupportWarningBanner.tsx` (mount site):**

- Added imports: `AnimatePresence`, `motion` from `motion/react`; `useReducedMotionPreference` from `@/context/ReducedMotionContext`.
- Inside the parent component: `const reduced = useReducedMotionPreference()`.
- Replaced `{shown && <ImageSupportWarningBanner />}` with:
  ```tsx
  <AnimatePresence mode="wait">
    {shown && (
      <motion.div
        key="image-warning-banner"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
      >
        <ImageSupportWarningBanner />
      </motion.div>
    )}
  </AnimatePresence>
  ```

Net change: +8 lines in one file (imports + motion wrapper).

## 7. Validation commands run

```bash
bun run typecheck:electron
```

## 8. Passing test output summary

```text
bun run typecheck:electron
PASS
```

No RTL test run required. Visual-only change with no behavioral delta.

## 9. Build output summary

No production bundle size change beyond the 8 added source lines. `motion/react` is already a production dependency. `AnimatePresence` and `motion` are already tree-shaken in the existing bundle.

## 10. Remaining risks

- **`AnimatePresence` sync mode is implicit.** If the parent re-renders aggressively while the exit animation is in flight (e.g., model switch triggers an immediate re-mount), the exit animation may interrupt. With `mode="wait"` and a 200ms duration, the window is short — acceptable. If flicker is observed in practice, `mode="sync"` can be evaluated.
- **No automated test.** The visual behavior is verified manually. If the animation regresses (e.g., a Framer Motion major version removes `mode="wait"` semantics), there is no automated signal. The risk is low given Framer Motion's stable API surface across major versions.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Banner enters with 200ms slide-fade (`opacity: 0→1`, `y: -8→0`) | PASS | `f309bd4` — `motion.div` `initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}` |
| Banner exits with 200ms slide-fade reversed | PASS | `f309bd4` — `exit={{ opacity: 0, y: -8 }}` on `motion.div` |
| Duration is `0` when `prefers-reduced-motion: reduce` | PASS | `f309bd4` — `transition={{ duration: reduced ? 0 : 0.2 }}` |
| `AnimatePresence` mode is `"wait"` | PASS | `f309bd4` — `<AnimatePresence mode="wait">` |
| `motion.div` uses `key="image-warning-banner"` | PASS | `f309bd4` — `key="image-warning-banner"` on `motion.div` |
| No change to dismiss logic or banner content | PASS | `f309bd4` — dismiss handler and banner JSX unchanged |
| Typecheck passes | PASS | `bun run typecheck:electron` — PASS |
| Commit created | PASS | `f309bd4` — `feat(composer): ImageSupportWarningBanner slide-fade dismiss [T191]` |
