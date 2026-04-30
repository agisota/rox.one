# T033 Mac ARM Build Workflow

## 1. Task summary

Add a repeatable ROX ONE macOS ARM64 build workflow that proves the Electron app can be typechecked, built, packaged as ARM64 DMG/ZIP, launched from the packaged `.app`, and uploaded from GitHub Actions.

## 2. Repo context discovered

- No `mise.toml` exists; the project uses root `package.json` scripts.
- Existing CI workflows cover validation and server checks, but no dedicated Mac ARM artifact workflow existed.
- `apps/electron/electron-builder.yml` defines macOS distribution targets, but calling `electron-builder --mac --arm64` alone still merged x64 targets from the base config during local testing.
- `scripts/electron-smoke.ts` verifies the dev Electron startup path with headless smoke markers. Packaged production builds disable `electron-log` console transport, so packaged smoke must use observable stdout server markers and clean process exit.

## 3. Files inspected

- `.github/workflows/validate.yml`
- `.github/workflows/validate-server.yml`
- `package.json`
- `apps/electron/electron-builder.yml`
- `apps/electron/scripts/build-dmg.sh`
- `scripts/electron-smoke.ts`
- `apps/electron/src/main/index.ts`
- `apps/electron/src/main/logger.ts`

## 4. Tests added first

- Added `scripts/validate-mac-arm-build-workflow.ts` before the workflow existed.
- Added `validate:mac-arm-build-workflow` package script.

## 5. Expected failing test output

Initial targeted validation failed for the expected missing workflow:

```text
$ bun run scripts/validate-mac-arm-build-workflow.ts
[mac-arm-build-workflow] missing .github/workflows/mac-arm-build.yml
```

Later packaged smoke exposed two implementation gaps:

```text
[packaged-smoke] ROX ONE packaged app exited with code 134
```

That was sandbox-specific. Running outside sandbox started the app but showed that the dev-only log marker is not emitted by packaged production builds:

```text
CRAFT_SERVER_URL=[REDACTED]
CRAFT_SERVER_TOKEN=[REDACTED]
[packaged-smoke] Missing startup markers: App initialized successfully
```

## 6. Implementation changes

- Added `.github/workflows/mac-arm-build.yml` on `macos-15-xlarge` with frozen install, workflow contract validation, typecheck, i18n parity, Electron build, ARM64 packaging, packaged smoke, dev Electron smoke, and artifact upload.
- Added `apps/electron/electron-builder.mac-arm64.yml` as an arm64 target contract fixture.
- Added `scripts/electron-dist-dev-mac-arm64.ts` to generate a full arm64-only electron-builder config, use a workspace-local electron-builder cache, disable signing discovery for dev artifacts, and call the local `node_modules/.bin/electron-builder`.
- Added `scripts/electron-smoke-packaged-mac.ts` to launch `apps/electron/release/mac-arm64/ROX ONE.app` headlessly, redact server URL/token output, require the server URL marker, and require clean exit.
- Added root scripts:
  - `validate:mac-arm-build-workflow`
  - `electron:dist:dev:mac:arm64`
  - `electron:smoke:packaged:mac`

## 7. Validation commands run

```text
bun run validate:mac-arm-build-workflow
git diff --check
bun run electron:dist:dev:mac:arm64
bun run electron:smoke:packaged:mac
bun run typecheck:all
bun run lint:i18n:parity
```

## 8. Passing test output summary

- `bun run validate:mac-arm-build-workflow`: passed with `Mac ARM workflow contract passed`.
- `git diff --check`: passed with no whitespace errors.
- `bun run electron:smoke:packaged:mac`: passed after launching packaged `ROX ONE.app`, redacting `CRAFT_SERVER_URL` and `CRAFT_SERVER_TOKEN`, and printing `ROX ONE packaged headless startup passed`.
- `bun run typecheck:all`: passed.
- `bun run lint:i18n:parity`: passed with `i18n parity OK (7 locales, 1425 keys each)`.

## 9. Build output summary

- First sandboxed `bun run electron:dist:dev:mac:arm64` proved `arch=arm64` packaging but failed at DMG creation with `hdiutil: create failed - Device not configured`.
- Re-running the same command outside sandbox succeeded.
- Built artifacts:
  - `apps/electron/release/ROX-ONE-arm64.dmg`
  - `apps/electron/release/ROX-ONE-arm64.zip`
  - `apps/electron/release/mac-arm64/ROX ONE.app`

## 10. Remaining risks

- The local DMG step requires macOS `hdiutil` access outside the default sandbox.
- Dev artifacts use ad-hoc signing and skip notarization; production signing/notarization remains outside this task.
- The workflow uses GitHub's macOS ARM larger runner label `macos-15-xlarge`; availability depends on the repository's GitHub runner plan.
- `electron:smoke` is present in CI but was not rerun locally in this slice after the full dist because the dist already rebuilt Electron and packaged smoke verified the produced app.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Dedicated Mac ARM workflow exists | Pass | `.github/workflows/mac-arm-build.yml` |
| Workflow uses explicit ARM macOS runner | Pass | `runs-on: macos-15-xlarge` |
| Dependencies install with lockfile | Pass | `bun install --frozen-lockfile` workflow step |
| Workflow gates typecheck and i18n parity | Pass | workflow steps plus local `typecheck:all` and `lint:i18n:parity` passes |
| ARM64-only package command exists | Pass | `electron:dist:dev:mac:arm64` wrapper |
| DMG and ZIP artifacts are produced | Pass | local dist produced `ROX-ONE-arm64.dmg` and `ROX-ONE-arm64.zip` |
| Packaged app launches locally | Pass | `bun run electron:smoke:packaged:mac` |
| Secrets are not printed in smoke output | Pass | smoke output redacts URL/token values |
| Release artifacts are not committed | Pass | release outputs remain ignored/untracked |
