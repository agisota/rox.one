# T057 - Experience Layer Interaction Polish

Status: DONE

## Context

The Experience Layer screens already exist, but the shared visual primitives were still too static for the Command/Game/Arena product promise.

## Goal

Refine the shared Experience UI primitives so long-running missions, arena selection, progression, quest map, and agent forge screens gain:

- explicit selected/disabled/status hooks;
- more tactile hover/focus/active states;
- motion-safe game/arena affordances;
- accessible progress semantics;
- no duplicated per-screen decoration.

## Required UI

- `ExperienceCard` exposes selected/disabled/tone states and stronger interactive surface feedback.
- `ExperienceStatusChip` exposes status hooks and animated running state.
- `ExperienceProgressBar` exposes `progressbar` semantics and more visible progress fill.
- `ExperienceMetricCard` and `ExperiencePanel` keep consistent tone styling.

## Required Data/API

No new data model or API. This task is presentation-only over the existing Experience truth layer.

## Required Tests

- Component/static-render tests for RU-first shell preservation.
- Component/static-render tests for gamification states.
- Component/static-render tests for accessible state hooks and motion-safe affordances.

## Acceptance Criteria

- [x] Tests were written before feature code.
- [x] Shared Experience primitives are polished without new dependencies.
- [x] Progress bars expose accessible semantics.
- [x] Running/selected/disabled states are testable and visible.
- [x] Existing Experience screen imports keep working.
- [x] Relevant validation passes.
- [x] Build/run evidence is recorded in the worklog.
