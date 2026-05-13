# T264 - Rebrand component renames

Status: DONE

## Context

Phase R.2 removes product-legacy `Craft*` identifiers from active UI component
code before package-scope and asset-path phases begin.

## Goal

Rename the active icon component identifiers from `Craft*` to `Rox*` while
preserving their rendered behavior and consumer imports.

## Required UI

- `CraftAppIcon` -> `RoxAppIcon`.
- `CraftAgentsLogo` -> `RoxAgentsLogo`.
- `CraftAgentsSymbol` -> `RoxAgentsSymbol`.
- Update every UI consumer and adjacent test/import path.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

Use an explorer mapping pass before implementation.

## TDD Requirements

Add a focused R.2 identifier regression test before implementation and confirm
it fails on the existing `Craft*` component identifiers.

## Implementation Requirements

- Rename component files where they carry the old identifier.
- Rename exported component and prop symbols.
- Update imports/usages without changing rendered markup or asset behavior.

## Validation Commands

- `bun test scripts/__tests__/rebrand-code-identifiers.test.ts`
- Adjacent component tests discovered during implementation.
- `bun run typecheck`
- `bun run lint`
- `bun run validate:rebrand` (expected red until all R.2/R.3+ tickets land)

## Acceptance Criteria

- [x] Red test proves the component identifier gap.
- [x] Component files/symbols/imports use `Rox*`.
- [x] No active `CraftAppIcon`, `CraftAgentsLogo`, or `CraftAgentsSymbol`
  identifiers remain outside immutable historical docs.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T264-rebrand-component-renames.md`.
