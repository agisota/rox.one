# Mac Trust Boundary Audit (M.18 T250)

Date: 2026-05-13
Scope: macOS private-release codesign + entitlements + validator boundary.

## Context

Private-RC Mac builds ship ad-hoc-signed, unnotarized `.app` bundles via
`apps/electron/electron-builder.yml`. The existing
`bun run validate:mac-private-release-boundary` checks scripts/docs hints
exist, plus on-darwin codesign / stapler markers, but does not assert
hardened-runtime, entitlement minimality, bundle-id pattern, build number,
native-binary signing surface, or symlink boundary.

## Gap analysis

| # | Current check | Strength | Recommended action |
|---|---|---|---|
| 1 | `appId` constant comment in builder yml | Weak (regex, not parsed) | Validator: assert `appId` matches `^com\.rox\.one(\..+)?$` (canonical scope) |
| 2 | `CFBundleVersion` not asserted | Missing | Validator: parse Info.plist, assert integer monotonic build number |
| 3 | `hardenedRuntime: true` only in yml | Weak (yml string match) | Validator: parse packaged Info.plist `Hardened Runtime` flag via `codesign -d --entitlements` |
| 4 | Entitlements include `disable-library-validation: true` unconditionally | Strong risk | Entitlements: remove unconditional flag; allow only under gated env (`ROX_ALLOW_UNSIGNED_LIBRARIES=1`) — default plist drops it |
| 5 | `com.apple.security.network.server` | N/A (not currently set) | Confirm only `network.client` is granted; assert no `network.server` |
| 6 | Ad-hoc signing on native binaries unchecked | Missing | Validator: walk `Contents/Frameworks/**`, `Contents/Resources/app/node_modules/**` for `.dylib`/`.node` and grep `codesign -dv` for canonical identifier |
| 7 | `node_modules/.bin` symlink targets unbounded | Missing | Validator: assert all symlinks within `Contents/Resources` resolve to inside the bundle |
| 8 | Fixture testing for validator | Missing | Add `scripts/__fixtures__/mac-bundle/{good,bad}/` and unit tests that exercise validator in fixture mode |
| 9 | Validator only runs on darwin host for codesign | Documented | Keep darwin gating; add `MAC_BOUNDARY_FIXTURE_DIR` env to allow Linux fixture-mode runs |
| 10 | Bundle `CFBundleIdentifier` not asserted post-pack | Weak | Validator: parse packaged Info.plist key `CFBundleIdentifier` and compare to `appId` |

## Risk summary

Without the above, a stale or wrongly-configured entitlements plist could
ship with `disable-library-validation` permanently enabled (allowing
arbitrary unsigned dylib loads) or with `CFBundleVersion=0.0.0` and pass
notarization rejection silently. The hardened set below closes those
gaps within the private-RC contract (ad-hoc, unnotarized only).

## Acceptance

- Entitlements default to hardened: jit + allow-unsigned-executable-memory
  only (drops `disable-library-validation`).
- Validator asserts gaps #1-#7 + #10. Fixture mode covers #6, #7, #10.
- Fixture tests assert green/red parity. Validator script remains
  cross-platform; codesign + stapler checks remain darwin-only.

## Follow-up (T261)

- Real signing/notarization flow gated behind CI secrets (out of scope
  this ticket).
- Add provisioning-profile validation when corporate signing comes online.
