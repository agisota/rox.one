# T066 - Durable Mission Scheduler

Status: DONE

## Goal

Make 6h/24h/72h missions durable and restart-safe by moving checkpoint execution
from in-memory demo state into the Agent Workbench persistence adapter.

## Scope

- Persist `MissionRun` before execution.
- Persist generated or supplied `MissionCheckpoint` records.
- Execute due checkpoints from persisted state.
- Record scheduler events through `MissionRunRepository`.
- Enforce checkpoint idempotency through repository-backed keys.
- Recover queued work after scheduler/service restart.
- Enforce budget/capacity gates before branch expansion.
- Require human approval before expensive swarm expansion.
- Finalize missions only when artifact and validation gate evidence exist.
- Keep tests deterministic and provider-free.

## Required Tests

- Mission persists before execution.
- Checkpoint jobs recover after restart.
- Duplicate checkpoint execution is idempotent.
- Elapsed time alone cannot complete mission.
- Final completion requires evidence.
- Budget/capacity denial blocks expansion.
- Human approval pending blocks 100-agent swarm expansion.
- Scheduler does not call real providers.

## Acceptance Criteria

- [x] Durable scheduler targeted tests pass.
- [x] Persistence adapter remains deterministic.
- [x] No real providers are called in tests.
- [x] Worklog is complete.
- [x] Scoped commit exists.

## Worklog

- `docs/worklog/T066-durable-mission-scheduler.md`
