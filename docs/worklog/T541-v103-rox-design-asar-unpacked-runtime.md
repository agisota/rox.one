# T541 - v1.0.3 Rox Design ASAR-unpacked runtime path

## 1. Task Summary

Investigate and fix the v1.0.3 packaged Rox Design runtime path mismatch.

## 2. Repo Context Discovered

- v1.0.3 installed from `ROX-ONE-arm64.zip` starts in headless packaged smoke.
- Installed app has Rox Design payload under
  `/Applications/ROX.ONE.app/Contents/Resources/app.asar.unpacked/resources/rox-design`.
- `RoxDesignRuntimeManager` is constructed with packaged `resourcesRoot` equal
  to `process.resourcesPath/app`.
- The current runtime candidates do not include the sibling
  `app.asar.unpacked/resources/rox-design` path.
- Manual CDP probe against the installed v1.0.3 app returned:
  `Rox Design runtime is not bundled yet. Expected Open Design resources under /Applications/ROX.ONE.app/Contents/Resources/app/resources/rox-design.`

## 3. Files Inspected

- `apps/electron/src/main/index.ts`
- `apps/electron/src/main/rox-design-runtime-manager.ts`
- `apps/electron/src/main/__tests__/rox-design-runtime-manager.test.ts`
- `scripts/validate-packaged-artifacts.ts`
- `scripts/__tests__/validate-packaged-artifacts.test.ts`
- `apps/electron/electron-builder.yml`

## 4. Tests Added First

- Added runtime-manager regression coverage for a packaged
  `Contents/Resources/app` resources root with Rox Design stored at sibling
  `Contents/Resources/app.asar.unpacked/resources/rox-design`.
- Added packaged-artifact validator coverage for missing external Rox Design
  payload under `app.asar.unpacked`.

## 5. Expected Failing Test Output

- `bun test apps/electron/src/main/__tests__/rox-design-runtime-manager.test.ts`
  initially failed the new ASAR-unpacked case with:
  `status: failed` and
  `Rox Design runtime is not bundled yet. Expected Open Design resources under .../app/resources/rox-design.`
- `bun test scripts/__tests__/validate-packaged-artifacts.test.ts` initially
  failed the new missing-payload case because the validator exited with status
  `0` instead of rejecting the incomplete Mac fixture.

## 6. Implementation Changes

- `RoxDesignRuntimeManager.findBundledRuntimeLayout()` now probes
  `${resourcesRoot}.asar.unpacked/resources/rox-design` in addition to the
  existing explicit/dev/resource-root candidates.
- `validate-packaged-artifacts.ts` now requires the Mac release fixture to
  include the externalized Rox Design payload under
  `mac-${macArch}/ROX.ONE.app/Contents/Resources/app.asar.unpacked/resources/rox-design`.
- The Mac validator checks for the config, bundled node binary, daemon sidecar,
  daemon CLI, and web sidecar entrypoint.
- Electron main now passes a persistent Rox Design data directory under
  `app.getPath('userData')/rox-design`.
- `RoxDesignRuntimeManager` now falls back to a temp data directory instead of
  writing `.rox-design-data` under the bundled runtime root when no caller
  supplies `dataRoot`.

## 7. Validation Commands Run

- `ROX_MAC_APP_PATH=/Applications/ROX.ONE.app bun run electron:smoke:packaged:mac`
- `ROX_MAC_APP_PATH=/Applications/ROX.ONE.app ROX_UI_SMOKE_EVIDENCE_DIR=/tmp/rox-one-v1.0.3-release/ui-smoke bun run electron:ui-smoke:packaged:mac`
- Manual CDP Rox Design start probe against `/Applications/ROX.ONE.app`
- `bun test apps/electron/src/main/__tests__/rox-design-runtime-manager.test.ts`
- `bun test scripts/__tests__/validate-packaged-artifacts.test.ts`
- `bun install --frozen-lockfile`
- `bun run typecheck:electron`
- `bun run validate:mac-arm-build-workflow`
- `bun run validate:ci-contract`
- `bun run typecheck:all`

## 8. Passing Test Output Summary

- Runtime manager targeted suite: `9 pass, 0 fail, 21 expect() calls`.
- Packaged artifact validator targeted suite: `23 pass, 0 fail, 67 expect() calls`.
- Electron typecheck passed after hydrating dependencies with
  `bun install --frozen-lockfile`.
- Mac ARM workflow contract validator passed after aligning the minimum system
  version contract to `12.0`.
- CI contract validator passed after adding the CircleCI Rox Design payload
  preparation guard.
- Full workspace typecheck passed.
- Installed v1.0.3 headless packaged smoke passed.
- Installed v1.0.3 full UI smoke passed with evidence in
  `/tmp/rox-one-v1.0.3-release/ui-smoke`.
- Installed v1.0.3 Rox Design start failed before the path workaround, then
  passed after a local symlink mapped
  `Contents/Resources/app/resources/rox-design` to
  `Contents/Resources/app.asar.unpacked/resources/rox-design`.
- That installed-app probe also showed v1.0.3 sidecars writing
  `.rox-design-data/app.sqlite*` inside `app.asar.unpacked`, invalidating the
  sealed bundle. The hotfix keeps mutable Rox Design data outside the app
  bundle.
- `release-notes.json` was regenerated from
  `apps/electron/resources/release-notes/1.0.3.ru.md`, validated with
  `scripts/validate-release-notes-feed.ts`, uploaded to GitHub Release v1.0.3,
  and verified live through `https://app.rox.one/electron/stable/release-notes.json`.
- PR #368 initially failed CircleCI `mac-arm-build` because
  `scripts/validate-mac-arm-build-workflow.ts` still enforced the older
  Sonoma-only `minimumSystemVersion: "14.0"` contract. The validator has been
  realigned to the current Monterey/Ventura-compatible `12.0` release floor.
- The next CircleCI `mac-arm-build` reached packaging and failed because it did
  not prepare the Rox Design payload before `electron:dist:dev:mac:arm64`.
  `.circleci/config.yml` now prepares the SHA-pinned payload from
  `runtime-payload-versions.json`, and `validate-ci-contract` guards that step.
- The following CircleCI `mac-arm-build` reached packaged-artifact validation
  and failed because the unsigned/dev package was validated in signed mode.
  CircleCI and the standalone Mac ARM workflow now set
  `ROX_RC_MODE=unsigned`, `ROX_ARTIFACT_PLATFORM=mac`, and
  `ROX_ARTIFACT_ARCH=arm64` for that validation step.

## 9. Build Output Summary

- No rebuilt app artifact has been produced from this hotfix branch yet. The
  change is covered by targeted unit/validator tests and by the installed-app
  symlink proof that the packaged payload itself is usable.

## 10. Remaining Risks

- macOS public distribution remains unsigned/not notarized unless a separate
  signed/notarized release path is used.
- v1.0.3 GitHub release is already public; a fixed artifact likely needs a new
  tag/release rather than mutating installed users in place.
- The live v1.0.3 release notes/feed has been corrected, but the public binary
  still needs the ASAR-unpacked path and writable-data fixes in a new patch
  artifact.

## 11. Acceptance Criteria Matrix

| Criteria | Status |
|---|---|
| Runtime manager finds ASAR-unpacked Rox Design payload | Done |
| Packaged artifact validator catches missing external payload | Done |
| Targeted tests pass | Done |
| Installed app Rox Design start probe passes on fixed build | Not rebuilt yet; installed payload passed with local path workaround |
