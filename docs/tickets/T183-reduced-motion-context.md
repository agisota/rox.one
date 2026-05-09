# T183 - ReducedMotionContext Provider + InputContainer Integration

Status: DONE

## Context

Users who configure "Reduce Motion" in their OS accessibility settings (macOS System Preferences / Windows Ease of Access) expect animations to stop or dramatically shorten. The `motion/react` library used for composer layout transitions does not export `useReducedMotion` in this project's installed version, so a custom provider is needed. `InputContainer.tsx` uses `motion/react`'s `animate()` and `AnimatePresence` for height transitions; these must respect the OS preference.

## Goal

Introduce `context/ReducedMotionContext.tsx` — a provider that reads `window.matchMedia('(prefers-reduced-motion: reduce)')`, sets `<html data-reduced-motion="true">`, and exposes the boolean via `useReducedMotionPreference()`. Mount it in `main.tsx` before any animated content. Add a global CSS rule that disables animation/transition for `[data-reduced-motion="true"]` descendants. Integrate the hook in `InputContainer.tsx` to skip `animate()` and collapse `AnimatePresence` duration.

## Required UI

- No visible UI change when reduced motion is off.
- When OS reduced-motion is on: composer height changes snap without transition; expand/collapse no longer animates.
- CSS rule uses `0.001ms` (not `none`) so `transitionend` events still fire and no downstream listeners break.

## Required Data/API

None.

## Required Automations

None. OS media query fires automatically; provider updates on change event.

## Required Subagents

None.

## TDD Requirements

Self-test deferred to T186 (requires DOM for matchMedia mocking). Validated by:
- typecheck confirming provider + hook types
- lint confirming no lint regressions
- build confirming no new bundle errors

## Implementation Requirements

- New file: `apps/electron/src/renderer/context/ReducedMotionContext.tsx`
  - `ReducedMotionProvider` component using `window.matchMedia` directly (not `motion/react`'s `useReducedMotion` which is not exported in this version)
  - Sets/removes `data-reduced-motion` attribute on `document.documentElement`
  - Listens for `change` events on the media query and updates React state
  - Exports `useReducedMotionPreference()` hook
- `apps/electron/src/renderer/main.tsx`: wrap app tree with `<ReducedMotionProvider>`
- `apps/electron/src/renderer/index.css`: add `[data-reduced-motion="true"] *:not(.always-animate)` rule setting animation/transition to `0.001ms`
- `apps/electron/src/renderer/components/app-shell/input/InputContainer.tsx`: import `useReducedMotionPreference`, skip `animate()` in favor of `heightMotionValue.set()` when reduced, set `AnimatePresence` transition duration to `0` when reduced

## Validation Commands

- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run electron:build`
- `bun run validate:agent-contract`

## Acceptance Criteria

- [x] `ReducedMotionContext.tsx` exported and mounted in `main.tsx`.
- [x] `<html data-reduced-motion="true">` set when OS preference is active.
- [x] Global CSS rule disables animations for `[data-reduced-motion="true"]` descendants.
- [x] `InputContainer.tsx` skips `animate()` when reduced.
- [x] CSS uses `0.001ms` so `transitionend` events still fire.
- [x] Typecheck, lint, and build pass.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T183-reduced-motion-context.md`.
