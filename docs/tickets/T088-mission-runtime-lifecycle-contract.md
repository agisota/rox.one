# T088 - MissionRun Lifecycle Contract Alignment

Status: DONE

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


## Verification Notes

Verified complete against acceptance criteria during the production-readiness
hardening pass:

- shared lifecycle vocabulary and contract are documented in the worklog;
- launch truth is aligned to `queued` before scheduler execution;
- scheduler lifecycle events project into canonical `MissionRun` status;
- Mission Control finalization requires final artifact and passing gate evidence;
- paid/elapsed state still cannot satisfy gates, quests, VDI, or finalization;
- targeted validation remains green and previously broader blockers were either
  fixed later (T090) or recorded precisely.

See `docs/worklog/T088-mission-runtime-lifecycle-contract.md` for exact
commands/results.
