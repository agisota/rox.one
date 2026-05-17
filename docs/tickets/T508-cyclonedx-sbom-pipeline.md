# T508-cyclonedx-sbom-pipeline

Status: DONE

## Summary

Implements the initial Linux SBOM generation slice, satisfying the
CLAUDE.md rule: "SBOM required: generate CycloneDX SBOM for each release."
Mac and Windows release workflows remain pending until their platform
pipelines are ready for the same SBOM gate.

Generator: `@cyclonedx/cdxgen@12.4.0` via transient `npx -y`, using
`-t bun` to resolve the `bun.lock` dependency graph. The workflow does
not add `cdxgen` as a production dependency.

## Scope

| Platform | Status | Notes |
|----------|--------|-------|
| Linux    | DONE   | `linux-signed-release.yml` — initial slice |
| Mac      | DONE    | `mac-unsigned-release.yml` — after `Compute unsigned artifact checksum` |
| Windows  | DONE    | `windows-unsigned-release.yml` — after `Compute artifact checksums (SHA-256)` |

## Changes (initial PR)

- `.github/workflows/linux-signed-release.yml`: Added two steps after
  `Compute signed artifact checksum`, before `Upload signed AppImage artifact`:
  1. `Generate CycloneDX SBOM` — runs `npx -y @cyclonedx/cdxgen@12.4.0 -t bun -o sbom-linux.json`,
     then `bun run scripts/validate-sbom.ts sbom-linux.json`
  2. `Upload SBOM artifact` — uploads `sbom-linux.json` as `sbom-linux` artifact,
     `if-no-files-found: error`, `retention-days: 90`

- `scripts/validate-sbom.ts` (new): CLI validator that checks:
  - JSON parseable
  - `bomFormat == "CycloneDX"`
  - `specVersion >= 1.5`
  - at least 100 components listed
  - Usage: `bun run scripts/validate-sbom.ts <path-to-sbom.json>`

## Changes (Mac + Windows + release-all-platforms, final slice)

- `.github/workflows/mac-unsigned-release.yml`: Added two steps after
  `Compute unsigned artifact checksum`, before `Upload unsigned DMG artifact`:
  1. `Generate CycloneDX SBOM` — runs `npx -y @cyclonedx/cdxgen@12.4.0 -t bun -o sbom-mac.json`,
     then `bun run scripts/validate-sbom.ts sbom-mac.json`
  2. `Upload SBOM artifact` — uploads `sbom-mac.json` as `sbom-mac` artifact,
     `if-no-files-found: error`, `retention-days: 90`

- `.github/workflows/windows-unsigned-release.yml`: Added two steps after
  `Compute artifact checksums (SHA-256)`, before `Upload Windows installer artifact`:
  1. `Generate CycloneDX SBOM` — runs `npx -y @cyclonedx/cdxgen@12.4.0 -t bun -o sbom-windows.json`,
     then `bun run scripts/validate-sbom.ts sbom-windows.json`
  2. `Upload SBOM artifact` — uploads `sbom-windows.json` as `sbom-windows` artifact,
     `if-no-files-found: error`, `retention-days: 90`

- `.github/workflows/release-all-platforms.yml`: Added new section 11 (SBOM generation)
  before the existing workflow artifact uploads. Platform-conditional steps produce
  `sbom-{platform}.json` and upload named artifacts `sbom-{platform}-{tag}` with
  `retention-days: 90`.

## Not in scope

- Preflight gate enforcement (separate v1.0.x ticket)
- Mac and Windows workflows (via rebase — see table above)
- Electron-builder packaging logic (untouched)
