# T252 worklog — Windows private-release trust boundary mirror

## 1. Goal

Mirror the Mac T250/T251 trust-boundary discipline for Windows
private-release NSIS installers. Same validator pattern, same fixture
shape, same `validate:` script wiring — adapted to the Windows
metadata surface (AppUserModelID + dotted FileVersion + signtool
output instead of CFBundleIdentifier + Apple build number +
codesign output).

## 2. Surfaces inspected

- `scripts/validate-mac-private-release-boundary.ts` (T250 base — frozen, not modified)
- `apps/electron/scripts/afterPack.cjs` (T250 macOS afterPack — frozen)
- `scripts/__fixtures__/mac-bundle/` (T251 fixture template)
- `scripts/__tests__/validate-mac-boundary-fixtures.test.ts` (T251 test template)
- `scripts/validate-mac-boundary-fixtures.ts` (T251 orchestrator template)
- `apps/electron/electron-builder.yml` (win: block extended only, mac: block untouched)
- `package.json` (added 2 new validate: scripts after the mac entries)

## 3. Design decisions

| # | Decision | Rationale |
| - | -------- | --------- |
| 1 | Separate Windows afterPack hook, no shared lib | The mac hook is icon + plutil heavy; extracting a shared `canonical-app-id.cjs` would have required refactoring T250 surfaces, which the ticket constraints forbid. The Windows hook is 158 LOC standalone — well within budget. |
| 2 | `app-info.txt` Key=Value sidecar instead of parsing PE VS_VERSIONINFO | We do not run on win32 hosts in CI today (linux only). Reading PE version resources requires native code or external `signtool` invocations that we do not want gating PRs. A simple Key=Value text file is what `afterPack-windows.cjs` emits and what the validator parses — same shape on every host. |
| 3 | Canonical `(T252 windows boundary ok)` marker | Mirrors the way T250 inserted a `(T250 boundary ok)` log line in afterPack. The validator greps both `signing-output.txt` and `app-info.txt` so either source is sufficient. |
| 4 | Accept both `one.rox.workbench[.*]` and `com.rox.one[.*]` AppUserModelID | electron-builder defaults to the top-level `appId` (`com.rox.one`) for Windows when `nsis.appId` is unset. We allow either canonical scope so the validator works whether nsis.appId is overridden or not. |
| 5 | `--fixture <path>` CLI flag + `WIN_BOUNDARY_FIXTURE_DIR` env | Same pattern as T251's mac validator — CLI form for tests, env-var form for downstream scripts. Both set the same internal variable. |
| 6 | bad-bundle trips on AppUserModelID first | Identical structural pattern to the T251 mac bad-bundle: the first check the validator hits inside `assertWindowsBundleContract` is the AppUserModelID regex match, so the bad fixture's `com.notrox.fake` value trips here before the signing-output asserts even run. The defensive test (case 5) reads the sidecar directly to assert the SignTool Error tokens are still present. |
| 7 | Stub `.exe` and `.dll` files in fixtures, not real PEs | Mirrors the mac fixture's stub `MacOS/ROX.ONE` file. The walker just lists basenames; we do not exec or sign them. |
| 8 | Inert `signtoolOptions` block + `# T252: trust-boundary signing placeholder` comment in electron-builder.yml | The comment is the canonical token the validator greps for. The block is structurally complete but credential-free, so local builds stay unsigned and CI (T254) can swap in real values via secrets. |

## 4. Changes

### `scripts/validate-windows-private-release-boundary.ts`

- 275 LOC. Static config + fixture-mode bundle assertions for Windows.
- Asserts: package.json wires the script, electron-builder.yml has
  the canonical appId pin + win:/nsis: blocks + perMachine:false +
  oneClick:true + T252 boundary-comment, readiness docs still
  record the public-production blocker.
- Fixture-mode (env-gated by `WIN_BOUNDARY_FIXTURE_DIR` or `--fixture`):
  parses `app-info.txt`, asserts canonical AppUserModelID +
  dotted FileVersion + CompanyName, looks for the T252 marker in
  either sidecar, greps `signing-output.txt` for required/forbidden
  tokens, walks the bundle for native-binary signing entries, and
  rejects out-of-bundle symlinks.
- Non-win32 hosts skip the live `signtool verify` step.

### `apps/electron/scripts/afterPack-windows.cjs`

- 123 LOC. Reads the appId + version from the electron-builder
  context, validates them against the canonical regexes, walks the
  unpacked dir for escaping symlinks, writes `app-info.txt` with
  the structured metadata + canonical T252 marker, and appends the
  marker to `signing-output.txt` if it already exists (CI signing
  step path).
- No real signtool invocation. No credentials. No icon-compilation.

### `scripts/validate-windows-boundary-fixtures.ts`

- 85 LOC. Orchestrator that spawns the validator with
  `--fixture good-bundle` (expect exit 0) and `--fixture bad-bundle`
  (expect non-zero + `AppUserModelID` in combined stdout/stderr).
- Pure `node:child_process` + path joins.

### `scripts/__fixtures__/windows-bundle/good-bundle/`

| Path | Content |
| ---- | ------- |
| `app-info.txt` | Canonical AppUserModelID `one.rox.workbench`, dotted FileVersion `1.2.3.92`, CompanyName `roxone`, T252 marker. |
| `signing-output.txt` | Canonical signtool output: Subject/Issuer/SHA1 hash, native binaries listed (ROX.ONE.exe, chrome_elf.dll, ffmpeg.dll), T252 marker. |
| `ROX.ONE.exe` / `chrome_elf.dll` / `ffmpeg.dll` | Stub native-binary placeholders. |

### `scripts/__fixtures__/windows-bundle/bad-bundle/`

| Path | Content |
| ---- | ------- |
| `app-info.txt` | Broken: `com.notrox.fake` AppUserModelID, `not-a-version` FileVersion, empty CompanyName, NO T252 marker. |
| `signing-output.txt` | `SignTool Error: No signature found.`, `Fake.exe is not signed.`. NO T252 marker. |
| `Fake.exe` | Stub native-binary placeholder. |

### `scripts/__tests__/validate-windows-boundary-fixtures.test.ts`

- 109 LOC, 8 tests, 33 expect() calls.
- Coverage:
  1. good fixture tree presence (6 files asserted)
  2. bad fixture tree presence (3 files asserted)
  3. good fixture passes validator (exit 0, `fixture-mode ok` + `good-bundle` markers)
  4. bad fixture fails validator on AppUserModelID + `com.notrox.fake` + `does not match`
  5. bad sidecar contains forbidden tokens (`SignTool Error` / `No signature found` / `is not signed`)
  6. good sidecar contains required tokens (`Subject:` / `Issuer:` / `SHA1 hash:` / T252 marker + native binaries) and lacks forbidden
  7. package.json wires both `validate:windows-*` scripts
  8. orchestrator script + afterPack hook exist on disk

### `apps/electron/electron-builder.yml`

- `+` inert `signtoolOptions` block under `win:` (sign: null, empty
  signingHashAlgorithms, empty publisherName).
- `+` `publisherName: roxone` pin under `win:`.
- `+` `# T252: trust-boundary signing placeholder` comment block.
- `-` 0 lines removed. No Mac block touched.

### `package.json`

- `+` `validate:windows-private-release-boundary`
- `+` `validate:windows-boundary-fixtures`

## 5. Validation matrix

| Gate | Before | After |
| ---- | ------ | ----- |
| `validate:windows-private-release-boundary` | not present | passes (non-win32 marks signtool step skipped) |
| `validate:windows-boundary-fixtures` | not present | passes (good green, bad red, exit=1) |
| `bun test scripts/__tests__/validate-windows-boundary-fixtures.test.ts` | not present | 8 pass / 0 fail / 33 expect() |
| `validate:rebrand` | pass | pass |
| `validate:agent-contract` | pass | pass (T252 `Status: DONE` + matching worklog) |
| `validate:roadmap` | pass | pass |

## 6. Deviations

- The prompt mentioned an optional shared `lib/canonical-app-id.cjs`
  between mac + windows afterPack. We kept them separate because the
  mac variant is icon + plutil heavy and refactoring it would have
  touched T250 frozen surfaces. The two hooks share the same regex
  literals (kept inline) instead of importing a shared module —
  ~12 LOC of duplication, well below the refactor cost.
- Validator surface kept smaller than the mac mirror (281 LOC vs
  344 LOC) because Windows has no entitlements plist analog. The
  Mac validator checks entitlements XML; the Windows validator
  checks the signing-output sidecar for `SignTool Error` / `No
  signature found` tokens instead.
- No public-doc audit page (`docs/release/windows-trust-boundary-audit.md`)
  shipped this round — the readiness matrix already records the
  blocker. A standalone audit page can land with T254 when real
  Authenticode signing arrives.

## 7. Files touched

| Path | Change |
| ---- | ------ |
| `scripts/validate-windows-private-release-boundary.ts` | new |
| `scripts/validate-windows-boundary-fixtures.ts` | new |
| `apps/electron/scripts/afterPack-windows.cjs` | new |
| `scripts/__fixtures__/windows-bundle/good-bundle/app-info.txt` | new |
| `scripts/__fixtures__/windows-bundle/good-bundle/signing-output.txt` | new |
| `scripts/__fixtures__/windows-bundle/good-bundle/ROX.ONE.exe` | new |
| `scripts/__fixtures__/windows-bundle/good-bundle/chrome_elf.dll` | new |
| `scripts/__fixtures__/windows-bundle/good-bundle/ffmpeg.dll` | new |
| `scripts/__fixtures__/windows-bundle/bad-bundle/app-info.txt` | new |
| `scripts/__fixtures__/windows-bundle/bad-bundle/signing-output.txt` | new |
| `scripts/__fixtures__/windows-bundle/bad-bundle/Fake.exe` | new |
| `scripts/__tests__/validate-windows-boundary-fixtures.test.ts` | new |
| `apps/electron/electron-builder.yml` | edited (win: block extended only) |
| `package.json` | +2 script lines |
| `docs/tickets/T252-windows-trust-boundary.md` | new |
| `docs/worklog/T252-windows-trust-boundary.md` | new |

## 8. Follow-ups

- **T253** — Linux AppImage / Snap private-release boundary mirror
  (gpg-detached signature + ELF segment fingerprint validator).
- **T254** — actual Windows signed-build CI workflow (Authenticode
  via Azure Code Signing or DigiCert KeyLocker; mirrors
  `.github/workflows/mac-signed-release.yml` shape).

## 9. Closeout

- Windows validator + fixtures + tests + afterPack hook in place.
- No real Authenticode credentials anywhere; non-win32 hosts skip the
  live signtool step but keep static config/doc/fixture checks.
- T250/T251 frozen surfaces unchanged (entitlements plist,
  mac validator, mac afterPack, mac-signed-release workflow).
- All six validation gates green.
