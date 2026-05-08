# T119 - Fresh Bundle Artifact Report Worklog

## 1. Task summary

Add a repeatable fresh bundle artifact report command that cleans only generated
bundle output directories, rebuilds Electron renderer, WebUI, and Viewer, then
runs the existing bundle artifact report against those fresh outputs.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 21]
```

## 2. Repo context discovered

- All existing `docs/tickets/T*.md` files are `DONE`; T119 is the next new
  productionization slice.
- `bd ready` is unavailable in this checkout because no beads database exists.
- T092 added `scripts/report-bundle-artifacts.ts` and
  `report:bundle-artifacts` as read-only bundle evidence.
- T092 explicitly recorded that WebUI had multiple historical hashed
  `App-*.js` files in `dist/assets`, which can overstate a clean build
  footprint.
- `scripts/electron-build-renderer.ts` already removes
  `apps/electron/dist/renderer` before invoking Vite.
- WebUI and Viewer use Vite `dist` outputs; the fresh report should remove
  those generated directories before rebuilding.
- The existing bundle report should remain the measurement source so T119 adds
  freshness, not a second measurement implementation.

## 3. Files inspected

- `docs/tickets/T092-bundle-performance-budget.md`
- `docs/worklog/T092-bundle-performance-budget.md`
- `scripts/report-bundle-artifacts.ts`
- `scripts/electron-build-renderer.ts`
- `scripts/electron-clean.ts`
- `apps/electron/vite.config.ts`
- `apps/webui/vite.config.ts`
- `apps/viewer/vite.config.ts`
- `package.json`

## 4. Tests added first

Validation-first approach for this script slice:

- The red command is the intended package script:
  `bun run report:bundle-artifacts:fresh`.
- Before implementation, it should fail because no package script exists.
- After implementation, it should clean the target output directories, rebuild
  all three surfaces, and run the existing bundle report.

## 5. Expected failing test output

Red command before implementation:

```bash
bun run report:bundle-artifacts:fresh
```

Expected result: FAIL because `report:bundle-artifacts:fresh` is not defined in
`package.json`.

Actual result before implementation:

```text
error: Script not found "report:bundle-artifacts:fresh"
```

## 6. Implementation changes

- Added `scripts/report-fresh-bundle-artifacts.ts`.
- Added package script `report:bundle-artifacts:fresh`.
- The new script removes only:
  - `apps/electron/dist/renderer`
  - `apps/webui/dist`
  - `apps/viewer/dist`
- The script then runs, in order:
  - `bun run electron:build:renderer`
  - `bun run webui:build`
  - `bun run viewer:build`
  - `bun run report:bundle-artifacts`
- The existing `scripts/report-bundle-artifacts.ts` remains the only bundle
  measurement implementation.

## 7. Validation commands run

```bash
bun run report:bundle-artifacts:fresh
git diff --check
git status --short -- package.json bun.lock apps/electron/package.json
```

## 8. Passing test output summary

Fresh report command:

```text
[fresh-bundle-artifacts] cleaning generated bundle outputs
[fresh-bundle-artifacts] removed apps/electron/dist/renderer
[fresh-bundle-artifacts] removed apps/webui/dist
[fresh-bundle-artifacts] removed apps/viewer/dist
...
[bundle-artifacts] completed with size warnings only; warnings are non-fatal
[fresh-bundle-artifacts] fresh bundle artifact report complete
```

Final hygiene:

```text
git diff --check
```

Result: PASS with no output.

## 9. Build output summary

The fresh command rebuilt all three bundle surfaces successfully before running
the report.

Fresh measured baseline from `bun run report:bundle-artifacts:fresh`:

### Electron Renderer

- JS assets: `314` files, `18,416,517` bytes (`17.56 MB`)
- CSS assets: `2` files, `244,040` bytes (`238.32 KB`)
- Assets over 500 KB: `7`
- Largest JS assets:
  - `assets/index-BAXYIHFJ.js` - `5,427,091` bytes (`5.18 MB`)
  - `assets/main-CO1fmEtv.js` - `1,548,520` bytes (`1.48 MB`)
  - `assets/sonner-Du67EiLj.js` - `1,124,756` bytes (`1.07 MB`)
  - `assets/playground-BL3My7Oj.js` - `784,189` bytes (`765.81 KB`)

### WebUI

- JS assets: `305` files, `17,464,023` bytes (`16.65 MB`)
- CSS assets: `1` file, `243,600` bytes (`237.89 KB`)
- Assets over 500 KB: `5`
- Largest JS assets:
  - `assets/main-D-lZa4-l.js` - `5,524,759` bytes (`5.27 MB`)
  - `assets/App-BSfJFQzR.js` - `2,504,426` bytes (`2.39 MB`)
  - `assets/emacs-lisp-C9XAeP06.js` - `779,902` bytes (`761.62 KB`)

This confirms the stale-output risk from T092: WebUI's old read-only baseline
was `632` JS files / `158,242,602` bytes (`150.91 MB`), while a fresh build is
`305` JS files / `17,464,023` bytes (`16.65 MB`).

### Viewer

- JS assets: `304` files, `14,803,145` bytes (`14.12 MB`)
- CSS assets: `1` file, `124,691` bytes (`121.77 KB`)
- Assets over 500 KB: `4`
- Largest JS assets:
  - `assets/index-GqF0Vrx9.js` - `5,368,307` bytes (`5.12 MB`)
  - `assets/emacs-lisp-C9XAeP06.js` - `779,902` bytes (`761.62 KB`)
  - `assets/cpp-CofmeUqb.js` - `626,122` bytes (`611.45 KB`)

## 10. Remaining risks

- The fresh report proves a clean measurement path; it does not reduce the
  remaining large chunks.
- Bundle-size warnings remain non-fatal because the current clean baselines
  still exceed the 500 KB Vite warning threshold.
- The command rebuilds generated bundle outputs and therefore updates ignored
  `dist` files on disk; source/lock/package dependency files remain stable
  except for the intended `package.json` script entry.
- ASAR, signing, notarization, and packaged release artifacts remain outside
  this ticket.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Worklog captures T092 stale-output risk before implementation | Done | Sections 1-5 |
| Fresh report command fails before implementation because it is missing | Done | Section 5 |
| Script cleans only Electron renderer, WebUI, and Viewer output directories | Done | Sections 6 and 8 |
| Script rebuilds Electron renderer, WebUI, and Viewer before reporting | Done | Sections 6 and 9 |
| Existing `report:bundle-artifacts` remains the measurement source | Done | Section 6 |
| Bundle-size warnings remain non-fatal | Done | Sections 8-10 |
| Focused validation passes | Done | Sections 7-8 |
| Package/lock dependency files remain stable except intended script entry | Done | Section 10 |
| Worklog is complete | Done | Sections 1-10 |
| Scoped Lore commit exists | Done | This T119 Lore commit |
