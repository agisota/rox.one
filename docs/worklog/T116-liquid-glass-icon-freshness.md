# T116 - Liquid Glass Icon Freshness Worklog

## 1. Task summary

Close the stale `Assets.car` warning observed during T115 packaging by adding
a release contract and regenerating the macOS 26+ Liquid Glass asset from the
current ROX.ONE icon sources.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 18]
```

## 2. Context discovered

- `apps/electron/scripts/afterPack.cjs` intentionally skips `Assets.car` when
  icon sources are newer than the precompiled asset.
- `apps/electron/resources/Assets.car` mtime: 2026-04-24 07:32:53.
- Current icon source mtimes are newer:
  - `icon.icns`: 2026-04-28 17:26:48
  - `icon.png`: 2026-04-28 17:26:47
  - `icon.svg`: 2026-04-28 17:34:34
  - `icon.icon/Assets/icon.png`: 2026-04-28 17:27:04
  - `icon.icon/Assets/icon.svg`: 2026-04-28 17:34:48
- Local toolchain can regenerate the asset:
  - `xcodebuild -version`: Xcode 26.4.1, build 17E202
  - `xcrun --sdk macosx --show-sdk-version`: 26.4
  - `xcrun --find actool`: `/Applications/Xcode.app/Contents/Developer/usr/bin/actool`

## 3. Red test

Command:

```bash
bun test scripts/__tests__/mac-liquid-glass-icon-contract.test.ts
```

Expected red result:

```text
0 pass
2 fail
3 expect() calls
```

Failures:

- `Assets.car` was older than:
  - `apps/electron/resources/icon.svg`
  - `apps/electron/resources/icon.png`
  - `apps/electron/resources/icon.icon/icon.json`
  - `apps/electron/resources/icon.icon/Assets/icon.svg`
  - `apps/electron/resources/icon.icon/Assets/icon.png`
- `afterPack.cjs` did not include `resources/icon.icon/icon.json` in the
  stale-source guard.

## 4. Implementation changes

- Added `icon.icon/icon.json` to the `afterPack.cjs` stale-source guard so
  catalog manifest changes are treated like image source changes.
- Regenerated `apps/electron/resources/Assets.car` from
  `apps/electron/resources/icon.icon` using local Xcode 26 `actool`.
- Confirmed the working `actool` app icon name is `icon`, not `AppIcon`:
  `actool --app-icon icon` emits `CFBundleIconName=icon` for the current
  `resources/icon.icon` catalog.
- Aligned `apps/electron/electron-builder.yml`, `afterPack.cjs`, and
  `apps/electron/README.md` around the temp-dir `actool --app-icon icon`
  regeneration flow.
- Kept `apps/electron/resources/icon.icns` unchanged as the fallback asset.

## 5. Validation commands run

```bash
bun test scripts/__tests__/mac-liquid-glass-icon-contract.test.ts
bun run electron:dist:dev:mac:arm64
bun run validate:release
bun run validate:packaged-artifacts
bun run electron:smoke:packaged:mac
bun run electron:smoke
git diff --check
git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true
```

## 6. Passing evidence summary

- Targeted contract test passed:

```text
3 pass
0 fail
10 expect() calls
```

- `bun run electron:dist:dev:mac:arm64` passed. `afterPack` copied the
  Liquid Glass asset into the packaged app:

```text
Liquid Glass icon copied: .../release/mac-arm64/ROX.ONE.app/Contents/Resources/Assets.car
```

- The stale warning from T115 did not reappear:

```text
Warning: Assets.car is older than the current icon sources
```

was absent from the fresh packaging output.

- Packaged app plist now matches the compiled catalog:

```text
CFBundleDisplayName = ROX.ONE
CFBundleIconFile = icon.icns
CFBundleIconName = icon
CFBundleName = ROX.ONE
```

- `bun run validate:release` passed:

```text
4767 pass
13 skip
0 fail
4780 tests across 408 files
```

- `bun run validate:packaged-artifacts` passed with verified artifacts:

```text
apps/electron/release/ROX-ONE-arm64.dmg
size: 328325707 bytes
sha256: 40b2faec3fd1fb64f908806c0030c467f4dc622a13b40aa3cd472fc023d50f40

apps/electron/release/ROX-ONE-arm64.zip
size: 317351463 bytes
sha256: 02e42127cfda9cf85f9ae31008597856a5d3be61c434ca8f1b9a3189ef7cc46c
```

- `bun run electron:smoke:packaged:mac` passed:

```text
[packaged-smoke] ROX.ONE packaged headless startup passed
```

- `bun run electron:smoke` passed:

```text
[smoke] Electron headless startup passed
```

- `git diff --check` passed.
- Package manifests and lockfiles were not modified.

## 7. Remaining risks

- Local macOS package still uses ad-hoc signing, skips notarization, and keeps
  the existing ASAR-disabled warning. Production signing/notarization remains a
  separate credential-gated release step.
- Existing Vite chunk-size and deprecated Jotai Babel plugin warnings remain
  non-fatal and were not changed by this ticket.
- No remote push was performed in this task.
