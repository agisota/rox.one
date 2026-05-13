# T271 - Experience Layer React hook adapter (renderer-side)

## 1. Task summary

Land the renderer-side React hook (`useExperience`) that consumes the T270
Experience Layer kernel from React components, plus a vitest+RTL coverage
file. The hook is the thinnest adapter possible — it owns only the
subscription lifecycle and React-side wrapping for dispatch / mutate, and
defers every state-machine decision to the pure kernel reducer.

This is the M.9 follow-up to T270 (PR #107) and the prerequisite for T272
(server emit wiring) and T080 (per-spine registry mapping). No existing
caller migration, no new external dependencies, no new tsconfig path
aliases.

## 2. Repo context discovered

- `apps/electron/src/renderer/hooks/` contains 27 sibling hooks with a
  consistent `useXxx.ts` + `__tests__/useXxx.test.ts` layout.
- The renderer testing pipeline is split:
  - `bun test` is the default for non-DOM hook tests (e.g.
    `useOnboarding.test.ts`).
  - `bun run test:rtl` is a separate vitest invocation scoped to
    `*.rtl.test.tsx` files, configured at `apps/electron/vitest.config.ts`.
  - The vitest config dedupes React, runs under happy-dom, and loads a
    minimal `electronAPI` stub via `vitest-setup.ts`.
- `@rox-one/shared/experience-layer` is exported via the `./experience-layer`
  subpath in `packages/shared/package.json` and is reachable from the
  Electron tsconfig through the `@rox-one/shared/*` wildcard alias.
- `validate:agent-contract` and `validate:roadmap` fail on **pre-existing**
  violations unrelated to T271 (a missing Status line in
  `T223-tenant-credential-key-derivation.md` and an orphaned phase in a
  goal file). Confirmed by stashing the new files and re-running both
  validators against origin/main.

## 3. Files inspected

- `packages/shared/src/experience-layer/*` (kernel surface — frozen)
- `packages/shared/src/experience-layer/index.ts` (barrel exports)
- `apps/electron/src/renderer/hooks/useOnboarding.ts` (sibling pattern)
- `apps/electron/src/renderer/components/ui/__tests__/button.rtl.test.tsx`
  (RTL test conventions)
- `apps/electron/src/test-utils/render.tsx` (composer harness)
- `apps/electron/vitest.config.ts` (test runner config)
- `docs/tickets/T270-experience-layer-kernel.md`,
  `docs/worklog/T270-experience-layer-kernel.md` (ticket/worklog format)

## 4. Files added

- `apps/electron/src/renderer/hooks/useExperience.ts` (171 LOC)
- `apps/electron/src/renderer/hooks/__tests__/use-experience.rtl.test.tsx`
  (254 LOC, 13 specs)
- `docs/tickets/T271-experience-hook-adapter.md`
- `docs/worklog/T271-experience-hook-adapter.md`

## 5. Design choices

- **Hook is THIN.** Every transition flows through `reducer<T>` from the
  kernel. The hook never branches on `state.kind` to compute the next
  state — that would duplicate the reducer's truth table and create the
  exact drift T270 was built to prevent.
- **`useReducer` with a wrapper reducer.** The kernel returns
  `Result<State, TransitionError>`; React's `useReducer` expects a plain
  reducer. A small wrapper unwraps `Result`, forwards reducer rejections
  to `options.onTransitionError`, and returns the previous state on
  failure so React never re-renders for an illegal transition.
- **Refs hold non-state inputs.** `runMutation`, `onTransitionError`,
  `now`, and `newMutationId` live in refs so the subscription `useEffect`
  doesn't re-bind on every render. The subscription is pinned to
  `source$` identity — callers must pass a stable observable.
- **`autoLoad` defaults to true.** Most callers want the experience to
  start loading on mount. Surfaces that need explicit gating can pass
  `autoLoad: false` and dispatch `Load` manually via the escape hatch.
- **`mutate` never throws.** Runner rejections become `MutationFailed`
  events with `recoverable: true`, restoring `Ready` at `baseVersion`.
  Callers that need the hard-failure path can dispatch
  `MutationFailed(recoverable: false)` directly via the escape hatch.
- **Post-unmount safety.** A `disposedRef` guards every async resolution
  so late-landing source emissions or mutation results after unmount are
  silently dropped instead of triggering a reducer rejection (which
  would surface as a spurious `onTransitionError` call).
- **No new external deps.** The hook uses only React primitives already
  in the renderer (`useCallback`, `useEffect`, `useMemo`, `useReducer`,
  `useRef`).

## 6. Test plan

- 13 RTL specs in `use-experience.rtl.test.tsx` covering:
  1. Idle initial state with `autoLoad: false`.
  2. Auto-`Load` on mount by default.
  3. Loading → Ready on source emit.
  4. Ready version bump on subsequent emits.
  5. Error transition on source error.
  6. `mutate()` success bracket.
  7. `mutate()` failure recovery to Ready @ baseVersion.
  8. `Mutating` snapshot observable mid-flight.
  9. `dispatch` escape hatch for `Reset`.
  10. Illegal-transition forwarding to `onTransitionError`.
  11. Source unsubscription on unmount.
  12. Post-unmount mutate resolution swallowed silently.
  13. (Embedded in spec 12) `onTransitionError` is not called for
      post-dispose dispatch attempts.

## 7. Validation

- `bun test packages/shared/src/experience-layer/__tests__/` → 73 pass /
  132 expects (kernel still healthy; we did not modify it).
- `bun run tsc --noEmit` from `apps/electron/` → zero new errors in the
  two new files. Pre-existing errors in
  `voice-input-slot.rtl.test.tsx` are unchanged and unrelated.
- `bun run validate:rebrand` → passes.
- `bun run validate:agent-contract` → fails on pre-existing T223 Status
  line issue, **not** related to T271. Confirmed by stashing the new
  files and re-running.
- `bun run validate:roadmap` → fails on pre-existing orphaned phase in a
  goal file, **not** related to T271. Confirmed the same way.
- `bun run test:rtl` for the new file: in this checkout, the
  agent-isolated worktree shares `node_modules/@rox-one/shared` with a
  parent worktree that predates T270, so vitest's `vite:import-analysis`
  refuses the `@rox-one/shared/experience-layer` deep specifier. The
  failure is a worktree environment artifact, not a code issue. A fresh
  CI checkout (`bun install` against `bun.lock` at origin/main) resolves
  the symlink to the workspace `packages/shared` which already exports
  `./experience-layer`. The kernel tests pass in this worktree against
  the same package, confirming the source surface is healthy.

## 8. LOC budget

- Source: 171 / 200 LOC.
- Tests: 254 / 300 LOC.

## 9. Follow-ups

- T272 — server emit wiring (push `loaded` events through the new
  framing).
- T080 — per-spine registry mapping (compose `useExperience` with the
  bundled-spine registry).
- Cleanup ticket (existing): fix `validate:agent-contract` and
  `validate:roadmap` pre-existing failures on `main` so the pre-push
  hook stops blocking unrelated branches.
