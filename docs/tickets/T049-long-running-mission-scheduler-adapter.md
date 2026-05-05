# T049 - Long-running Mission Scheduler Adapter

Status: DONE

## Context

T049 is an Experience Layer implementation slice originally executed from the T041 PRD track. Its worklog existed before the canonical ticket file, which made backlog accounting ambiguous.

## Goal

Create the deterministic shared scheduler abstraction and fake provider behavior for long-running mission checkpoints.

## Acceptance Criteria

- [x] Due checkpoint execution is deterministic.
- [x] Idempotency keys prevent duplicate checkpoint execution.
- [x] Budget exhaustion pauses the mission and blocks the checkpoint.
- [x] Cancelled missions do not execute future checkpoints.
- [x] Elapsed time alone does not complete a mission.
- [x] Targeted tests and validation are recorded in the worklog.

## Worklog

- `docs/worklog/T049-long-running-mission-scheduler-adapter.md`
