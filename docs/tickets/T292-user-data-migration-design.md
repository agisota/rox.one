# T292 - User-data migration design

Status: DONE

## Context

Phase R.8 of the ROX.ONE rebrand sweep owns the upgrade path for users
who still have `~/.craft-agent/` or `~/.craft/` from earlier
single-user installs. R.8 is the **first** phase to introduce on-disk
migration semantics (R.0–R.7 only touched code, docs, and env vars).

This ticket captures the design *before* implementation lands so the
contract is reviewable in isolation.

## Goal

Author a half-page design doc at
`docs/superpowers/specs/2026-05-13-user-data-migration-design.md` that
covers:

- API surface (`migrateUserDataIfNeeded`, `MigrationResult`,
  `MigrationOptions`).
- State machine for the four migration cases.
- Marker file format and idempotency contract.
- Logger contract (no direct `console.*` from the shim).
- Symlink and disk-space risks.
- Electron startup wire location.

## Required UI

None.

## Required Data/API

No production data schema changes. The shim introduces one on-disk
artifact: the `.migrated-from-craft` marker inside `~/.rox/` after a
successful copy.

## Required Automations

None for T292. The design doc only authorizes T293 and T294 to land
implementation + tests.

## Required Subagents

None.

## TDD Requirements

T292 is a design-only ticket; no code is touched. T293 owns the unit
tests and T294 owns the Electron integration test.

## Implementation Requirements

- Spec lives at
  `docs/superpowers/specs/2026-05-13-user-data-migration-design.md`.
- Spec is paired with this ticket and with T293/T294.

## Validation Commands

- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

## Acceptance Criteria

- [x] Design spec authored at the path above.
- [x] Spec covers four-state machine, marker contract, logger contract,
      symlink risk, and Electron wire location.
- [x] T293 and T294 reference this spec for their contract.

## Worklog

Update `docs/worklog/T292-user-data-migration-design.md`.
