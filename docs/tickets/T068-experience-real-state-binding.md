# T068 - Experience Layer Real-State Binding

Status: DONE

## Goal

Bind Deep Missions, Arena Builder, Mission Control, Progression, Quest Map, and
Agent Forge surfaces to one shared Experience truth state.

## Scope

- Add a typed shared `ExperienceTruthState` model.
- Project Command/Game/Arena presentation from the same immutable truth model.
- Bind Mission Control to mission, checkpoint, gate, audit, ledger, and artifact state.
- Bind Progression Observatory to metric snapshots and ledger evidence.
- Bind Quest Map to quest progress and unlock evidence.
- Bind Agent Forge and Arena Builder to package/trust/selection state.
- Bind Deep Missions draft screen to MissionRun state when available.
- Keep presentation modes separate from validation/evidence/ledger truth.

## Required Tests

- Command/Game/Arena project the same mission truth.
- Presentation mode cannot mutate evidence/gate/ledger semantics.
- Quest progress cannot complete without artifact/gate evidence.
- VDI cannot increase from paid entitlement alone.
- Mission checkpoint updates appear in Mission Control from truth state.
- Progression Observatory reads metric snapshots from truth state.
- Agent Forge respects package visibility/trust state from truth state.

## Acceptance Criteria

- [x] Shared `ExperienceTruthState` tests pass.
- [x] Experience screen real-state binding tests pass.
- [x] Screens still render deterministic fallback state when no truth is supplied.
- [x] Worklog is complete.
- [x] Scoped commit exists.

## Worklog

- `docs/worklog/T068-experience-real-state-binding.md`
