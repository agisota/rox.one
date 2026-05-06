# T076 - Mission Control Live Scheduler Binding

Status: DONE

## Goal

Make "Центр миссий" the runtime view for launched missions by binding Mission
Control state and checkpoint actions to the shared Experience runtime truth.

## Scope

- Build Mission Control from `ExperienceRuntimeState`.
- Route checkpoint completion through `ExperienceRuntimeStore` events.
- Persist artifact, gate, checkpoint, ledger, and audit evidence into runtime
  truth.
- Keep duplicate checkpoint completion idempotent through stable event ids.
- Keep finalization blocked unless final artifact and gate evidence exist.

## Acceptance Criteria

- Launched mission appears in Mission Control from runtime truth.
- Checkpoint completion updates mission truth.
- Duplicate checkpoint execution is idempotent.
- Pending approval blocks expensive branch.
- Blocking security gate prevents final pass.
- Finalization requires final artifact and passing gates.
- Audit trail records state changes.
- Worklog is complete.
- Scoped commit exists.
