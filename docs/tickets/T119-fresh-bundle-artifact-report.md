# T119 - Fresh Bundle Artifact Report

Status: DONE

## Context

T092 added a read-only bundle artifact report for Electron, WebUI, and Viewer,
but it measures whatever is already present in `dist`. The worklog explicitly
noted that WebUI contained multiple historical hashed `App-*.js` artifacts, so
the totals can overstate a clean single-build footprint.

Production release evidence needs a repeatable command that removes stale build
outputs, rebuilds the bundle surfaces, and then runs the existing bundle report.

## Goal

Add a fresh bundle artifact reporting command that produces bundle-size evidence
from clean Electron renderer, WebUI, and Viewer build outputs.

## Scope

- Add a Bun script that removes only the relevant build output directories:
  `apps/electron/dist/renderer`, `apps/webui/dist`, and `apps/viewer/dist`.
- Rebuild Electron renderer, WebUI, and Viewer with existing package scripts.
- Run the existing `report:bundle-artifacts` script after those builds.
- Add a package script entry for the fresh report command.
- Preserve the current non-fatal behavior for bundle-size warnings.

## Out of scope

- Rechunking or code-splitting bundles.
- Changing Vite production config.
- Changing runtime UI behavior.
- Cleaning packaged release artifacts.
- Signing, notarization, ASAR, or release upload.

## Constraints

- Follow worklog-first and red-before-implementation flow.
- Use existing dependencies only.
- Keep cleanup scoped to generated build output directories.
- Keep package/lock dependency files stable.

## Validation Commands

- `bun run report:bundle-artifacts:fresh`
- `git diff --check`
- `git status --short -- package.json bun.lock apps/electron/package.json`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Worklog captures T092 stale-output risk before implementation | DONE |
| Fresh report command fails before implementation because it is missing | DONE |
| Script cleans only Electron renderer, WebUI, and Viewer output directories | DONE |
| Script rebuilds Electron renderer, WebUI, and Viewer before reporting | DONE |
| Existing `report:bundle-artifacts` remains the measurement source | DONE |
| Bundle-size warnings remain non-fatal | DONE |
| Focused validation passes | DONE |
| Package/lock dependency files remain stable except intended script entry | DONE |
| Worklog is complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T119-fresh-bundle-artifact-report.md`.
