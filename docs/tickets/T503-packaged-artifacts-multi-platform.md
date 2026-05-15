# T503 — packaged-artifacts validator (signed/unsigned modes)

Status: DONE
Phase: M.18
Owner: agent-A4 (RC2 swarm)
Spec: docs/superpowers/specs/2026-05-15-v1.0.0-rc.2-design.md

## Summary

Updated validator to support ROX_RC_MODE=unsigned for v1.0.0-rc.2
beta Mac+Windows artifacts while keeping signed-mode strict for
future v1.0.x signed releases.

## Env-var contract

| Variable | Value | Behaviour |
|---|---|---|
| `ROX_RC_MODE` | `''` (default) | Signed mode: all existing strict checks enforced; Mac runtime binary validated; code signature required |
| `ROX_RC_MODE` | `unsigned` | Unsigned-beta mode: presence + size checks only; code signature skipped with `[unsigned-beta]` log |

## Platform matrix

| Platform | Signed mode | Unsigned mode |
|---|---|---|
| Linux | .deb + .rpm + .AppImage + .AppImage.sig (GPG) | same (always required) |
| Mac | ROX-ONE-arm64.dmg + .zip + blockmaps + latest-mac.yml + embedded code sig + runtime binary | same artifacts, NO code sig check |
| Windows | not checked | ROX-ONE-Setup-*.exe + .exe.blockmap + latest.yml |

## Size thresholds

- `.dmg`, `.zip`, `.exe`, `.deb`, `.rpm`, `.AppImage`: >= 50 MB
- `.blockmap` files: >= 1 MB
- `.AppImage.sig`, `latest-mac.yml`, `latest.yml`: >= 1 byte (presence only)

## Files changed

- `scripts/validate-packaged-artifacts.ts` — refactored to support both modes
- `scripts/__tests__/validate-packaged-artifacts.test.ts` — new bun:test coverage
