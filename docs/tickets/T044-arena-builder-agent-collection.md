# T044 - Arena Builder and Agent Collection

Status: DONE

## Context

T044 is an Experience Layer implementation slice originally executed from the T041 PRD track. Its worklog existed before the canonical ticket file, which made backlog accounting ambiguous.

## Goal

Create the Arena Builder and Agent Collection screen for deterministic agent package selection into swarm mission drafts.

## Acceptance Criteria

- [x] Agent roster, locked/unlocked state, selection, and entitlement-limited slots are represented.
- [x] Locked agents cannot be selected.
- [x] Paid entitlements increase capacity only and do not alter gates, VDI, trust, or quality semantics.
- [x] Draft run payload persists selected agent package ids.
- [x] Targeted tests and validation are recorded in the worklog.

## Worklog

- `docs/worklog/T044-arena-builder-agent-collection.md`
