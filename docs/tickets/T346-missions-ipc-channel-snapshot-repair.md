# T346 - Missions IPC channel snapshot repair

Status: DONE

## Context

After rebasing the validation repair branch onto current `origin/main`, the
full `bun test` suite exposed that the Electron shared IPC channel stability
snapshot still expected the pre-mission RPC inventory.

## Goal

Update the Electron IPC wire-format snapshot so the mission RPC channels
already present in `RPC_CHANNELS.missions` are explicitly accounted for.

## Required UI

None.

## Required Data/API

No runtime API changes. This ticket records already-defined mission channel
strings in the stability test.

## Required Automations

Use the failing IPC channel stability test as the regression gate.

## Required Subagents

Use a read-only explore subagent to confirm the added channel strings.

## TDD Requirements

Run the existing IPC channel stability test first and confirm it fails for the
expected four-channel snapshot drift.

## Implementation Requirements

- Add `missions.create`, `missions.dispatchEvent`, `missions.get`, and
  `missions.list` to the IPC channel stability snapshot.
- Do not edit mission runtime handlers or channel definitions.

## Validation Commands

- `bun test apps/electron/src/shared/__tests__/ipc-channels.test.ts`
- `bun test`
- `git diff --check`

## Acceptance Criteria

- [x] IPC channel stability test fails before implementation for the expected missions snapshot drift.
- [x] Snapshot includes the four `missions.*` wire strings.
- [x] Targeted IPC channel test passes.
- [x] Full `bun test` passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T346-missions-ipc-channel-snapshot-repair.md`.
