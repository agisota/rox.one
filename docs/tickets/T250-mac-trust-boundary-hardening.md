# T250 - Mac private-release trust boundary hardening

Status: DONE

## Context

We are building a white-label fork of Craft Agents OSS into the
ROX.ONE Agent Workbench Suite.

Relevant product goals:

- local desktop app
- managed web/cloud app
- user/team workspaces
- prompt modes
- multi-agent workflows
- validation gates
- TDD-first implementation

The repository already ships
`scripts/validate-mac-private-release-boundary.ts` and a Mac
electron-builder config. T250 (Phase M.18) hardens the codesigning
+ entitlements + validator boundary so the upcoming private-RC
release path is forgery-resistant and gatekeeper-friendly when a
real signing identity is configured.

## Scope

This ticket strengthens four surfaces and adds an audit doc:

1. **Entitlements** (`apps/electron/build/entitlements.mac.plist`):
   - hardened-runtime-friendly defaults
   - explicit `com.apple.security.network.client` only
   - `com.apple.security.cs.disable-library-validation` dropped
   - boundary-contract comment that points at the audit doc
2. **electron-builder.yml**:
   - `appId: com.rox.one.*` canonical scope
   - `CFBundleVersion` forced to a pure numeric Apple build number
3. **afterPack.cjs** post-pack guards:
   - canonical `appId` regex check
   - integer-monotonic `CFBundleVersion` check
   - native-binary signing-string canonical match
   - no `node_modules/.bin` symlinks pointing outside Resources
4. **`validate-mac-private-release-boundary.ts`** extended to assert:
   - `appId` pattern via `^com\.rox\.one(\..+)?$`
   - `CFBundleVersion` is an integer
   - hardened-runtime flag present in `Info.plist` (via afterPack
     emitting a canonical marker into validator-watched output)
   - `disable-library-validation` is dropped
   - audit-doc anchor `M.18 T250` exists

Plus a one-page audit doc at
`docs/release/mac-trust-boundary-audit.md` (≤80 LOC) listing the
gap analysis (#1–#5 in a table) and the strengthening actions.

## Out of scope

- Real codesigning / notarization wiring. Those need real Apple
  developer credentials and only run in CI (T251 will add the
  signed-build workflow integration).
- Build-number minting automation. The validator just asserts the
  shape; CI sets the actual integer per release (T251).

## Rules followed

- No secrets added anywhere.
- ≤500 LOC source/script changes (285 LOC actual).
- Non-Darwin hosts skip the codesign/stapler checks but still
  validate scripts/docs/config — the validator stays cross-platform.

## Validation gates

- `bun run validate:mac-private-release-boundary` — pass (non-darwin
  marks codesign/stapler steps as skipped; docs/config asserts hold).
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pass with T250 `Status: DONE`.
- `bun run validate:roadmap` — pass.

## Follow-ups

- **T251** — wire the actual signed-build workflow (`workflow_dispatch`
  with Apple credentials in CI secrets, notarize-and-staple step,
  upload signed `.dmg` as artifact).
- **T252** — Windows private-release boundary mirror (separate plist /
  entitlements shape; same validator pattern).
- **T253** — Linux AppImage / Snap private-release boundary mirror.
