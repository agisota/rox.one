# T251 - Signed-build CI workflow + fixture validator tests

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into the
ROX.ONE Agent Workbench Suite.

Relevant product goals:

- local desktop app
- managed web/cloud app
- user/team workspaces
- prompt modes
- multi-agent workflows
- validation gates
- TDD-first implementation

T250 (M.18) hardened the Mac private-release trust boundary —
entitlements minimum, canonical appId, integer build number,
afterPack guards, validator-asserts. T251 finishes the macOS
release path by wiring an actual signed-build CI workflow that
takes a release tag, signs the bundle with a real Developer ID
certificate, notarizes the DMG via `notarytool`, staples the
ticket, and uploads the resulting `.dmg` as a workflow artifact.

To keep the validator itself trustworthy, T251 also lands
fixture-based bun tests so a regression in the boundary checks
(entitlements drift, appId regex weakening, etc.) is caught by CI
on every PR — not by the post-release `codesign --verify`.

## Scope

This ticket ships four artifacts:

1. **`.github/workflows/mac-signed-release.yml`** — new
   `workflow_dispatch`-only workflow. Inputs: `tag` (required,
   matches `^v[0-9]+\.[0-9]+\.[0-9]+(-rc\.[0-9]+)?$`). Steps:
   tag-pattern guard → secrets pre-flight (CSC_LINK,
   CSC_KEY_PASSWORD, APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD,
   APPLE_TEAM_ID) → bun setup → install → validate fixtures →
   validate boundary → electron build → `electron-builder --mac
   --arm64 --publish=never` → `codesign -dv --verbose=4` →
   `notarytool submit --wait` → `stapler staple` + validate →
   compute SHA-256 → upload signed `.dmg` + evidence artifact.
2. **`scripts/__fixtures__/mac-bundle/`** — two minimal bundle
   directories used by the validator's fixture mode:
   - `good-bundle/` — canonical `com.rox.one` appId, integer
     CFBundleVersion (92), HardenedRuntime true, entitlements with
     `network.client` only, signing-output sidecar that lists
     the required entitlement + native binary.
   - `bad-bundle/` — broken `com.notrox.fake` appId, missing
     CFBundleVersion, entitlements + sidecar with
     `disable-library-validation` and `network.server` keys.
3. **`scripts/validate-mac-private-release-boundary.ts`** — extended
   with a `--fixture <path>` CLI flag (sets
   `MAC_BOUNDARY_FIXTURE_DIR` internally). The existing env-var
   path is preserved for backwards compatibility.
4. **`scripts/validate-mac-boundary-fixtures.ts`** + package.json
   script — orchestrator that runs the validator twice and
   asserts good=green, bad=red with a CFBundleIdentifier failure
   marker.

Plus a bun:test suite at
`scripts/__tests__/validate-mac-boundary-fixtures.test.ts` (8
tests, 26 expect() calls) covering: fixture tree presence,
validator exit codes for both fixtures, error-marker assertions,
sidecar content asserts, and package.json/orchestrator wiring.

## Out of scope

- Real Apple credentials. The workflow only references secrets via
  `${{ secrets.* }}`; no Apple Developer ID or app-specific
  password ships in the repo. Workflow fails fast if any secret is
  missing.
- Actual signing/notarization at PR time. The workflow is
  `workflow_dispatch` only, so PRs never spend macOS minutes on
  this path. `mac-arm-build.yml` and `private-release.yml` keep
  covering the ad-hoc / unsigned RC paths.
- Windows / Linux signed-release. T252 mirrors this contract for
  Windows; T253 mirrors for Linux.

## Rules followed

- No secrets added to any file.
- No actual signing or notarization runs in CI today (the workflow
  is gated by `workflow_dispatch` + secrets pre-flight).
- Workflow YAML validates with `bun js-yaml` parser.
- Untrusted `inputs.tag` is fed via env (`INPUT_TAG`) and regex
  checked before being used downstream.
- ≤300 LOC workflow (229 LOC actual), ≤200 LOC fixtures (110 LOC
  actual), ≤300 LOC tests (104 LOC test + 86 LOC orchestrator).

## Validation gates

- `bun run validate:mac-private-release-boundary` — pass.
- `bun run validate:mac-boundary-fixtures` — pass (good green,
  bad red).
- `bun test scripts/__tests__/validate-mac-boundary-fixtures.test.ts` —
  8 pass / 0 fail.
- `bun run validate:agent-contract` — pass with T251 `Status: DONE`.
- `bun run validate:roadmap` — pass.

## Follow-ups

- **T252** — Windows signed-build workflow mirror (Authenticode +
  EV signing path; analogous fixture suite).
- **T253** — Linux signed-build workflow mirror (gpg-detached
  signature on the AppImage / Snap channel).
- **T254** — release-notes automation that consumes the
  `rox-one-signed-mac-arm64` artifact + checksum text.
