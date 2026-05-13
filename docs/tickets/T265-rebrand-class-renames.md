# T265 - Rebrand class renames

Status: DONE

## Context

Phase R.2 removes active non-UI code identifiers that still encode the upstream
Craft product name.

## Goal

Rename non-UI `Craft*` classes, schemas, files, and imports to canonical
`Rox*` names while keeping the required one-minor backward compatibility alias
for `CraftAgentConfig`.

## Required UI

None.

## Required Data/API

- `CraftMcpClient` -> `RoxMcpClient`.
- `CraftOAuth` -> `RoxOAuth`.
- `CraftMetadataSchema` -> `RoxAgentMetadataSchema`.
- `packages/pi-agent-server/src/craft-metadata-schema.ts` ->
  `packages/pi-agent-server/src/rox-agent-metadata-schema.ts`.
- `packages/shared/src/config/sync-craft-agent-bash-patterns.ts` ->
  `packages/shared/src/config/sync-agent-bash-patterns.ts`.
- Add/keep `export type CraftAgentConfig = ClaudeAgentConfig` with
  `@deprecated` JSDoc and explicit removal version.

## Required Automations

None.

## Required Subagents

Use an explorer mapping pass before implementation.

## TDD Requirements

Extend the R.2 identifier regression test before implementation and confirm it
fails on the current non-UI identifiers/files.

## Implementation Requirements

- Rename source files and update all imports.
- Rename exported symbols and adjacent tests.
- Preserve runtime behavior and public compatibility through the deprecated
  `CraftAgentConfig` alias only.

## Validation Commands

- `bun test scripts/__tests__/rebrand-code-identifiers.test.ts`
- Targeted tests for renamed modules.
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run validate:rebrand` (expected red until all later phases land)

## Acceptance Criteria

- [x] Red test proves the non-UI identifier gap.
- [x] Source files/imports use canonical `Rox*`/agent names.
- [x] Deprecated `CraftAgentConfig` alias exists with removal-version JSDoc.
- [x] Targeted and global validation evidence is recorded.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T265-rebrand-class-renames.md`.
