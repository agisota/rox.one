# T503 - Packaged-artifacts validator multi-platform repair

Status: DONE
Phase: RC2 release hardening
Ticket: docs/tickets/T503-packaged-artifacts-multi-platform.md

## 1. Task summary

Patch the packaged-artifacts validator review blockers after the stale PR queue
landed. The validator now scopes required artifacts by platform and mode, uses
Linux x64 artifact names, validates Windows `ROX-ONE-${arch}.exe` installers,
and checks Windows `latest.yml` installer and blockmap metadata against disk.

## 2. Repo context discovered

- `scripts/validate-packaged-artifacts.ts` combined Linux and Mac requirements
  unconditionally before any Windows check.
- `.github/workflows/mac-arm-build.yml` runs the validator after producing only
  Mac ARM artifacts, so aggregate validation made that workflow require Linux
  and Windows files it never builds.
- `apps/electron/electron-builder.yml` configures Linux and Windows x64 output
  with `artifactName: "ROX-ONE-${arch}.${ext}"`.
- Existing Bun test fixtures were the right local coverage point for the
  validator contract.

## 3. Files inspected

- `scripts/validate-packaged-artifacts.ts`
- `scripts/__tests__/validate-packaged-artifacts.test.ts`
- `.github/workflows/mac-arm-build.yml`
- `.github/workflows/linux-signed-release.yml`
- `.github/workflows/private-release.yml`
- `scripts/validate-mac-arm-build-workflow.ts`
- `apps/electron/electron-builder.yml`
- `docs/tickets/T503-packaged-artifacts-multi-platform.md`

## 4. Tests added first

- Added platform-scoped tests proving Mac validation passes with only Mac
  artifacts.
- Added Windows tests for `ROX-ONE-x64.exe`, exact `latest.yml` installer size,
  and required matching blockmap entry.
- Added Linux signed-mode test proving x64 builder output names pass without
  requiring Mac artifacts.

## 5. Expected failing test output

`bun test scripts/__tests__/validate-packaged-artifacts.test.ts` failed before
implementation with the current validator requiring
`apps/electron/release/ROX-ONE-arm64.deb` during Mac and Windows fixture tests.
It also failed the Linux x64 pass case because the validator expected
`ROX-ONE-arm64.*` Linux artifacts.

## 6. Implementation changes

- Added `ROX_ARTIFACT_PLATFORM` support for `mac`, `linux`, `windows`, and
  `all`, with host-platform defaulting for unset values.
- Added `ROX_ARTIFACT_ARCH` support, defaulting to `arm64` for Mac and `x64`
  for Linux/Windows.
- Scoped required artifacts, metadata parsing, signature/runtime checks, hashes,
  and summary output to the selected platform.
- Changed Linux required artifacts to `ROX-ONE-x64.deb`,
  `ROX-ONE-x64.rpm`, `ROX-ONE-x64.AppImage`, and matching `.sig`.
- Changed Windows required artifacts to exact `ROX-ONE-${arch}.exe` and
  `ROX-ONE-${arch}.exe.blockmap`.
- Strengthened Windows `latest.yml` validation for exact `path`, installer URL,
  blockmap URL, and both on-disk sizes.
- Scoped the Mac ARM workflow validator call with `ROX_ARTIFACT_PLATFORM: mac`.
- Follow-up T512 lowered the `.blockmap` floor from the synthetic 1 MB fixture
  threshold to 128 KB after hosted Mac ARM packaging produced a valid 234.64 KB
  `ROX-ONE-arm64.dmg.blockmap`.

## 7. Validation commands run

- `bun test scripts/__tests__/validate-packaged-artifacts.test.ts`
- `bun run validate:mac-arm-build-workflow`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`

## 8. Passing test output summary

- Targeted validator tests: 15 pass, 0 fail.
- Mac ARM workflow contract: passed.
- Agent contract validation: passed.
- Docs validation: passed.
- Diff whitespace check: passed.

## 9. Build output summary

No application build was run. This change is limited to release validation,
workflow metadata, tests, and documentation.

## 10. Remaining risks

- Live packaging was not run, so the checks were verified with focused
  synthetic fixtures and workflow contract validation rather than newly built
  installers.
- Windows signed-mode artifact validation remains intentionally blocked until a
  signed Windows release workflow exists.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Mac ARM workflow does not require Linux/Windows artifacts | PASS | Mac fixture passes with `ROX_ARTIFACT_PLATFORM=mac`; workflow sets the env. |
| Linux expected names match x64 builder output | PASS | Linux fixture passes with `ROX-ONE-x64.*` artifacts. |
| Windows installer pattern is `ROX-ONE-${arch}.exe` | PASS | Windows fixture passes with `ROX-ONE-x64.exe` and rejects stale metadata. |
| `latest.yml` validates installer and blockmap metadata | PASS | Negative tests cover stale installer size and missing blockmap entry. |
| Hosted Mac blockmaps below 1 MB pass | PASS | T512 regression covers 235 KB Mac blockmaps while zero-byte blockmaps still fail. |
| Required T503 worklog exists | PASS | This worklog matches the DONE ticket. |

## T524 follow-up note

T524 extended the validator contract for the unified all-platforms unsigned
release workflow: unsigned Linux validation can now omit `.AppImage.sig`, while
signed Linux validation still requires the detached signature sidecar.
