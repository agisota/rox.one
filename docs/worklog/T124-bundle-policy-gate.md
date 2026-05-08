# T124 - Bundle Policy Gate Worklog

## 1. Task summary

Add a release policy gate for the fresh Electron renderer, WebUI, and Viewer
bundle baselines so large chunks remain accepted for the private RC but future
growth becomes a failing validation signal.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 26]
```

## 2. Repo context discovered

- All existing ticket statuses are `DONE`; T124 is the next new
  productionization slice.
- `bd ready` is unavailable because this checkout has no Beads database.
- T119 added `report:bundle-artifacts:fresh`, which removes generated bundle
  output directories, rebuilds Electron renderer, WebUI, and Viewer, then runs
  the existing bundle report.
- Release docs still describe bundle-size warnings as observational only and
  call out the missing bundle-splitting policy/gate as remaining risk.
- The current clean bundle baselines from `bun run report:bundle-artifacts` are:
  - Electron renderer: `314` JS files / `18,416,517` JS bytes / `7`
    oversized JS/CSS assets.
  - WebUI: `305` JS files / `17,464,023` JS bytes / `5` oversized JS/CSS
    assets.
  - Viewer: `304` JS files / `14,803,145` JS bytes / `4` oversized JS/CSS
    assets.

## 3. Red evidence

Command:

```bash
bun run validate:bundle-policy
```

Actual result before implementation:

```text
error: Script not found "validate:bundle-policy"
```

## 4. Implementation

- Added `scripts/validate-bundle-policy.ts`.
  - It runs `bun run report:bundle-artifacts:fresh` first, so policy checks
    always use rebuilt Electron renderer, WebUI, and Viewer outputs.
  - It fails on growth above T124 RC ceilings for JS asset count, CSS asset
    count, total JS bytes, total CSS bytes, oversized JS/CSS count, and largest
    JS asset size.
- Added `validate:bundle-policy` to `package.json`.
- Added the bundle policy gate to `validate:release` after `electron:build`.
- Added the bundle policy gate to `.github/workflows/private-release.yml` after
  Electron build.
- Extended `scripts/validate-private-release-pipeline.ts` so the private release
  contract requires the new package script, release gate, and workflow step.
- Updated release-current docs and handoff contracts to record T124.
- Tightened `scripts/__tests__/dependency-risk-register-contract.test.ts` so it
  still blocks lock/dependency-surface drift while allowing intentional
  script-only `package.json` release-gate changes.

## 5. Validation log

Initial red check:

```text
bun run validate:bundle-policy
error: Script not found "validate:bundle-policy"
```

Focused bundle policy:

```text
bun run validate:bundle-policy
[bundle-policy] Electron renderer
  js assets: 314/320, total 18416517/19000000 bytes (17.56 MB)
  css assets: 2/3, total 244040/260000 bytes (238.32 KB)
  oversized JS/CSS assets: 7/7
  largest JS: assets/index-BAXYIHFJ.js :: 5427091/5800000 bytes (5.18 MB)

[bundle-policy] WebUI
  js assets: 305/310, total 17464023/18000000 bytes (16.65 MB)
  css assets: 1/2, total 243600/260000 bytes (237.89 KB)
  oversized JS/CSS assets: 5/5
  largest JS: assets/main-D-lZa4-l.js :: 5524759/5800000 bytes (5.27 MB)

[bundle-policy] Viewer
  js assets: 304/310, total 14803145/15300000 bytes (14.12 MB)
  css assets: 1/2, total 124691/140000 bytes (121.77 KB)
  oversized JS/CSS assets: 4/4
  largest JS: assets/index-GqF0Vrx9.js :: 5368307/5700000 bytes (5.12 MB)

[bundle-policy] ok: fresh bundle outputs stay within the current RC budget ceilings
```

Focused contracts:

```text
bun run validate:private-release-pipeline
[private-release-pipeline] ok: private release workflow, scripts, and artifact gates passed

bun test scripts/__tests__/release-current-handoff-contract.test.ts
1 pass
0 fail
27 expect() calls

bun test scripts/__tests__/dependency-risk-register-contract.test.ts
2 pass
0 fail
44 expect() calls

bun run validate:docs
[agent-contract] ok: 11 skills, 125 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md
```

Full release gate:

```text
bun run validate:release
4767 pass
13 skip
0 fail
[bundle-policy] ok: fresh bundle outputs stay within the current RC budget ceilings
[mac-arm-build-workflow] ok: Mac ARM workflow contract passed
[private-release-pipeline] ok: private release workflow, scripts, and artifact gates passed
```

## 6. Result

T124 is complete. Fresh Electron renderer, WebUI, and Viewer bundle outputs are
now part of the local and private-release validation chain. The existing large
chunks are accepted as the T124 private-RC baseline, but growth above the
documented ceilings now fails release validation.

Remaining risk: T124 gates bundle growth; it does not split or shrink the
existing large chunks.
