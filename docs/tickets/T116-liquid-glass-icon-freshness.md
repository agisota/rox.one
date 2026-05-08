# T116 - Liquid Glass Icon Freshness

Status: DONE

## Context

The verified T115 macOS arm64 package completed successfully, but
`electron-builder` emitted a release warning:

```text
Warning: Assets.car is older than the current icon sources
Skipping stale Liquid Glass asset; the app will use fallback icon.icns
```

The app still works through `icon.icns`, but the macOS 26+ Liquid Glass icon
asset is stale relative to the ROX.ONE icon sources.

## Goal

Regenerate `apps/electron/resources/Assets.car` from the current icon catalog
sources and add a release contract that catches stale Liquid Glass assets before
packaging.

## Required UI

No app UI change. Preserve the current ROX.ONE icon source art.

## Required Data/API

- Keep icon source files unchanged unless generation requires deterministic
  metadata output.
- Keep package manifests and lockfiles unchanged.
- Keep fallback `icon.icns` behavior for non-macOS 26 and missing/stale
  `Assets.car` cases.

## Required Automations

- Add a focused contract test for `Assets.car` freshness relative to icon
  sources.
- Extend the `afterPack` stale-source list so catalog manifest changes are
  considered alongside icon image sources.

## Required Subagents

No subagent required: this is a bounded release asset repair.

## TDD Requirements

Before implementation:

1. Add the focused Liquid Glass icon freshness contract.
2. Run it and confirm it fails against the stale `Assets.car`.

## Validation Commands

- `bun test scripts/__tests__/mac-liquid-glass-icon-contract.test.ts`
- `bun run electron:dist:dev:mac:arm64`
- `bun run validate:packaged-artifacts`
- `git diff --check`
- `git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Liquid Glass freshness contract fails before regeneration and passes after | DONE |
| `Assets.car` is regenerated from current icon catalog sources | DONE |
| `afterPack` watches the icon catalog manifest for staleness | DONE |
| macOS arm64 packaging no longer skips `Assets.car` as stale | DONE |
| Packaged artifact validator passes | DONE |
| Package manifests and lockfiles remain unchanged | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T116-liquid-glass-icon-freshness.md`.
