# T471 - IPC channel fixture drift repair

Status: DONE

## Context

The T470 full-suite validation run exposed that `RPC_CHANNELS` now includes
`audit.list`, but the Electron IPC channel stability fixture still expects the
previous channel list. The i18n failures from the same run are tracked
separately in T472 so this ticket stays atomic.

## Goal

Restore the IPC stability validation contract without changing product
behavior.

## Required UI

None.

## Required Data/API

No API changes. The IPC fixture must reflect the already-existing
`RPC_CHANNELS.audit.LIST` channel.

## Required Automations

Use the existing failing tests as the regression checks:

- `bun test apps/electron/src/shared/__tests__/ipc-channels.test.ts`

## Required Subagents

Read-only explorer subagents may be used to confirm the canonical fixture
workflow.

## TDD Requirements

- Confirm the existing IPC snapshot test fails before changing fixtures.
- Make only the minimal fixture update needed to restore the green test.

## Implementation Requirements

- Do not change runtime IPC channel definitions.
- Do not mix R.11 destructive actions into this repair.

## Validation Commands

- `bun test apps/electron/src/shared/__tests__/ipc-channels.test.ts`
- `git diff --check`

## Acceptance Criteria

- [x] IPC channel stability test passes with `audit.list` represented.
- [x] No runtime channel definitions are changed.
