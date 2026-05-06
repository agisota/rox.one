# T088 - MissionRun Lifecycle Contract Alignment

Status: IN PROGRESS

## Goal

Make `MissionRun` lifecycle semantics one shared contract across the Experience
runtime store, durable mission scheduler, and renderer projections.

## Scope

- Add a narrow shared lifecycle contract for `MissionRun` status transitions,
  launch normalization, finalization eligibility, and scheduler-event status
  projection.
- Align Deep Missions launch with durable scheduler semantics: launch creates a
  `queued` run; first executable scheduler tick moves it to `running`.
- Align Mission Control `canFinalize` with runtime finalization invariants:
  final artifact plus passing gate evidence are required.
- Keep tests deterministic and fake-provider-safe.

## Acceptance Criteria

- `Mission`, `MissionRun`, and `Deep Mission` vocabulary is documented in the
  worklog.
- `mission.launched` no longer creates a split-brain `running` state while the
  scheduler persists `queued`.
- Scheduler lifecycle events can be projected into canonical `MissionRun`
  status without creating another mutable truth layer.
- `MissionControlState.canFinalize` is false without final artifact and passing
  gate evidence.
- Paid entitlement and elapsed time remain unable to satisfy gates, VDI,
  quests, or finalization.
- Targeted tests pass.
- Relevant broad validation passes or exact blockers are recorded.
- Worklog complete.
- Scoped Lore commit exists.
