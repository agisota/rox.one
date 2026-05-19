# T090 — Rox Design embedded v1 runtime

## 1. Task summary

Implement the first safe slice of the ROX One + Open Design merge plan: make `Rox Design` a first-class in-app route, expose top-bar/side-nav entries, render a ROX-native embedded page, and add main-process control that can start a bundled Open Design daemon + web sidecar without opening a second Open Design desktop app.

This task is still **product-merge v1**, not a full React/Next code merge. The Open Design UI remains isolated behind an embedded web surface. ROX owns navigation, entry points, loading/error states, IPC, lifecycle, and process cleanup.

## 2. Repo context discovered

- Repository: `/Users/marklindgreen/Projects/rox-one-terminal-rox-design` on branch `feature/rox-design-integration`.
- ROX desktop is Electron + React/Vite + Bun.
- Navigation is centralized in `apps/electron/src/shared/routes.ts`, `apps/electron/src/shared/route-parser.ts`, and `apps/electron/src/shared/types.ts`.
- The renderer shell composes `TopBar`, `AppShell`, `PanelStackContainer`, and `MainContentPanel`.
- Existing embedded web surfaces use browser-pane management with browser chrome. Rox Design should be entered as a product surface, not as a normal browser tab.
- Main/preload currently expose most APIs through WS RPC, with direct local IPC used for app-local capabilities such as relaunch and dialogs. Rox Design runtime control is app-local and uses direct IPC for this first slice.
- Installed Open Design 0.7.0 at `/Applications/Open Design.app/Contents/Resources` contains:
  - `open-design-config.json`
  - `app/prebundled/daemon/daemon-sidecar.mjs`
  - `app/prebundled/web-sidecar.mjs`
  - `open-design/bin/node`
  - `open-design/skills`, `open-design/design-systems`, `open-design/design-templates`, `open-design/prompt-templates`, `open-design/frames`
  - `open-design-web-standalone/apps/web/server.js`
- In this checkout, committed Open Design runtime resources are not present yet. The manager therefore supports both:
  - development URL via `ROX_DESIGN_WEB_URL=https://rox-design-dev.t`;
  - packaged/runtime root via bundled `resources/rox-design` or `ROX_DESIGN_RUNTIME_ROOT`.

## 3. Files inspected

- `AGENTS.md`
- `package.json`
- `apps/electron/package.json`
- `apps/electron/electron-builder.yml`
- `apps/electron/resources/release-notes/next.md`
- `apps/electron/src/shared/types.ts`
- `apps/electron/src/shared/routes.ts`
- `apps/electron/src/shared/route-parser.ts`
- `apps/electron/src/shared/__tests__/route-parser-workbench.test.ts`
- `apps/electron/src/shared/__tests__/route-parser-automations.test.ts`
- `apps/electron/src/renderer/contexts/NavigationContext.tsx`
- `apps/electron/src/renderer/atoms/panel-stack.ts`
- `apps/electron/src/renderer/components/app-shell/TopBar.tsx`
- `apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- `apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx`
- `apps/electron/src/preload/bootstrap.ts`
- `apps/electron/src/main/index.ts`
- `apps/electron/src/main/browser-pane-manager.ts`
- `packages/shared/src/protocol/channels.ts`
- `apps/electron/src/transport/channel-map.ts`
- `/Applications/Open Design.app/Contents/Resources/open-design-config.json`
- `/Applications/Open Design.app/Contents/Resources/app/prebundled/daemon/daemon-sidecar.mjs`
- `/Applications/Open Design.app/Contents/Resources/app/prebundled/web-sidecar.mjs`

## 4. Tests added first

Added before implementation:

- `apps/electron/src/shared/__tests__/route-parser-design.test.ts`
  - route/parser regression for `design` route roundtrip.
- `apps/electron/src/renderer/atoms/__tests__/panel-stack-design.test.ts`
  - panel-stack classification test for design panel type.
- `apps/electron/src/main/__tests__/rox-design-runtime-manager.test.ts`
  - missing bundled runtime behavior.
  - incomplete bundled runtime behavior.
  - external development web URL behavior.
  - mocked bundled daemon + web sidecar launch behavior.
  - explicit runtime root behavior.
- `apps/electron/src/renderer/pages/rox-design/RoxDesignPage.rtl.test.tsx`
  - recoverable missing bridge/runtime UI.
  - iframe shell for a running development web URL.

## 5. Expected failing test output

Before code changes, the new tests should fail because:

- `routes.view.design` does not exist.
- `parseCompoundRoute('design')` returns `null`.
- `NavigationState` has no `design` navigator.
- `RoxDesignRuntimeManager` and `RoxDesignPage` do not exist.
- `window.electronAPI.roxDesign` is not exposed by preload.
- No main-process manager can parse Open Design config, spawn sidecars, or return `daemonUrl`/`webUrl`.

## 6. Implementation changes

- Added first-class `design` navigation:
  - `routes.view.design()` returns `design`.
  - route parser converts `design` to `{ navigator: 'design' }` and back.
  - navigation key serialization supports `design`.
  - panel stack classifies `design` as a dedicated panel type.
- Added renderer entry points:
  - top-bar `Rox Design` button.
  - `Rox Design` item in the `+` menu.
  - `Rox Design` item in the left navigation rail.
  - right/sidebar explanatory card for the design surface.
- Added `RoxDesignPage`:
  - shows ROX-native loading state.
  - starts the runtime via `window.electronAPI.roxDesign.start()`.
  - shows a recoverable error if the bridge/runtime is unavailable.
  - embeds a returned `webUrl` with `embed=rox&theme=system&lang=ru` already applied by main.
  - keeps the external-open button development-only (`version === 'dev'`) so packaged users stay inside ROX.
  - guards optional `window.electronAPI` so non-Electron test/render contexts fail gracefully.
- Added `RoxDesignRuntimeManager` in the main process:
  - tracks `idle | starting | running | failed`.
  - supports `ROX_DESIGN_WEB_URL` for development.
  - supports `ROX_DESIGN_RUNTIME_ROOT` for local/packaged runtime root testing.
  - detects `open-design-config.json` and resolves Open Design node, daemon, daemon CLI, web sidecar, resource root, and standalone web root.
  - starts the Open Design daemon sidecar on an ephemeral port.
  - starts the Open Design web sidecar on an ephemeral port and proxies daemon API paths through the web sidecar.
  - appends ROX embed params while preserving URL shape.
  - uses short `/tmp/roxod-*` Unix socket paths to stay below macOS socket path limits.
  - returns `daemonUrl`, `webUrl`, and version.
  - stops web/daemon child processes and removes IPC files on `stop()` / app quit.
  - reports absent or incomplete runtime bundles as recoverable failures instead of throwing through IPC.
- Added direct IPC bridge in main/preload:
  - `roxDesign.start`
  - `roxDesign.getStatus`
  - `roxDesign.stop`
  - `roxDesign.openExternal`
- Added pending release-note entry for the new user-visible Rox Design surface.
- Added packaged resource include and preparation surface:
  - `apps/electron/electron-builder.yml` includes `resources/rox-design/**/*`.
  - `scripts/prepare-rox-design-runtime.ts` validates/copies a pinned Open Design runtime payload into `apps/electron/resources/rox-design`.
  - `bun run rox-design:prepare -- --check` validates the local Open Design source without copying large files.
  - `.gitignore` keeps generated Rox Design runtime payloads out of git while preserving `apps/electron/resources/rox-design/README.md`.

## 7. Validation commands run

```bash
bun test apps/electron/src/main/__tests__/rox-design-runtime-manager.test.ts
bun run rox-design:prepare -- --check

ROX_DESIGN_RUNTIME_ROOT="/Applications/Open Design.app/Contents/Resources" \
  bun /tmp/test-rox-design-manager.ts
```

Earlier scaffold validation also covered:

```bash
bun test apps/electron/src/shared/__tests__/route-parser-design.test.ts \
  apps/electron/src/renderer/atoms/__tests__/panel-stack-design.test.ts \
  apps/electron/src/main/__tests__/rox-design-runtime-manager.test.ts

bun run test:rtl -- src/renderer/pages/rox-design/RoxDesignPage.rtl.test.tsx
bun run typecheck:electron
bun run typecheck:all
bun run lint
bun run build
npx playwright install chromium
bun run test:units
```

Final validation rerun:

```bash
bun test apps/electron/src/shared/__tests__/route-parser-design.test.ts \
  apps/electron/src/renderer/atoms/__tests__/panel-stack-design.test.ts \
  apps/electron/src/main/__tests__/rox-design-runtime-manager.test.ts

bun run test:rtl -- src/renderer/pages/rox-design/RoxDesignPage.rtl.test.tsx
bun run rox-design:prepare -- --check
bun /tmp/test-rox-design-manager.ts
bun run typecheck:all
bun run lint
bun run build
git diff --cached --check
```

## 8. Passing test output summary

Final targeted route/panel/runtime test:

- `12 pass`, `0 fail`, `20 expect() calls`.

Current runtime-manager targeted test inside that run:

- `5 pass`, `0 fail`, `11 expect() calls`.

Runtime preparation check:

- `bun run rox-design:prepare -- --check` passed against `/Applications/Open Design.app/Contents/Resources`.
- Detected Open Design version: `0.7.0`.

Actual installed Open Design 0.7.0 sidecar proof via `ROX_DESIGN_RUNTIME_ROOT`:

- daemon started and returned a local URL.
- web sidecar started and returned a local URL.
- manager returned `status: running`, `version: 0.7.0`, `daemonUrl`, and `webUrl` with `embed=rox&theme=system&lang=ru`.
- `/api/skills` through the web sidecar returned `skills=106`.
- `manager.stop()` terminated daemon/web sidecars; web standalone server exited via `SIGTERM`.

Final renderer/type/build state:

- Targeted renderer test: `3 tests passed` in `RoxDesignPage.rtl.test.tsx`.
- `bun run typecheck:all`: passed.
- `bun run lint`: passed with existing unrelated warnings only.
- `bun run build`: passed; emitted `RoxDesignPage-*.js`.
- `git diff --cached --check`: passed.

Earlier full-suite state:
- After installing Chromium for Playwright, full `bun run test:units` still exited `1` outside the Rox Design files:
  - `scripts/__tests__/validate-packaged-artifacts.test.ts` — unsigned Linux validation fixture expected exit `0`, got `1`.
  - `scripts/__tests__/validate-mac-boundary-fixtures.test.ts` — good mac boundary fixture expected exit `0`, got `1`.
  - `packages/audit/tests/runners/playwright-runner.test.ts` — `createPlaywrightRunner > launches a browser...` afterEach hook timeout; follow-up Playwright runner tests passed in the same file.

## 9. Build output summary

- `bun run build` passed in the earlier scaffold validation.
- Electron main, preload, renderer, resources, and assets were built.
- New renderer chunk emitted: `RoxDesignPage-*.js`.
- Existing build warnings remain:
  - Shiki dynamic import specifier warnings.
  - circular manual chunk warnings.
  - oversized chunk warnings.

## 10. Remaining risks

- This commit wires a bundled/runtime-root launcher, but does not commit the large Open Design runtime files into git. CI/release still needs a pinned Open Design artifact/submodule step that populates `resources/rox-design` or an equivalent packaged layout before building release artifacts.
- The current embedded web surface is still an iframe in the ROX renderer. The target architecture still calls for an Electron-managed embedded view/`WebContentsView` once the resource pipeline is stable.
- Safe desktop bridge operations (`pickAndImport`, `openPath`, `printPdf`) are not implemented yet; only `openExternal` exists, and it is hidden for packaged runtime UI.
- Provider/account synchronization remains intentionally out of scope for v1.
- Packaged app smoke with committed Open Design resources has not been run because the large runtime payload is not checked into this branch.
- Full `test:units` remains blocked by unrelated release-fixture and Playwright hook issues listed above.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---:|---|
| `design` route is first-class and roundtrips | Pass | `route-parser-design.test.ts` |
| Top bar has a `Rox Design` entry | Pass | `TopBar.tsx`, typecheck/build |
| `+` menu has a `Rox Design` entry | Pass | `TopBar.tsx`, typecheck/build |
| Left navigation can open `Rox Design` | Pass | `AppShell.tsx`, typecheck/build |
| Main content can render Rox Design page | Pass | `RoxDesignPage.rtl.test.tsx` |
| Missing runtime is explicit and recoverable | Pass | Runtime manager unit test + page retry test |
| Development Open Design URL can be embedded | Pass | `ROX_DESIGN_WEB_URL` runtime manager unit test |
| Bundled Open Design sidecars can be started by ROX main process | Pass | mocked runtime unit test + installed Open Design 0.7.0 proof |
| Open Design skills are visible through embedded web/daemon path | Pass | installed runtime proof: `/api/skills` returned `skills=106` |
| Packaged resources path is declared | Pass | `electron-builder.yml` includes `resources/rox-design/**/*` |
| Local resource preparation command exists | Pass | `bun run rox-design:prepare -- --check` |
| Existing behavior preserved | Partial | Targeted tests, lint, typechecks, build pass; full `test:units` has unrelated failures |
| Full release package includes pinned Open Design runtime | Not complete | Needs resource vendoring/pinning pipeline |
| BrowserView/WebContentsView replacement for iframe | Not complete | Next integration hardening step |
| Safe import/PDF/openPath bridge | Not complete | Next desktop-bridge step |
