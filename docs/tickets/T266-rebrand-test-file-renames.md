# T266 - Rebrand test file renames

Status: DONE

## Context

Phase R.2 also removes legacy product tokens from active test file names and
snapshots after source identifiers have canonical names.

## Goal

Rename active tests and snapshots that carry `craft-agent` or `craft-cli` in
their file names while preserving test coverage and intent.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

Use explorer mapping for the final filename/snapshot list.

## TDD Requirements

Extend the R.2 identifier regression test before implementation and confirm it
fails on the current test filenames.

## Implementation Requirements

- `packages/shared/tests/permissions-craft-agent-sync.test.ts` ->
  `packages/shared/tests/permissions-agent-sync.test.ts`.
- `packages/shared/src/agent/__tests__/permissions-config-craft-cli-flag.test.ts`
  -> `packages/shared/src/agent/__tests__/permissions-config-cli-flag.test.ts`.
- Rename any directly referenced snapshot/fixture names discovered by tests.

## Validation Commands

- `bun test scripts/__tests__/rebrand-code-identifiers.test.ts`
- `bun test packages/shared/tests/permissions-agent-sync.test.ts`
- `bun test packages/shared/src/agent/__tests__/permissions-config-cli-flag.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run validate:rebrand` (expected red until later phases land)

## Acceptance Criteria

- [x] Red test proves the active test filename gap.
- [x] Test files and related snapshots/fixtures use canonical names.
- [x] Renamed tests pass at their new paths.
- [x] Validation evidence is recorded.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T266-rebrand-test-file-renames.md`.
