# T503 — packaged-artifacts validator (signed/unsigned modes)

Status: DONE
Phase: M.18
Owner: agent-A4 (RC2 swarm)
Spec: docs/superpowers/specs/2026-05-15-v1.0.0-rc.2-design.md

## Summary

Updated validator to support ROX_RC_MODE=unsigned for v1.0.0-rc.2
beta Mac+Windows artifacts while keeping signed-mode strict for
future v1.0.x signed releases. Follow-up PR #237 repair scopes checks by
platform so each workflow validates only the artifacts it produces.

## Env-var contract

| Variable | Value | Behaviour |
|---|---|---|
| `ROX_RC_MODE` | `''` (default) | Signed mode: all existing strict checks enforced; Mac runtime binary validated; code signature required |
| `ROX_RC_MODE` | `unsigned` | Unsigned-beta mode: presence + size checks only; code signature skipped with `[unsigned-beta]` log |
| `ROX_ARTIFACT_PLATFORM` | unset | Host platform: `darwin=mac`, `linux=linux`, `win32=windows` |
| `ROX_ARTIFACT_PLATFORM` | `mac`, `linux`, `windows`, `all` | Scope required artifacts to one platform or the aggregate release directory |
| `ROX_ARTIFACT_ARCH` | unset | `arm64` for Mac, `x64` for Linux and Windows |

## Platform matrix

| Platform | Signed mode | Unsigned mode |
|---|---|---|
| Linux | ROX-ONE-x86_64.AppImage + .AppImage.sig (GPG); `.deb` + `.rpm` when `ROX_LINUX_DEB_RPM=true` | ROX-ONE-x86_64.AppImage without `.sig`; `.deb` + `.rpm` when `ROX_LINUX_DEB_RPM=true` |
| Mac | ROX-ONE-arm64.dmg + .zip + blockmaps + latest-mac.yml + embedded code sig + runtime binary | same artifacts, NO code sig check |
| Windows | not checked | ROX-ONE-x64.exe + .exe.blockmap + latest.yml when `ROX_ARTIFACT_PLATFORM=windows` or `all` |

## Metadata checks

- `latest-mac.yml` must reference the expected Mac ZIP and DMG.
- `latest.yml` must use `path: ROX-ONE-${arch}.exe`, include exact `files[].url`
  entries for `ROX-ONE-${arch}.exe` and `ROX-ONE-${arch}.exe.blockmap`, and match
  both sizes to the files on disk.

## Size thresholds

- `.dmg`, `.zip`, `.exe`, `.deb`, `.rpm`, `.AppImage`: >= 50 MB
- `.blockmap` files: >= 128 KB
- `.AppImage.sig`, `latest-mac.yml`, `latest.yml`: >= 1 byte (presence only)

## Files changed

- `scripts/validate-packaged-artifacts.ts` — refactored to support both modes
- `scripts/__tests__/validate-packaged-artifacts.test.ts` — new bun:test coverage
- `.github/workflows/mac-arm-build.yml` — scopes packaged artifact validation to Mac
- `docs/worklog/T503-packaged-artifacts-multi-platform.md` — repair worklog and evidence
