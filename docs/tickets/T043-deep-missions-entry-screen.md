# T043 - Deep Missions Entry Screen

Status: DONE

## Context

T043 is an Experience Layer implementation slice originally executed from the T041 PRD track. Its worklog existed before the canonical ticket file, which made backlog accounting ambiguous.

## Goal

Create the Deep Missions entry screen and deterministic state helper for long-running mission drafts.

## Acceptance Criteria

- [x] 6h, 24h, and 72h mission presets are represented.
- [x] Checkpoint preview, caps, agent count, and VDI target derive from draft state.
- [x] Launch is disabled until required fields are valid.
- [x] Launch callback emits a parsed draft and does not call real providers.
- [x] Targeted tests and validation are recorded in the worklog.

## Worklog

- `docs/worklog/T043-deep-missions-entry-screen.md`
