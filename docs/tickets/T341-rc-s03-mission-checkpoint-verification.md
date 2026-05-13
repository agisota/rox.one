# T341 - RC Scenario S03: 24h Mission → Checkpoint → Final Verification

Status: Blocked

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.
Phase 20 of the master roadmap runs the ten release-candidate scenarios end-to-end
on a clean Electron build and captures pass/fail evidence.

This ticket covers **RC Scenario 3** from `plan.md §16`:

> Create 24h mission → checkpoint → final verification.

The scenario exercises the Durable Mission Scheduler (T241/T066), the Deep
Missions launch flow (T075), the Mission Control live-scheduler binding (T076),
and the checkpoint persistence contract. A 24-hour mission is created, allowed to
reach at least one checkpoint, then driven to final verification without losing
state across an app restart.

## Goal

Verify that a durable 24h mission is created, persists its checkpoint state
across an Electron restart, and reaches a final verification status that reflects
the actual mission outcome — not merely elapsed time. The mission state machine
must follow the `draft → queued → running → completed` lifecycle defined in
Phase 8 of the master roadmap.

## Required UI

- Deep Missions launch form (T075)
- Mission Control run-detail screen (T045/T076)
- Checkpoint timeline within Mission Control
- Final verification / completion status indicator

## Required Data/API

- Mission creation RPC (`/rpc/missions.create`)
- Mission status polling or streaming (`/rpc/missions.status`)
- Checkpoint read RPC (`/rpc/missions.checkpoint`)
- Durable mission scheduler state store (T241)
- Persistence adapter for `mission_runs` and `mission_checkpoints` tables (T065)

## Required Automations

- Mission scheduler emits at least one checkpoint event during a 24h run
- App restart restores mission state from persistent store without re-queuing
- Final verification status is derived from validation evidence, not timer

## Required Subagents

None for this validation ticket.

## TDD Requirements

1. Integration test: create a mission → assert `queued` state in the persistence
   store within 100 ms.
2. Integration test: advance deterministic test clock to first checkpoint interval
   → assert checkpoint record exists.
3. Integration test: simulate app restart → assert mission resumes from the last
   checkpoint, not from `draft`.
4. Integration test: drive mission to completion → assert final status is
   `completed` with a populated evidence field.

## Implementation Requirements

No new implementation. This is an RC validation scenario.
Any regressions found should be filed as blocking tickets before Phase 20 can
close.

## Validation Commands

```bash
# Smoke run via E2E harness
bun run e2e:smoke -- --scenario s03-mission-checkpoint

# Durable scheduler unit tests
bun test packages/server-core/src/missions/__tests__/**

# Mission control UI tests
bun test apps/electron/src/renderer/components/workbench/**/__tests__/mission*.test.*

# Agent contract gate
bun run validate:agent-contract
```

## Acceptance Criteria

- [ ] 24h mission is created via the Deep Missions launch form
- [ ] Mission appears in Mission Control with `running` status
- [ ] At least one checkpoint record is persisted in the store
- [ ] App restart (quit + relaunch) shows the mission in the same running state
- [ ] Mission transitions to `completed` with a final verification status
- [ ] Final status is derived from validation evidence, not from a timer
- [ ] Screenshot evidence captured and referenced in
      `docs/release/2026-05-14-rc-evidence.md`
- [ ] Pass/fail status updated in the RC evidence table (row S03)

## Worklog

Update `docs/worklog/T341-rc-s03-mission-checkpoint-verification.md` with run
log, screenshots, and any blocker ticket references.
