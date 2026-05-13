# T271 - Experience Layer React hook adapter (renderer-side)

Status: DONE

## Context

T270 (PR #107, landed on `origin/main`) shipped the dependency-free Experience
Layer kernel at `packages/shared/src/experience-layer/`. The kernel exposes a
pure `reducer(state, event)`, a closed set of `ExperienceState<T>` /
`ExperienceEvent<T>` variants, and a `bindExperience(...)` adapter over a
minimal non-rxjs `Observable<T>`.

T271 lands the renderer-side React hook so components can consume the kernel
without reimplementing the lifecycle plumbing on every surface. The hook is
the thinnest possible adapter: it owns subscription lifecycle and React-side
wrapping for `dispatch` / `mutate`, and defers every state-machine decision
to the kernel reducer. No new external dependencies; no new tsconfig path
aliases.

The hook is the prerequisite for T272 (server emit wiring) — once the
renderer can consume `loaded` events from an arbitrary `Observable<T>`, the
server side can adopt the same framing without forking. T080 (per-spine
registry mapping) will compose this hook with the bundled-spine registry.

## Goal

Land a single renderer hook under `apps/electron/src/renderer/hooks/` plus a
vitest+RTL coverage file:

1. `useExperience(initial, source$, runMutation, options?)` — returns
   `{ state, dispatch, mutate, isIdle, isLoading, isReady, isError,
   isMutating }`. Internally:
   - `useReducer` over a thin wrapper around the kernel reducer.
   - `useEffect` subscribes to `source$` on mount, dispatches `Loaded` on
     emissions and `Fail(load-failed)` on errors, unsubscribes on unmount.
   - `mutate(input)` brackets the supplied async runner with `Mutate` +
     `MutationSucceeded` / `MutationFailed` events; never throws.
   - `options.onTransitionError` receives reducer rejections.
   - `options.autoLoad` (default `true`) toggles the on-mount `Load`
     dispatch.
2. `use-experience.rtl.test.tsx` — ≥6 RTL specs (final count: 13).

## Required UI

None directly — the hook is consumed by future T080 work that wires
registry surfaces.

## Required Data/API

None. Hook is pure-renderer; no IPC, no network.

## Required Automations

None.

## Required Subagents

None — hook is small (under the LOC budget) and authored directly.

## TDD Requirements

The hook composes the kernel reducer (already covered by 73 specs in
`packages/shared/src/experience-layer/__tests__/`). The renderer test
suite adds ≥6 RTL specs covering subscription lifecycle, dispatch escape
hatch, mutation success/failure, illegal-transition forwarding, and
post-unmount safety. Total: 13 RTL specs in
`use-experience.rtl.test.tsx`.

## Implementation Requirements

- Hook is THIN — every transition flows through `reducer<T>` from the kernel.
- No new external dependencies. No new tsconfig path aliases.
- Subscription lifecycle:
  - subscribes on mount (with optional auto-`Load`)
  - unsubscribes on unmount
  - guards async mutation resolutions against post-unmount dispatch
- Callback refs hold `runMutation`, `onTransitionError`, `now`, and
  `newMutationId` so the `useEffect` doesn't re-bind on every render.
- LOC budget respected: ≤200 LOC source + ≤300 LOC tests.

## Acceptance Criteria

- `useExperience.ts` exists and exports the documented surface.
- `use-experience.rtl.test.tsx` defines ≥6 RTL specs; the suite passes
  under `bun run test:rtl` in a checkout where `node_modules` reflects
  the workspace state at HEAD.
- `bun run tsc --noEmit` from `apps/electron/` produces zero new errors
  attributable to the new files. Pre-existing errors in unrelated suites
  (e.g. `voice-input-slot.rtl.test.tsx`) are unchanged.
- `bun run validate:rebrand` passes.
- `bun run validate:agent-contract` and `bun run validate:roadmap` still
  fail only on the pre-existing violations documented in the worklog.

## Rollout

1. Land the hook + tests. No existing caller migration — blast radius is
   zero, identical to T270.
2. T272 wires the server emit path to push `loaded` events.
3. T080 maps the bundled-spine registry surfaces onto bound experiences
   through this hook.

## Rollback

The hook has no caller in `main`. Reverting the two commits removes the
new files cleanly; nothing else changes.

## References

- T270 — Experience Layer kernel (`docs/tickets/T270-experience-layer-kernel.md`).
- T272 — server emit wiring (follow-up).
- T080 — per-spine registry mapping (follow-up).
- M.9 roadmap entry — Experience Layer kernel.
- Worklog: `docs/worklog/T271-experience-hook-adapter.md`.
