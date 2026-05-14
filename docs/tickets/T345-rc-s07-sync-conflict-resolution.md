# T345 - RC Scenario S07: Sync Push/Pull → Conflict → Explicit Resolution

Status: Blocked

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.
Phase 20 of the master roadmap runs the ten release-candidate scenarios end-to-end
on a clean Electron build and captures pass/fail evidence.

This ticket covers **RC Scenario 7** from `plan.md §16`:

> Sync push/pull → conflict → explicit resolution.

The scenario exercises the Local/Cloud Sync MVP (T024), the production sync
adapter (T065), and the conflict-resolution UI path referenced in the Phase 13
security requirements. When a push and a pull arrive with conflicting state, the
app must surface an explicit conflict UI — it must never silently overwrite either
side.

## Goal

Verify that a sync conflict between a local change and a cloud change is detected,
presented to the user with a clear choice (keep local / keep cloud / merge), and
resolved according to the user's explicit selection. Silent overwrites are a
blocking defect.

## Required UI

- Sync status indicator in the workspace toolbar or sidebar
- Conflict resolution modal with diff view (local vs cloud)
- "Keep local", "Keep cloud", and (if available) "Merge" action buttons
- Post-resolution confirmation with the resolved state visible

## Required Data/API

- `POST /rpc/sync.push` — upload local snapshot
- `POST /rpc/sync.pull` — fetch cloud snapshot
- Conflict detection logic in the sync engine (compare vector clocks or checksums)
- Conflict resolution RPC (`/rpc/sync.resolveConflict`)
- Persistence adapter `sync_operations` table with conflict status column

## Required Automations

- Push/pull cycle detects a conflict and halts auto-sync
- Conflict modal is shown without user needing to navigate manually
- Resolution choice is persisted and reflected in the workspace state immediately

## Required Subagents

None for this validation ticket.

## TDD Requirements

1. Integration test: push local snapshot A; pull remote snapshot B (different
   content on the same key) → assert conflict detected, not silently resolved.
2. Integration test: resolve conflict as "keep local" → assert cloud is updated
   to match local; no data from B survives.
3. Integration test: resolve conflict as "keep cloud" → assert local is updated
   to match B; no data from A survives.
4. Integration test: `sync_operations` table records the conflict resolution
   choice with timestamp and actor.

## Implementation Requirements

No new implementation. This is an RC validation scenario.
Any regressions found should be filed as blocking tickets before Phase 20 can
close.

## Validation Commands

```bash
# Smoke run via E2E harness
bun run e2e:smoke -- --scenario s07-sync-conflict-resolution

# Sync engine integration tests
bun test packages/server-core/src/sync/__tests__/workspace-sync-service.test.ts packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts packages/server-core/src/sync/__tests__/workspace-sync-multi-client-conflict.test.ts

# Agent contract gate
bun run validate:agent-contract
```

## Acceptance Criteria

- [ ] Push of a locally modified workspace is accepted by the sync engine
- [ ] Pull of a conflicting remote state halts auto-sync and surfaces a conflict
      modal
- [ ] Conflict modal shows both sides (local vs cloud) clearly
- [ ] "Keep local" resolution updates the cloud to match; "Keep cloud" updates
      local to match
- [ ] Silent overwrite never occurs (regression test must verify)
- [ ] Conflict resolution is recorded in the `sync_operations` persistence table
- [ ] Screenshot evidence captured and referenced in
      `docs/release/2026-05-14-rc-evidence.md`
- [ ] Pass/fail status updated in the RC evidence table (row S07)

## Worklog

Update `docs/worklog/T345-rc-s07-sync-conflict-resolution.md` with run log,
screenshots, and any blocker ticket references.
