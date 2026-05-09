# T191 - ImageSupportWarningBanner Slide-Fade Dismiss Animation

Status: DONE

## Context

`ImageSupportWarningBanner` conditionally renders a warning strip when the active model does not support image attachments. When the user dismisses the banner, it previously disappeared instantly with no transition, causing a jarring layout jump as the composer toolbar reflows. The composer's established design language uses motion for transient content: `AnimatePresence` + `motion.div` with reduced-motion gating via `useReducedMotionPreference()` (T183).

## Goal

Wrap the conditional render of `ImageSupportWarningBanner` in `<AnimatePresence>` + `<motion.div>` so the banner enters with a 200ms slide-fade (`opacity: 0→1`, `y: -8→0`) and exits with the same animation reversed. When the user has `prefers-reduced-motion: reduce` active, `useReducedMotionPreference()` returns `true` and the transition duration is set to `0`.

## Required UI

- Existing conditional render is wrapped in `<AnimatePresence mode="wait">`.
- When the banner is shown, `motion.div` with `key="image-warning-banner"`, `initial={{ opacity: 0, y: -8 }}`, `animate={{ opacity: 1, y: 0 }}`, `exit={{ opacity: 0, y: -8 }}`, `transition={{ duration: reduced ? 0 : 0.2 }}`.
- `useReducedMotionPreference()` from `@/context/ReducedMotionContext` gates the duration.
- No change to dismiss logic, banner content, or accessibility attributes.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Not applicable. The animation is a pure visual wrapper over an existing dismiss-toggle boolean. The component has no async state; enter/exit behavior cannot be asserted without a running Framer Motion environment. Visual verification is manual.

## Implementation Requirements

- `apps/electron/src/renderer/components/app-shell/input/ImageSupportWarningBanner.tsx` (or its parent mount site):
  - Add imports: `AnimatePresence`, `motion` from `motion/react`; `useReducedMotionPreference` from `@/context/ReducedMotionContext`.
  - Compute `const reduced = useReducedMotionPreference()`.
  - Wrap conditional render: `<AnimatePresence mode="wait">{shown && <motion.div key="image-warning-banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: reduced ? 0 : 0.2 }}> <ImageSupportWarningBanner ... /> </motion.div>}</AnimatePresence>`.

## Validation Commands

- `bun run typecheck:electron`

## Acceptance Criteria

- [x] Banner enters with 200ms slide-fade (`opacity: 0→1`, `y: -8→0`).
- [x] Banner exits with 200ms slide-fade reversed.
- [x] Duration is `0` when `prefers-reduced-motion: reduce` is active.
- [x] `AnimatePresence` mode is `"wait"` to prevent overlap during rapid toggle.
- [x] `motion.div` uses `key="image-warning-banner"`.
- [x] No change to dismiss logic or banner content.
- [x] Typecheck passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T191-image-support-warning-banner-dismiss-animation.md`.
