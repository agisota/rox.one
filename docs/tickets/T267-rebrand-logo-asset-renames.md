# T267 - Rebrand logo asset renames

Status: DONE

## Context

Phase R.3 removes legacy product tokens from active branding asset filenames
before package-scope, environment-variable, and documentation-wide phases.

## Goal

Rename Electron logo asset files and the branding asset directory from
legacy `rox` names to canonical `rox` names without changing image bytes or
runtime asset behavior.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

No subagent required; the logo asset surface is bounded to tracked resource
paths and direct text references discovered by `rg`.

## TDD Requirements

Add a focused R.3 asset-path regression test before implementation and confirm
it fails on the existing legacy logo asset paths.

## Implementation Requirements

- `apps/electron/resources/rox-logos/` -> `apps/electron/resources/rox-logos/`.
- `rox_app_icon.png` -> `rox_app_icon.png`.
- `rox_app_icon_dark.png` -> `rox_app_icon_dark.png`.
- `rox_logo_black.png` -> `rox_logo_black.png`.
- `rox_logo_white.png` -> `rox_logo_white.png`.
- `apps/electron/src/renderer/assets/rox_logo_c.svg` ->
  `apps/electron/src/renderer/assets/rox_logo_c.svg`.
- Update active text references to the renamed logo directory and filenames.

## Validation Commands

- `bun test scripts/__tests__/rebrand-asset-paths.test.ts`
- `bun test scripts/__tests__/mac-liquid-glass-icon-contract.test.ts`
- Phase closeout runs `bun run typecheck`, `bun run lint`, and
  `bun run build` after T268 lands.
- `bun run validate:rebrand` (expected red until later phases land)

## Acceptance Criteria

- [x] Red test proves the logo asset path gap.
- [x] Logo asset directory and filenames use canonical `rox` names.
- [x] Active references use the canonical paths.
- [x] Icon contract remains green.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T267-rebrand-logo-asset-renames.md`.
