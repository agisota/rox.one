# T332 - Roles IPC channel snapshot repair

Status: DONE

## Context

After PR #75 added the `RPC_CHANNELS.roles` namespace, the full `bun test`
suite failed because `apps/electron/src/shared/__tests__/ipc-channels.test.ts`
still expected the pre-T227 channel inventory.

## Goal

Update the Electron shared IPC wire-format snapshot and T227 docs so the roles
channels added by PR #75 are explicitly accounted for.

## Required UI

None.

## Required Data/API

No runtime API changes. This ticket records the already-shipped role-admin
channel strings in the stability test.

## Required Automations

Use the failing IPC channel stability test as the regression gate.

## Required Subagents

None.

## TDD Requirements

Run `bun test` first and confirm the failure is the expected IPC channel
snapshot drift caused by the four roles channels.

## Implementation Requirements

1. Add `roles.create`, `roles.grant`, `roles.list`, and `roles.revoke` to the
   IPC channel stability snapshot.
2. Update T227 ticket/worklog channel-name wording from colon to the actual
   dot-format wire strings.
3. Do not edit roles runtime handlers or channel definitions.

## Validation Commands

- `bun test apps/electron/src/shared/__tests__/ipc-channels.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`
- `bun run validate:docs`
- `git diff --check`
- `bun test`

## Acceptance Criteria

- [x] Full `bun test` fails before implementation for the expected roles channel snapshot drift.
- [x] IPC channel stability snapshot includes the four roles channels.
- [x] T227 docs name the actual `roles.*` wire strings.
- [x] Targeted IPC/RBAC tests pass.
- [x] Full `bun test` passes.
- [x] Worklog complete.

## Worklog

Update `docs/worklog/T332-roles-ipc-channel-snapshot-repair.md`.
