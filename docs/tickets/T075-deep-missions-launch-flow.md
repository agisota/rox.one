# T075 - Deep Missions Real Form + Launch Flow

Status: DONE

## Goal

Make "Долгие миссии" a real mission creation screen with editable draft state,
draft persistence, launch events into `ExperienceRuntimeStore`, and a durable
mission scheduler seam.

## Scope

- Convert mission brief fields from read-only preview to editable form controls.
- Add launch state model: empty, invalid, ready, launching, launched, blocked,
  failed.
- Add deterministic draft persistence seam.
- Add fake-safe scheduler seam for mission launch.
- Emit `mission.drafted` and `mission.launched` runtime events.
- Keep launch from implying mission completion; final success still requires
  evidence and gates.

## Acceptance Criteria

- Empty form cannot launch.
- Invalid budget cannot launch.
- Valid form emits `mission.drafted` and `mission.launched`.
- Selected preset changes duration/cadence/agent count.
- Launch does not complete mission.
- Final success requires evidence.
- UI states render correctly with Russian copy.
- Worklog is complete.
- Scoped commit exists.
