# T508-cyclonedx-sbom-pipeline

Status: IN PROGRESS

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
| Mac      | PENDING | Lands via orchestrator rebase after A2 merges `mac-unsigned-release.yml` |
| Windows  | PENDING | Lands via orchestrator rebase after A3 merges `windows-unsigned-release.yml` |

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

## Not in scope

- Preflight gate enforcement (separate v1.0.x ticket)
- Mac and Windows workflows (via rebase — see table above)
- Electron-builder packaging logic (untouched)
