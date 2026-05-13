# T252 - Windows private-release trust boundary mirror

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

T250 shipped the Mac trust-boundary validator + entitlements
hardening. T251 wired the signed-build CI workflow + fixture
coverage. T252 mirrors the same boundary discipline for **Windows**
private releases so the NSIS installer artifact has the same shape
guarantees the Mac DMG path already has.

## Scope

This ticket ships five Windows-specific artifacts and a minimal
electron-builder.yml extension:

1. **`scripts/validate-windows-private-release-boundary.ts`** —
   analogous to the Mac validator but for Windows. Asserts:
   - canonical `one.rox.workbench[.*]` or fallback `com.rox.one[.*]`
     AppUserModelID via `app-info.txt` sidecar.
   - `FileVersion` is a dotted Windows version (`a.b.c.d`).
   - `signing-output.txt` contains canonical `Subject:`, `Issuer:`,
     `SHA1 hash:` tokens — never `SignTool Error` / `No signature
     found` / `is not signed`.
   - `(T252 windows boundary ok)` afterPack marker present in either
     sidecar.
   - Native binaries (`.exe`, `.dll`, `.node`) listed in the
     signing-output sidecar.
   - No symlinks escaping the install dir.
   - Non-win32 hosts skip the live signtool grep, mirroring the
     Mac validator's non-darwin skip pattern.
2. **`apps/electron/scripts/afterPack-windows.cjs`** — Windows post-
   pack hook. Validates the canonical appId + version shape from the
   electron-builder context, walks symlinks for escapes, writes
   `app-info.txt` and appends the canonical T252 marker. No real
   signtool invocation, no credentials. Kept separate from the
   macOS afterPack because the Mac variant is icon/plutil-heavy and
   sharing would have required a non-trivial refactor of T250.
3. **`scripts/__fixtures__/windows-bundle/{good,bad}-bundle/`** —
   minimal fixtures: `app-info.txt`, `signing-output.txt`, and stub
   binaries. The good bundle ships canonical metadata; the bad
   bundle ships `com.notrox.fake` appId + `SignTool Error` sidecar.
4. **`scripts/__tests__/validate-windows-boundary-fixtures.test.ts`** —
   bun:test asserting good=green, bad=red. 8 tests, 33 expect()
   calls.
5. **`scripts/validate-windows-boundary-fixtures.ts`** + package.json
   scripts. Mirror of T251's mac orchestrator.

Plus a minimal `win:` extension in `apps/electron/electron-builder.yml`:
inert `signtoolOptions` block + `publisherName` pin + `# T252:
trust-boundary signing placeholder` comment that the validator greps
for.

## Out of scope

- Real Authenticode / EV code-signing credentials. The
  `signtoolOptions` block intentionally ships with `sign: null` and
  empty hash algorithms so local builds stay unsigned. T254 will add
  the signed-build CI workflow.
- Build-number minting automation. The validator just asserts the
  dotted shape; CI sets the actual version per release.

## Rules followed

- No secrets added anywhere. No signtool invocation in code paths
  that run on developer machines.
- ≤500 LOC source/script changes (275 + 123 + 85 = 483 LOC actual).
- ≤200 LOC fixtures (11 fixture files, 52 LOC total).
- ≤300 LOC tests (109 LOC test file).
- Non-win32 hosts skip the live signtool check but still validate
  scripts/docs/config — the validator stays cross-platform.
- T250/T251 surfaces untouched: `apps/electron/build/entitlements.mac.plist`,
  `scripts/validate-mac-private-release-boundary.ts`,
  `apps/electron/scripts/afterPack.cjs`, and
  `.github/workflows/mac-signed-release.yml` are byte-identical to
  origin/main.

## Validation gates

- `bun run validate:windows-private-release-boundary` — pass (non-win32
  marks signtool steps as skipped; docs/config asserts hold).
- `bun run validate:windows-boundary-fixtures` — pass (good green,
  bad red).
- `bun test scripts/__tests__/validate-windows-boundary-fixtures.test.ts` —
  8 pass / 0 fail / 33 expect() calls.
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pass with T252 `Status: DONE`.
- `bun run validate:roadmap` — pass.

## Follow-ups

- **T253** — Linux AppImage / Snap private-release boundary mirror.
- **T254** — actual Windows signed-build CI workflow (Authenticode
  via Azure Code Signing or DigiCert KeyLocker, fed by repo secrets).
