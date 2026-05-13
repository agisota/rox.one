# T270 - Experience Layer kernel

Status: DONE

## Context

Milestone M.9 lifts the renderer/server divide into a shared "experience"
abstraction so that any surface (sidebar list, session viewer, workbench,
future remote workspaces) can describe its lifecycle in one place: an
identified state machine that transitions in response to a closed set of
events. Today the renderer threads load/error/mutation flags by hand and the
server invents its own framing per surface, which means each new view ships
its own near-duplicate state.

The kernel is the dependency-free heart of that abstraction. It must not
import rxjs, must not throw on illegal transitions, and must stay pure enough
that the renderer hook (T271) and the server emit wiring (T272) can both
build on top of it without forking.

## Goal

Land a pure, exhaustively-typed kernel surface under
`packages/shared/src/experience-layer/` consisting of:

1. `ExperienceId` — branded UUID v7 wrapper with a typed parser.
2. `ExperienceState<T>` — closed union over `Idle | Loading | Ready | Error
   | Mutating`, each variant carrying minimum metadata for renderers.
3. `ExperienceEvent<T>` — closed union over `Load | Loaded | Mutate |
   MutationSucceeded | MutationFailed | Reset | Fail`.
4. `reducer(state, event)` returning `Result<ExperienceState<T>,
   TransitionError>` so illegal pairs are values, not exceptions.
5. `bindExperience(...)` — adapter over a minimal `Observable<T> = {
   subscribe(o): () => void }` plus an async `mutate(input)` runner, with
   injectable wall-clock and mutation-id providers.

## Required UI

None for the kernel itself. T271 lands the renderer hook on top.

## Required Data/API

None. The kernel is pure: no network, no storage, no SDKs.

## Required Automations

None.

## Required Subagents

None — kernel is small enough to author directly.

## TDD Requirements

Before implementation:

1. Run `bun test
   packages/shared/src/experience-layer/__tests__/experience-id.test.ts` and
   confirm the suite fails because the source files do not yet exist.
2. Record the failure as proof the kernel is not present.

After implementation:

1. The kernel test suite reports ≥40 expect() calls across reducer and bind.
2. `bun run validate:agent-contract` and `bun run validate:roadmap` continue
   to pass.

## Implementation Requirements

- Pure modules: no rxjs, no `process`, no `setTimeout`, no global mutable
  state in the reducer.
- The brand symbol for `ExperienceId` is module-local so callers cannot
  synthesise one without going through `parseExperienceId` /
  `unsafeExperienceId`.
- `reducer` never throws. Every illegal `(state, event)` pair returns a
  `TransitionError` value (`IllegalTransition`, `MismatchedId`, or
  `MismatchedMutation`).
- `bindExperience` is the only kernel module that touches wall-clock; the
  clock and the mutation-id generator are injectable for tests.
- The bind treats illegal transitions (e.g. a late source emission after
  `reset()`) as a no-op and forwards the typed error through an optional
  `onTransitionError` sink — never crashes the renderer.

## Acceptance Criteria

- ≥40 expect() calls across reducer truth-table and bind adapter tests.
- `bun test packages/shared/src/experience-layer/__tests__/` passes locally.
- Public barrel `index.ts` re-exports every type and constructor needed by
  T271 / T272 / T080 without forcing deep imports.
- LOC budget respected: ≤600 source LOC + ≤500 test LOC.

## Rollout

1. Land kernel behind no feature flag — pure types and one pure runtime
   helper. There is no caller in `main` yet, so the blast radius is zero.
2. T271 wires the kernel to React via `useExperience(...)`.
3. T272 wires the server emit path to `loaded` events.
4. T080 maps the bundled-spine registry surfaces to bound experiences.

## Rollback

The kernel ships without any existing caller migration. Reverting the four
commits removes the new package surface cleanly; no shim layer required.

## References

- M.9 roadmap entry — Experience Layer kernel.
- T271 — renderer hook adapter (follow-up).
- T272 — server emit wiring (follow-up).
- T080 — mapping per spine (follow-up).
- Worklog: `docs/worklog/T270-experience-layer-kernel.md`.
