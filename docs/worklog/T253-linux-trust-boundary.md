# T253 worklog — Linux private-release trust boundary mirror

## 1. Goal

Mirror the Mac T250/T251 and Windows T252 trust-boundary discipline
for Linux private-release AppImage artifacts. Same validator
pattern, same fixture shape, same `validate:` script wiring —
adapted to the Linux metadata surface (canonical AppImage filename +
freedesktop .desktop entry + gpg-detached signature sidecar instead
of CFBundleIdentifier + Apple build number + codesign output, or
AppUserModelID + dotted FileVersion + signtool output).

## 2. Surfaces inspected

- `scripts/validate-mac-private-release-boundary.ts` (T250 base — frozen, not modified)
- `apps/electron/scripts/afterPack.cjs` (T250 macOS afterPack — frozen)
- `scripts/validate-windows-private-release-boundary.ts` (T252 base — frozen)
- `apps/electron/scripts/afterPack-windows.cjs` (T252 windows afterPack — frozen)
- `scripts/__fixtures__/{mac,windows}-bundle/` (T251 + T252 fixture templates)
- `scripts/__tests__/validate-windows-boundary-fixtures.test.ts` (T252 test template)
- `scripts/validate-windows-boundary-fixtures.ts` (T252 orchestrator template)
- `apps/electron/electron-builder.yml` (linux: block extended only, mac:/win: blocks untouched)
- `package.json` (added 2 new validate: scripts after the windows entries)

## 3. Design decisions

| # | Decision | Rationale |
| - | -------- | --------- |
| 1 | Separate Linux afterPack hook, no shared lib | The mac hook is icon + plutil heavy and the windows hook is metadata-only; extracting a shared `canonical-app-id.cjs` would have required refactoring T250 + T252 surfaces, which the ticket constraints forbid. The Linux hook is ~135 LOC standalone — well within budget. |
| 2 | `rox-one.desktop` freedesktop entry as the canonical sidecar | The freedesktop spec already defines the `[Desktop Entry]` shape, so we get a deterministic Key=Value sidecar for free. The afterPack hook emits it; the validator parses it on every host. Mirrors the way Windows uses `app-info.txt` and Mac uses `Info.plist`. |
| 3 | Canonical `(T253 linux boundary ok)` marker | Mirrors the T250 `(T250 boundary ok)` and T252 `(T252 windows boundary ok)` markers. The validator greps both `signing-output.txt` and `rox-one.desktop` so either source is sufficient. |
| 4 | Canonical AppImage filename pattern `rox-one(-[A-Za-z0-9.+-]+)*\.AppImage` | electron-builder names the artifact `ROX-ONE-${arch}.AppImage` by default, but the rebrand has been moving toward `rox-one-` lowercase. We accept any `rox-one-` prefix variant (with optional version + arch segments) so both the current upper-cased default and the canonical lowercase end-state pass. |
| 5 | `--fixture <path>` CLI flag + `LINUX_BOUNDARY_FIXTURE_DIR` env | Same pattern as T251 mac and T252 windows validators — CLI form for tests, env-var form for downstream scripts. Both set the same internal variable. |
| 6 | bad-AppDir trips on canonical AppImage filename first | Identical structural pattern to the T251 mac and T252 windows bad fixtures: the first check inside `assertLinuxBundleContract` is the AppImage filename regex match, so the bad fixture's `not-rox-one.AppImage` stub trips here before the desktop-entry or signing-output asserts even run. The defensive test (case 5) reads the sidecar directly to assert the BAD-signature / No-public-key / is-not-signed tokens are still present. |
| 7 | Stub executable + AppImage placeholder in fixtures, not real squashfs | Mirrors the windows fixture's stub `.exe` and `.dll` placeholders. The walker just lists basenames; we do not exec or verify them. |
| 8 | `executableName: rox-one` + canonical `desktop:` block in electron-builder.yml linux: section | The `Exec=rox-one` pin is what the validator greps for via the canonical regex. The `category: Office` swap from `Utility` ties to the ROX.ONE Agent Workbench product category. The `# T253: trust-boundary signing placeholder` comment is the canonical token the validator greps for to confirm the boundary discipline is wired into the build config. |

## 4. Changes

### `scripts/validate-linux-private-release-boundary.ts`

- ~265 LOC. Static config + fixture-mode AppDir assertions for Linux.
- Asserts: package.json wires the script, electron-builder.yml has
  the canonical appId pin + linux:/target:AppImage blocks +
  `category: Office` + T253 boundary-comment, readiness docs still
  record the public-production blocker.
- Fixture-mode (env-gated by `LINUX_BOUNDARY_FIXTURE_DIR` or
  `--fixture`): walks AppDir top-level for the canonical
  `rox-one-*.AppImage` filename, parses `rox-one.desktop` and
  asserts canonical Exec=rox-one + Categories + required keys,
  looks for the T253 marker in either sidecar, greps
  `signing-output.txt` for required/forbidden gpg tokens, and
  rejects out-of-AppDir symlinks.
- Non-linux hosts skip the live `gpg --verify` step.

### `apps/electron/scripts/afterPack-linux.cjs`

- ~135 LOC. Reads the appId + version from the electron-builder
  context, validates the canonical AppImage filename if a stub is
  present, walks the unpacked dir for escaping symlinks, writes
  `rox-one.desktop` with the structured metadata + canonical T253
  marker, and appends the marker to `signing-output.txt` if it
  already exists (CI signing step path).
- No real gpg invocation. No credentials. No icon-compilation.

### `scripts/validate-linux-boundary-fixtures.ts`

- ~85 LOC. Orchestrator that spawns the validator with
  `--fixture good-AppDir` (expect exit 0) and `--fixture bad-AppDir`
  (expect non-zero + `AppImage filename` in combined stdout/stderr).
- Pure `node:child_process` + path joins.

### `scripts/__fixtures__/linux-bundle/good-AppDir/`

| Path | Content |
| ---- | ------- |
| `rox-one.desktop` | Canonical `[Desktop Entry]` with Name=rox-one, Exec=rox-one %U, Categories=Office;Utility;Development;, T253 marker. |
| `signing-output.txt` | Canonical gpg output: `Good signature`, `Primary key fingerprint`, native binaries listed (rox-one, rox-one-1.2.3-x64.AppImage, libnode.so), T253 marker. |
| `rox-one-1.2.3-x64.AppImage` | Canonical-filename AppImage stub placeholder. |
| `rox-one` | Stub executable / AppRun placeholder. |

### `scripts/__fixtures__/linux-bundle/bad-AppDir/`

| Path | Content |
| ---- | ------- |
| `not-rox-one.AppImage` | Non-canonical filename: trips the APPIMAGE_FILENAME_PATTERN regex first. |
| `rox-one.desktop` | Broken: `Exec=fake-binary`, `Categories=Game;`, NO T253 marker. |
| `signing-output.txt` | `gpg: BAD signature`, `No public key available`, `is not signed`. NO T253 marker. |

### `scripts/__tests__/validate-linux-boundary-fixtures.test.ts`

- ~105 LOC, 9 tests, 38 expect() calls.
- Coverage:
  1. good fixture tree presence (5 files asserted)
  2. bad fixture tree presence (4 files asserted)
  3. good fixture passes validator (exit 0, `fixture-mode ok` + `good-AppDir` markers)
  4. bad fixture fails validator on AppImage filename + `not-rox-one.AppImage` + `does not match`
  5. bad sidecar contains forbidden tokens (`BAD signature` / `No public key` / `is not signed`)
  6. good sidecar contains required tokens (`gpg:` / `Good signature` / `Primary key fingerprint` / T253 marker + native binaries) and lacks forbidden
  7. good desktop entry carries canonical Exec=rox-one + Categories + T253 marker + X-RoxOne-AppId
  8. package.json wires both `validate:linux-*` scripts
  9. orchestrator script + afterPack hook exist on disk

### `apps/electron/electron-builder.yml`

- `+` `# T253: trust-boundary signing placeholder` comment block
  under `linux:`.
- `+` `executableName: rox-one` pin under `linux:`.
- `+` Canonical `desktop:` block (Name=rox-one, Exec=rox-one %U,
  Categories=Office;Utility;Development;) under `linux:`.
- `-` `category: Utility` swap to `category: Office` (within
  ticket-allowed surface).
- `-` 0 mac:/win: lines removed. No Mac or Windows block touched.

### `package.json`

- `+` `validate:linux-private-release-boundary`
- `+` `validate:linux-boundary-fixtures`

## 5. Validation matrix

| Gate | Before | After |
| ---- | ------ | ----- |
| `validate:linux-private-release-boundary` | not present | passes (linux host static checks ok; non-linux hosts mark gpg step skipped) |
| `validate:linux-boundary-fixtures` | not present | passes (good green, bad red, exit=1) |
| `bun test scripts/__tests__/validate-linux-boundary-fixtures.test.ts` | not present | 9 pass / 0 fail / 38 expect() |
| `validate:rebrand` | pass | pass |
| `validate:agent-contract` | pass | pass (T253 `Status: DONE` + matching worklog) |
| `validate:roadmap` | pass | pass |

## 6. Deviations

- The prompt mentioned optional Snap-specific manifests. We only
  ship the AppImage path this round; the canonical desktop entry +
  filename pattern are Snap-ready (Snap reuses the freedesktop
  `.desktop` spec) so T254/T255 can layer Snap on top without
  changing the validator surface.
- We swap `category: Utility` to `category: Office` in the linux:
  block to match the validator's canonical-category set. The
  Categories= keyword in `rox-one.desktop` is the
  freedesktop-defined list and includes `Office;Utility;Development;`
  to keep menu integrations broad.
- No public-doc audit page (`docs/release/linux-trust-boundary-audit.md`)
  shipped this round — the readiness matrix already records the
  blocker. A standalone audit page can land with T255 when real
  gpg-detached signing arrives.

## 7. Files touched

| Path | Change |
| ---- | ------ |
| `scripts/validate-linux-private-release-boundary.ts` | new |
| `scripts/validate-linux-boundary-fixtures.ts` | new |
| `apps/electron/scripts/afterPack-linux.cjs` | new |
| `scripts/__fixtures__/linux-bundle/good-AppDir/rox-one.desktop` | new |
| `scripts/__fixtures__/linux-bundle/good-AppDir/signing-output.txt` | new |
| `scripts/__fixtures__/linux-bundle/good-AppDir/rox-one-1.2.3-x64.AppImage` | new |
| `scripts/__fixtures__/linux-bundle/good-AppDir/rox-one` | new |
| `scripts/__fixtures__/linux-bundle/bad-AppDir/not-rox-one.AppImage` | new |
| `scripts/__fixtures__/linux-bundle/bad-AppDir/rox-one.desktop` | new |
| `scripts/__fixtures__/linux-bundle/bad-AppDir/signing-output.txt` | new |
| `scripts/__tests__/validate-linux-boundary-fixtures.test.ts` | new |
| `apps/electron/electron-builder.yml` | edited (linux: block extended only) |
| `package.json` | +2 script lines |
| `docs/tickets/T253-linux-trust-boundary.md` | new |
| `docs/worklog/T253-linux-trust-boundary.md` | new |

## 8. Follow-ups

- **T254** — actual Windows signed-build CI workflow (Authenticode
  via Azure Code Signing or DigiCert KeyLocker, fed by repo secrets).
- **T255** — actual Linux signed-build CI workflow (gpg-detached
  `.AppImage.sig`, key from repo secrets; mirrors
  `.github/workflows/mac-signed-release.yml` shape).
- **M.18 closeout** — with T253 the cross-platform private-release
  trust-boundary mirror (Mac + Windows + Linux) is complete; only
  the live signed-build CI workflows remain for public production.

## 9. Closeout

- Linux validator + fixtures + tests + afterPack hook in place.
- No real gpg credentials anywhere; non-linux hosts skip the live
  gpg/AppImage check but keep static config/doc/fixture checks.
- T250/T251/T252 frozen surfaces unchanged (entitlements plist,
  mac validator, mac afterPack, mac-signed-release workflow,
  windows validator, windows afterPack).
- All six validation gates green.
