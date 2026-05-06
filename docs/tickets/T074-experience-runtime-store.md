# T074 - Experience Runtime Store + Event Bus

Status: DONE

## Goal

Create one app-wide Experience truth layer that receives typed product events and
projects mission, checkpoint, validation, artifact, metric, quest, unlock,
ledger, notification, and UI feedback state without presentation-layer truth
forks.

## Scope

- Add `ExperienceEvent` schema and required event catalog.
- Add `ExperienceRuntimeStore` with a persistence adapter seam.
- Add deterministic event replay and selectors for Command/Game/Arena/shared UI.
- Keep tests fake-provider-safe and deterministic.

## Acceptance Criteria

- Event reducer updates truth deterministically.
- Replaying events reconstructs the same state.
- Duplicate events are idempotent where required.
- Command/Game/Arena projections share the same truth.
- Paid entitlement cannot increase VDI or complete gates.
- Artifact/gate evidence is required for progression.
- Persistence adapter is not bypassed.
- Worklog is complete.
- Scoped commit exists.
