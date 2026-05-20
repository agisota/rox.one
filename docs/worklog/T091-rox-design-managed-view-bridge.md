# T091 — Rox Design managed WebContentsView + full safe desktop bridge

## 1. Task summary
Replace the temporary Rox Design renderer iframe with an Electron-managed embedded view and complete the desktop bridge needed by Open Design when it runs inside ROX.ONE. Prepare and verify a real bundled Open Design runtime payload, then build/package/launch the app.

## 2. Repo context discovered
- Current branch: `feature/rox-design-integration` in `/Users/marklindgreen/Projects/rox-one-terminal-rox-design`.
- T090 already added the `design` route, top-bar entry, `RoxDesignRuntimeManager`, resource preparation script, and package resource declaration.
- `RoxDesignPage` embedded Open Design through a renderer `<iframe>` before this task; that was not enough for native desktop bridge control or sender verification.
- Preload exposed only `start/getStatus/stop/openExternal` before this task; Open Design desktop flows also need folder picker/import, trusted project open path, and PDF printing.
- Installed Open Design 0.7.0 is available at `/Applications/Open Design.app/Contents/Resources` and exposes daemon/web sidecars plus desktop bridge behavior in `app/prebundled/packaged-main.mjs`.
- Electron 39 exposes `WebContentsView`; `BrowserView` remains available as fallback for compatibility.
- The Open Design runtime payload is intentionally large (`251M`) because it contains the sidecars, standalone web output, runtime resources, and runtime `node_modules` needed to run without a separate user install.
- The payload is intentionally git-ignored and package-time bundled: source control stores the integration code and scripts, while `apps/electron/resources/rox-design/**` is local/package material.

## 3. Files inspected
- `AGENTS.md`
- `apps/electron/resources/AGENTS.md`
- `apps/electron/src/renderer/pages/rox-design/RoxDesignPage.tsx`
- `apps/electron/src/renderer/pages/rox-design/RoxDesignPage.rtl.test.tsx`
- `apps/electron/src/main/rox-design-runtime-manager.ts`
- `apps/electron/src/main/index.ts`
- `apps/electron/src/main/browser-pane-manager.ts`
- `apps/electron/src/main/window-manager.ts`
- `apps/electron/src/preload/bootstrap.ts`
- `apps/electron/src/shared/types.ts`
- `apps/electron/vite.config.ts`
- `scripts/electron-build-preload.ts`
- `scripts/electron-smoke-packaged-mac.ts`
- `scripts/electron-ui-smoke-packaged-mac.ts`
- `scripts/prepare-rox-design-runtime.ts`
- `/Applications/Open Design.app/Contents/Resources/app/prebundled/packaged-main.mjs`

## 4. Tests added first
- Updated `RoxDesignPage.rtl.test.tsx` so the running state requires a native host, calls `roxDesign.show`, and hides the native view on unmount.
- Added `rox-design-view-manager.test.ts` for bounds scaling/sanitizing and same-origin navigation policy.
- Added `rox-design-desktop-bridge.test.ts` for desktop bridge URL validation, open-path trust policy, and import-token signing format.
- Added `vite-manual-chunks.test.ts` to prevent broad `react` substring chunk matching from breaking renderer startup.
- Extended packaged smoke coverage to assert the bundled Rox Design payload exists, is not duplicated, and can start daemon/web sidecars from inside the `.app`.

## 5. Expected failing test output
Initial pre-implementation failures were expected and observed while the code was still missing or still iframe-based:
- missing `rox-design-view-manager` module;
- missing `rox-design-desktop-bridge` module;
- `RoxDesignPage` rendered iframe instead of calling `roxDesign.show`/`hide`;
- packaged smoke failed when the payload was incomplete or duplicated;
- packaged runtime smoke failed until `app/node_modules` was included (`blake3-wasm`/native deps).

## 6. Implementation changes
- Replaced renderer iframe embedding with main-process managed native view embedding:
  - primary: `WebContentsView`;
  - fallback: `BrowserView`.
- Added `RoxDesignViewManager`:
  - creates one managed native view per host window;
  - loads only `http(s)` Rox Design URLs;
  - attaches/hides/destroys view lifecycle with the host window;
  - keeps bounds synced to the renderer host rectangle;
  - allows same-origin navigation and externalizes cross-origin `window.open`/navigation via `shell.openExternal`.
- Added `RoxDesignPage` native host behavior:
  - starts runtime lazily;
  - requests native view show after runtime returns `webUrl`;
  - uses `ResizeObserver`, window resize, and scroll sync to keep bounds correct;
  - hides the native view on unmount;
  - keeps ROX-native loading/error chrome around Rox Design.
- Added sandboxed Rox Design preload bridge:
  - exposes desktop-compatible `electronAPI`/`__odDesktop` surface;
  - no Node integration in the embedded renderer;
  - `contextIsolation`, `sandbox`, and `webviewTag: false` for the managed view.
- Added `RoxDesignDesktopBridge`:
  - `openExternal` with `http/https` validation;
  - safe folder picker;
  - `pickAndImport` posts to daemon `/api/import/folder` with signed desktop import token;
  - `openPath` resolves by `projectId` through the daemon and rejects untrusted base-dir projects;
  - `printPdf` uses an isolated hidden print window and print-ready handshake.
- Added main-process sender verification:
  - `rox-design-bridge:*` IPC handlers only accept senders that belong to the managed Rox Design webContents.
- Extended runtime packaging:
  - copied `open-design-config.json`, `app/prebundled`, `app/node_modules`, `open-design`, and `open-design-web-standalone` into `apps/electron/resources/rox-design`;
  - added `MANIFEST.json` (`schema=rox-design-runtime-manifest.v1`, `version=0.7.0`);
  - included the payload in `electron-builder.yml`;
  - added `afterPack` duplicate guard/removal for `Contents/Resources/app/dist/resources/rox-design`.
- Stabilized build/smoke harnesses:
  - exact React manual chunk matching to avoid renderer startup crash;
  - packaged smoke sidecar stamp source set to `packaged`;
  - smoke Unix socket base shortened to `/tmp/roxod-smoke-*`;
  - UI smoke waits for route restore and composer readiness before clicking;
  - test timeout raised to 120s for slower isolated/unit suites.

## 7. Validation commands run
- `bun test scripts/__tests__/electron-smoke.test.ts apps/electron/src/renderer/__tests__/vite-manual-chunks.test.ts`
  - log: `/tmp/rox-focused-smoke-tests-20260519152607.log`
- `bun run typecheck:all`
  - log: `/tmp/rox-typecheck-all-20260519152623.log`
- `bun run lint`
  - log: `/tmp/rox-lint-20260519152809.log`
- `bun run test:units`
  - log: `/tmp/rox-test-units-20260519152856.log`
- `bun run build`
  - log: `/tmp/rox-build-20260519150626.log`
- `bun run electron:dist:dev:mac:arm64`
  - log: `/tmp/rox-electron-dist-dev-mac-arm64-20260519150713.log`
- `bun run electron:smoke:packaged:mac`
  - log: `/tmp/rox-packaged-smoke-20260519151514.log`
- `bun run electron:ui-smoke:packaged:mac`
  - log: `/tmp/rox-ui-smoke-packaged-20260519152432.log`
  - evidence: `/Users/marklindgreen/.ai-agent-hub/evidence/playwright-smoke/rox-one-ui-smoke-2026-05-19T12-24-32-402Z`
- `ROX_RC_MODE=unsigned ROX_ARTIFACT_PLATFORM=mac ROX_ARTIFACT_ARCH=arm64 bun run validate:packaged-artifacts`
  - log: `/tmp/rox-validate-packaged-artifacts-20260519153356.log`
- `git diff --check`
- `git check-ignore -v apps/electron/resources/rox-design/MANIFEST.json apps/electron/vendor/bun/bun`
- Visible launch:
  - `open -n -a apps/electron/release/mac-arm64/ROX.ONE.app --args --user-data-dir=/tmp/rox-visible-launch-20260519153513/user-data`
  - verified process: PID `97611`, executable `/Users/marklindgreen/Projects/rox-one-terminal-rox-design/apps/electron/release/mac-arm64/ROX.ONE.app/Contents/MacOS/ROX.ONE`

## 8. Passing test output summary
- Focused smoke/manual-chunk tests:
  - `7 pass`, `0 fail`, `23 expect() calls`, `Ran 7 tests across 2 files`.
- Full unit suite:
  - `6981 pass`, `0 fail`, `Ran 6994 tests across 580 files`.
  - isolated post-suite groups also passed: `7/0`, `34/0`, `70/0`, `2/0`, `3/0`, `3/0`.
- Typecheck:
  - `typecheck:all` completed across `core`, `shared`, `audit`, `server-core`, `server`, `session-tools-core`, `apps/electron`, and `packages/ui`.
- Lint:
  - `0 errors`, `7 warnings`.
  - warnings are pre-existing/unrelated lint debt in `deep-link.ts`, `FreeFormInput.tsx`, several RTL tests, and settings page eslint disables.
- Packaged smoke:
  - `Rox Design payload ok: version=0.7.0` from `.app` resources.
  - `Rox Design runtime sidecars started: daemon=<dynamic> web=<dynamic>`.
  - `ROX.ONE packaged headless startup passed`.
- Packaged UI smoke:
  - `account tabs/forms OK`.
  - `experience six-tab navigation OK`.
  - `composer primary and overflow actions OK`.
  - `packaged ROX.ONE UI smoke passed`.

## 9. Build output summary
- `bun run build` passed; Vite emitted existing large-chunk warnings only.
- Electron resources copied successfully, including SDK and bundled resources.
- `bun run electron:dist:dev:mac:arm64` passed.
- Packaged artifacts produced:
  - `apps/electron/release/ROX-ONE-arm64.dmg` — `330836024 bytes` (`315.51 MB`), SHA256 `f8fcb3224e3dfa0b699ee75f4d4e0fe5c004c320f6c3155a84a04208720d49d6`.
  - `apps/electron/release/ROX-ONE-arm64.zip` — `324100663 bytes` (`309.09 MB`), SHA256 `85035cd07a0b0d235bf23fbdd7c6add2af5b03919d40a90990ee82176f136d2d`.
  - `.blockmap` files present for both DMG and ZIP.
- Packaged `.app` contains Rox Design payload at:
  - `apps/electron/release/mac-arm64/ROX.ONE.app/Contents/Resources/app/resources/rox-design` (`251M`).
- Duplicate payload location is absent:
  - `apps/electron/release/mac-arm64/ROX.ONE.app/Contents/Resources/app/dist/resources/rox-design`.
- The built `.app` launched visibly as a separate process from the release path using isolated user data.

## 10. Remaining risks
- Manual in-window end-to-end creation/import/PDF export inside Rox Design was not fully walked through by hand after launch; the bridge paths are unit-tested and packaged sidecars are smoke-tested, but the complete interactive Open Design workflow remains the next manual QA item.
- The local Open Design runtime payload is git-ignored and must be regenerated on a clean machine or CI before packaging. Use `bun run rox-design:prepare -- --force` (added in checkpoint 13 below); a packaging preflight `bun run rox-design:payload:verify` is wired into every `electron:dist*` entry to fail fast when the payload is absent.
- Unsigned/dev mac packaging was validated; notarized release signing was not part of this task.
- Existing lint warnings remain intentionally unchanged.
- The built release app is currently launchable from `apps/electron/release/mac-arm64/ROX.ONE.app`; installed `/Applications/ROX ONE.app` is separate and was not replaced by this task.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| iframe removed from Rox Design renderer | Pass | `RoxDesignPage.tsx` renders `data-testid="rox-design-native-host"` and calls `roxDesign.show`; no iframe remains. |
| Electron-managed `WebContentsView` used with `BrowserView` fallback | Pass | `RoxDesignViewManager` chooses `WebContentsView` when available and `BrowserView` fallback otherwise. |
| Native view bounds follow Rox Design page host | Pass | Renderer sync uses `ResizeObserver`/resize/scroll; policy tests cover sanitize/scale. |
| Safe bridge covers external URL, picker/import, project open path, print PDF | Pass | `RoxDesignDesktopBridge` implements all four areas and has unit tests for validation/trust/token behavior. |
| Bridge calls are accepted only from managed Rox Design webContents | Pass | Main IPC handlers call `requireRoxDesignManagedWebContents`; unmanaged senders throw. |
| Real Open Design runtime payload copied into package resources | Pass (machine-local on 2026-05-19) | Payload manifest version `0.7.0`; local and packaged payload size `251M`. Reproducibility on clean checkout was hardened later in checkpoint 13 (`rox-design:prepare` + `rox-design:payload:verify`). |
| Unit/RTL/typecheck/lint/build pass or blockers documented | Pass | `test:units`, focused tests, `typecheck:all`, `lint`, and `build` passed; lint warnings documented. |
| Packaged smoke verifies embedded payload | Pass | `/tmp/rox-packaged-smoke-20260519151514.log` validates payload and starts daemon/web sidecars from `.app`. |
| Packaged UI smoke passes | Pass | `/tmp/rox-ui-smoke-packaged-20260519152432.log` plus Playwright evidence directory. |
| Packaged artifacts validate | Pass | `/tmp/rox-validate-packaged-artifacts-20260519153356.log` validates DMG/ZIP/blockmaps and SHA256. |
| Built app launches | Pass | Release `.app` running as PID `97611` with isolated user data. |

## 12. Checkpoint — T091-visual-native-02 (2026-05-19)

### Latest change label
- **T091-visual-native-02** — ROX dark embedded skin and compact scale for Rox Design.

### What changed in this checkpoint
- Added `apps/electron/src/main/rox-design-embed-skin.ts`:
  - injects ROX dark design tokens into the managed Open Design surface;
  - relabels visible `Open Design` copy to `Rox Design` in embedded mode;
  - hides duplicate Open Design app chrome/header so the ROX window remains the only shell;
  - restyles entry tabs, create tabs, cards, template cards, settings sections, forms, workspace panels, side navigation, and empty/error states for the ROX dark theme;
  - sets compact content zoom by host width (`0.60`, `0.64`, `0.68`) so the embedded app fits inside the ROX pane without manual zoom-out;
  - suppresses Open Design privacy-consent chrome in embedded mode and writes an embedded opt-out config.
- Updated `RoxDesignViewManager` to:
  - apply the embedded skin on `dom-ready` and `did-finish-load`;
  - use Electron-managed content zoom instead of asking users to zoom out;
  - reset/reapply CSS on navigation;
  - use the ROX dark background before the web app paints.
- Updated `RoxDesignRuntimeManager` embedded URL params to force `theme=dark` and `lang=ru`.
- Extended packaged UI smoke to verify:
  - no iframe-based embedding;
  - ROX embed markers and dark tokens are present;
  - zoom is compact (`<= 0.68`);
  - duplicate Open Design chrome and privacy banner are absent;
  - screenshots cover top tabs and create tabs.

### Validation run after this checkpoint
- `bun test apps/electron/src/main/__tests__/rox-design-view-manager.test.ts`
  - log: `/tmp/rox-design-view-manager-test-20260519181709.log`
  - result: `6 pass`, `0 fail`, `32 expect() calls`.
- `bun run typecheck:electron`
  - log: `/tmp/rox-typecheck-electron-20260519181722.log`
  - result: passed (`tsc --noEmit` emitted no errors).

### Where work stopped / interruption point
- I stopped immediately after landing the visual skin/scale/privacy suppression layer and re-running the targeted unit test plus Electron typecheck.
- The next intended step was to rebuild the packaged `.app` so this newest skin/privacy patch is included, then rerun packaged UI smoke with a fresh evidence directory and inspect the screenshots.
- This checkpoint is intentionally committed as a restorable branch state before the final rebuild/smoke/launch pass.

### Restore commands for a fresh VPS/session
```bash
git clone https://github.com/agisota/rox-one-terminal.git
cd rox-one-terminal
git fetch origin codex/rox-design-native-skin-checkpoint-20260519
git checkout codex/rox-design-native-skin-checkpoint-20260519
bun install
bun test apps/electron/src/main/__tests__/rox-design-view-manager.test.ts
bun run typecheck:electron
# then continue with:
bun run electron:dist:dev:mac:arm64
EVID="$HOME/.ai-agent-hub/evidence/playwright-smoke/rox-design-visual-final-$(date +%Y%m%d%H%M%S)" \
ROX_UI_SMOKE_EVIDENCE_DIR="$EVID" bun run electron:ui-smoke:packaged:mac
```

### Remaining after checkpoint
- Rebuild packaged app with the latest skin/privacy changes.
- Rerun packaged UI smoke and inspect fresh screenshots for every Rox Design tab.
- Run broader gates if time allows: `bun run typecheck:all`, `bun run lint`, `bun run electron:smoke:packaged:mac`.
- Launch the rebuilt `.app` visibly and capture final evidence.

## 13. Checkpoint — T091-packaging-reproducibility-recon (2026-05-20)

### Reason for this checkpoint
The §11 acceptance matrix recorded the Open Design payload step as `Pass` based on the worklog author's local machine, where `/Applications/Open Design.app/Contents/Resources` was available and the payload had been hand-copied into `apps/electron/resources/rox-design/`. On a clean checkout the payload directory is empty (only `README.md` is committed), there was no discoverable `package.json` script that wraps `scripts/prepare-rox-design-runtime.ts`, and electron-builder would happily package a hollow payload — producing a `.app` whose Rox Design tab is broken at launch with no early signal. This checkpoint closes that reproducibility gap without retroactively invalidating the original evidence.

### What changed in this checkpoint
- `package.json`:
  - Added `rox-design:prepare` → `bun run scripts/prepare-rox-design-runtime.ts` (passes through `-- --force` / `-- --check`).
  - Added `rox-design:prepare:check` → source-side `--check` (validates `ROX_DESIGN_SOURCE_RESOURCES`).
  - Added `rox-design:payload:verify` → target-side preflight (new script below).
  - Prepended `bun run rox-design:payload:verify &&` to every `electron:dist*` script (`electron:dist`, `electron:dist:{mac,win,linux}`, and the `:dev` variants).
- `scripts/check-rox-design-runtime-payload.ts` (new):
  - Validates `apps/electron/resources/rox-design/MANIFEST.json` matches schema `rox-design-runtime-manifest.v1` and has a `version`.
  - Validates the same `REQUIRED_PATHS` set that `prepare-rox-design-runtime.ts` requires at the source, applied to the target.
  - Emits actionable next-step instructions and a `ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY=1` bypass for dev smokes that intentionally skip the runtime payload.
- `scripts/electron-dist-dev-mac-arm64.ts`:
  - Calls `bun run rox-design:payload:verify` as the first step (before `downloadBun` and `electron:build`) so the gate fails fast on a clean machine.
- `.gitignore`:
  - Added `apps/electron/resources/rox-design/*` with a `!apps/electron/resources/rox-design/README.md` negation so the bootstrap doc stays committed but the generated payload (incl. `MANIFEST.json`, `app/`, `open-design/`, `open-design-web-standalone/`) is never accidentally committed.

### Validation
- `bun run rox-design:payload:verify` against an empty target (clean checkout state) — exits with code `1` and prints the prepare command and bypass instructions; verified inline during this session.
- `ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY=1 bun run rox-design:payload:verify` — exits `0` with a SKIPPED warning; verified inline.
- `git check-ignore -v apps/electron/resources/rox-design/MANIFEST.json` — matches `.gitignore` line, confirming generated payload is ignored.
- `git check-ignore -v apps/electron/resources/rox-design/README.md` — no match, confirming the README stays committed.

### Updated restore commands for a fresh VPS/session
```bash
git clone https://github.com/agisota/rox-one-terminal.git
cd rox-one-terminal
git checkout feat/rox-design-clean
bun install

# Prepare the Open Design runtime payload (must point at Open Design 0.7.0 resources):
ROX_DESIGN_SOURCE_RESOURCES="/Applications/Open Design.app/Contents/Resources" \
  bun run rox-design:prepare -- --force

# Confirm the packaging preflight is happy before triggering electron-builder:
bun run rox-design:payload:verify

# Then build/package:
bun run electron:dist:dev:mac:arm64
EVID="$HOME/.ai-agent-hub/evidence/playwright-smoke/rox-design-visual-final-$(date +%Y%m%d%H%M%S)" \
  ROX_UI_SMOKE_EVIDENCE_DIR="$EVID" bun run electron:ui-smoke:packaged:mac
```

### Boundaries / what this checkpoint does NOT do
- It does not change any runtime code in `apps/electron/src/main/rox-design-*` or `RoxDesignPage`.
- It does not re-run packaged UI/headless smoke on this Linux host — Open Design 0.7.0 ships only as a macOS app, so the payload cannot be prepared from this workstation. Linux/Windows packaging paths inherit the same preflight but require a macOS or vendor-distributed payload archive to be staged before packaging (`ROX_DESIGN_SOURCE_RESOURCES` accepts any directory with the same layout).
- It does not change the §11 acceptance matrix verdicts beyond a clarifying note on the payload-copy row — the original packaged smoke evidence on the author's machine remains valid for that machine.
