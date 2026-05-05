# T060 - Backlog Normalization

Status: DONE

## Goal

Make ticket/worklog accounting unambiguous for Agent Workbench Suite before upstream merge and runtime integration work continues.

## Context

T042-T053 existed as implementation worklog slices under the Experience Layer execution wave, but not as canonical `docs/tickets` files. This created ambiguous counts such as 48 canonical tickets versus 60+ implementation worklogs.

## Scope

- Normalize `docs/tickets/T042-T053` representation.
- Link each canonical ticket to its existing worklog.
- Keep `DONE` only where matching worklog and implementation evidence exists.
- Update `.swarm/inventory.md` and `.swarm/backlog-status.md`.
- Extend docs validation to detect missing ticket/worklog accounting.
- Do not modify runtime product code.

## Acceptance Criteria

- [x] Every `DONE` ticket id has a matching worklog id.
- [x] Every worklog id has a canonical ticket id.
- [x] Every T041 Experience Layer subtask from T042-T053 is explicitly represented.
- [x] Docs validator fails on missing ticket/worklog accounting.
- [x] No product/runtime code changed in this ticket.
- [x] Worklog complete.

## Worklog

- `docs/worklog/T060-backlog-normalization.md`
