# T047 - Quest Map and Skill Tree

Status: DONE

## Context

T047 is an Experience Layer implementation slice originally executed from the T041 PRD track. Its worklog existed before the canonical ticket file, which made backlog accounting ambiguous.

## Goal

Create the Quest Map and Skill Tree screen over evidence-gated quest truth and deterministic unlock rules.

## Acceptance Criteria

- [x] Campaign lanes, quest state, progress, and unlock rules render deterministically.
- [x] Quest completion requires shared artifact/gate evidence.
- [x] Locked quests cannot be manually completed.
- [x] Command/Game presentation changes labels only, not quest truth, rewards, or unlock state.
- [x] Targeted tests and validation are recorded in the worklog.

## Worklog

- `docs/worklog/T047-quest-map-skill-tree.md`
