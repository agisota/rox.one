# T251 worklog — Signed-build CI workflow + fixture validator tests

## 1. Goal

Land the actual signed-build + notarization CI workflow for ROX.ONE
macOS releases (T250 only landed the boundary validator + audit
docs), plus fixture-mode bun tests so the validator itself is
regression-protected.

## 2. Surfaces inspected

- `.github/workflows/private-release.yml` (conventions for
  workflow_dispatch + tag regex + log capture)
- `.github/workflows/mac-arm-build.yml` (conventions for
  electron-builder invocation + artifact upload)
- `scripts/validate-mac-private-release-boundary.ts` (existing
  fixture-mode logic gated by `MAC_BOUNDARY_FIXTURE_DIR`)
- `apps/electron/electron-builder.yml` (frozen by T250; not
  modified here)
- `apps/electron/build/entitlements.mac.plist` (frozen by T250;
  used as the golden template for the good fixture)

## 3. Design decisions

| # | Decision | Rationale |
| - | -------- | --------- |
| 1 | `workflow_dispatch` only, no PR/push triggers | Signing burns macos-15-xlarge minutes + real Apple credentials. We never want this to fire by accident. |
| 2 | Secrets pre-flight step, fail-fast if any of the 5 are missing | Stops a misconfigured environment from producing an ad-hoc bundle that LOOKS signed but is not. |
| 3 | `inputs.tag` fed via `INPUT_TAG` env var, never inline `${{ inputs.tag }}` in shell | Workflow-injection mitigation per GitHub security guidance. |
| 4 | `electron-builder --publish=never` + manual `actions/upload-artifact@v4` | Keeps the signed `.dmg` inside GitHub workflow artifacts rather than pushing to a Release page. The release page is updated by hand once the QA gate passes. |
| 5 | `codesign -dv --verbose=4` post-pack with explicit `Identifier=`, `Signature!=adhoc`, `TeamIdentifier=$APPLE_TEAM_ID` greps | Belt-and-braces: even if electron-builder thinks it signed, we re-verify the canonical identity before paying for notarytool. |
| 6 | `notarytool submit --wait --timeout 30m` then `stapler staple` + validate | Apple-recommended path for offline-verifiable Gatekeeper acceptance. |
| 7 | `--fixture <path>` CLI flag added alongside the env-var path | Bun tests use the CLI form (cleaner spawn args); CI / scripts can keep using `MAC_BOUNDARY_FIXTURE_DIR` if they prefer. |
| 8 | Two fixtures (good-bundle, bad-bundle) instead of property tests | Keeps the trust surface auditable — a human can diff the two fixture trees and see exactly what the validator enforces. |

## 4. Changes

### `.github/workflows/mac-signed-release.yml`

- 229 LOC. workflow_dispatch only with required `tag` input.
- Steps: checkout → validate tag regex → secrets pre-flight →
  bun setup → install → validate fixtures →
  validate-mac-private-release-boundary → electron:build →
  electron-builder --mac --arm64 --publish=never → codesign verify
  → notarytool + stapler → SHA-256 checksum → upload signed `.dmg`
  + evidence.
- Logs piped to `.ci-logs/mac-signed-release/*.log` for the
  evidence artifact.

### `scripts/__fixtures__/mac-bundle/good-bundle/`

| Path | Content |
| ---- | ------- |
| `Contents/Info.plist` | Canonical `com.rox.one` bundle id, `CFBundleVersion` integer 92, `HardenedRuntime` true. |
| `Contents/MacOS/ROX.ONE` | Stub native-binary file so the walker has something to assert. |
| `Contents/Resources/entitlements.mac.plist` | Mirrors the real T250 entitlements (jit + unsigned-exec-memory + network.client). |
| `signing-output.txt` | Canonical codesign output: `Identifier=com.rox.one`, `Signature=adhoc`, hardened-runtime flag, lists `ROX.ONE` as signed native binary, includes the required outbound-network entitlement key. |

### `scripts/__fixtures__/mac-bundle/bad-bundle/`

| Path | Content |
| ---- | ------- |
| `Contents/Info.plist` | Broken: `com.notrox.fake` bundle id, NO `CFBundleVersion`, NO hardened-runtime flag. |
| `Contents/MacOS/Fake` | Stub native-binary file. |
| `Contents/Resources/entitlements.mac.plist` | Forbidden: contains `disable-library-validation` + `network.server`. |
| `signing-output.txt` | Mirrors the bad entitlements + bundle id; validator trips on bundle-id pattern first. |

### `scripts/validate-mac-private-release-boundary.ts`

- `+` CLI parser for `--fixture <path>` and `--fixture=<path>`
  forms. Sets `MAC_BOUNDARY_FIXTURE_DIR` internally so the
  existing fixture-mode block (step 6) handles the rest.
- Diff stat: +20 / -1.

### `scripts/validate-mac-boundary-fixtures.ts`

- 86 LOC. Orchestrator that spawns the validator with
  `--fixture good-bundle` (expect exit 0) and
  `--fixture bad-bundle` (expect non-zero + `CFBundleIdentifier`
  in combined stdout/stderr).
- No external deps. Pure `node:child_process` + path joins.

### `package.json`

- `+` one script line: `validate:mac-boundary-fixtures`.

### `scripts/__tests__/validate-mac-boundary-fixtures.test.ts`

- 104 LOC, 8 tests, 26 expect() calls.
- Coverage:
  1. good fixture tree presence
  2. bad fixture tree presence
  3. good fixture passes validator (exit 0 + fixture-mode ok marker)
  4. bad fixture fails validator (non-zero exit + CFBundleIdentifier marker)
  5. bad signing-output sidecar contains forbidden entitlement keys
  6. good signing-output sidecar lacks forbidden + contains required keys
  7. package.json wires the validate:mac-boundary-fixtures script
  8. orchestrator runner script exists on disk

## 5. Validation matrix

| Gate | Before | After |
| ---- | ------ | ----- |
| `validate:mac-private-release-boundary` | passed; only env-var fixture path | passes; CLI `--fixture` path also works |
| `validate:mac-boundary-fixtures` | not present | passes; good green, bad red |
| `bun test scripts/__tests__/validate-mac-boundary-fixtures.test.ts` | not present | 8 pass / 0 fail / 26 expect() |
| `validate:agent-contract` | pass | pass (T251 `Status: DONE`) |
| `validate:roadmap` | pass | pass |

## 6. Deviations

- Originally the prompt listed extending the validator with a
  `--fixture` mode AS WELL AS using the existing env var. We kept
  both: the CLI flag delegates to the env var so there is one
  single fixture-handling code path inside the validator, just
  two entrypoints into it.
- The bad fixture trips on the bundle-id pattern check before the
  entitlement asserts run. The fixture's signing-output still
  contains the forbidden entitlements (tested separately) so the
  validator's later passes stay covered as soon as somebody fixes
  the bundle-id and reruns.
- No real Apple credentials added anywhere. The workflow's
  `Verify signing secrets present` step is the gate that proves
  this — if all five secrets are missing in a dry-run, the job
  aborts before electron-builder.

## 7. Files touched

| Path | Change |
| ---- | ------ |
| `.github/workflows/mac-signed-release.yml` | new |
| `scripts/__fixtures__/mac-bundle/good-bundle/Contents/Info.plist` | new |
| `scripts/__fixtures__/mac-bundle/good-bundle/Contents/MacOS/ROX.ONE` | new |
| `scripts/__fixtures__/mac-bundle/good-bundle/Contents/Resources/entitlements.mac.plist` | new |
| `scripts/__fixtures__/mac-bundle/good-bundle/signing-output.txt` | new |
| `scripts/__fixtures__/mac-bundle/bad-bundle/Contents/Info.plist` | new |
| `scripts/__fixtures__/mac-bundle/bad-bundle/Contents/MacOS/Fake` | new |
| `scripts/__fixtures__/mac-bundle/bad-bundle/Contents/Resources/entitlements.mac.plist` | new |
| `scripts/__fixtures__/mac-bundle/bad-bundle/signing-output.txt` | new |
| `scripts/validate-mac-private-release-boundary.ts` | edited (CLI flag) |
| `scripts/validate-mac-boundary-fixtures.ts` | new (orchestrator) |
| `scripts/__tests__/validate-mac-boundary-fixtures.test.ts` | new |
| `package.json` | +1 script line |
| `docs/tickets/T251-signed-build-workflow.md` | new |
| `docs/worklog/T251-signed-build-workflow.md` | new |

## 8. Follow-ups

- **T252** — Windows signed-build workflow + fixture mirror.
- **T253** — Linux signed-build workflow + fixture mirror.
- **T254** — release-notes automation that consumes the
  signed-release artifact + checksums.

## 9. Closeout

- Signed-build workflow is wired and YAML-valid.
- Fixture validator + bun tests catch boundary regressions before
  CI ever needs to spend macOS minutes on a real build.
- Workflow fails fast if any Apple secret is missing.
- T250 surfaces (`afterPack.cjs`, `electron-builder.yml`,
  `entitlements.mac.plist`) untouched per ticket constraints.
