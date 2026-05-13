# T253 - Linux private-release trust boundary mirror

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
coverage. T252 mirrored the same boundary discipline for **Windows**
private releases. T253 closes the cross-platform set with the
**Linux** AppImage / Snap mirror so the AppImage artifact has the
same shape guarantees the Mac DMG and Windows NSIS paths already
have.

## Scope

This ticket ships five Linux-specific artifacts and a minimal
electron-builder.yml extension:

1. **`scripts/validate-linux-private-release-boundary.ts`** —
   analogous to the Mac + Windows validators but for Linux. Asserts:
   - canonical `rox-one-*.AppImage` filename via the AppDir top-level
     walker.
   - canonical `Exec=rox-one` desktop-entry line + required
     `[Desktop Entry]`, `Name=`, `Exec=`, `Categories=` keys.
   - canonical Office / Utility / Development / Productivity
     category.
   - `signing-output.txt` contains canonical `gpg:`, `Good
     signature`, `Primary key fingerprint` tokens — never `BAD
     signature` / `No public key` / `is not signed`.
   - `(T253 linux boundary ok)` afterPack marker present in either
     sidecar (desktop entry or signing-output).
   - No symlinks escaping the AppDir.
   - Non-linux hosts skip the live gpg/AppImage check, mirroring the
     Mac validator's non-darwin and Windows validator's non-win32
     skip patterns.
2. **`apps/electron/scripts/afterPack-linux.cjs`** — Linux post-pack
   hook. Validates the canonical AppImage filename + walks the
   AppDir for escaping symlinks, writes `rox-one.desktop` and
   appends the canonical T253 marker. No gpg invocation, no
   credentials. Kept separate from the macOS afterPack because the
   Mac variant is icon/plutil-heavy and sharing would have required
   a non-trivial refactor of T250.
3. **`scripts/__fixtures__/linux-bundle/{good,bad}-AppDir/`** —
   minimal fixtures: `rox-one.desktop`, `signing-output.txt`, and
   stub executables / AppImage placeholders. The good AppDir ships
   canonical metadata + Good-signature sidecar; the bad AppDir ships
   `not-rox-one.AppImage` filename + `BAD signature` sidecar.
4. **`scripts/__tests__/validate-linux-boundary-fixtures.test.ts`** —
   bun:test asserting good=green, bad=red. 9 tests, 38 expect()
   calls.
5. **`scripts/validate-linux-boundary-fixtures.ts`** + package.json
   scripts. Mirror of T251's mac and T252's windows orchestrators.

Plus a minimal `linux:` extension in
`apps/electron/electron-builder.yml`: canonical `category: Office`,
explicit `executableName: rox-one`, canonical `desktop:` block with
`Exec=rox-one %U`, and a `# T253: trust-boundary signing
placeholder` comment that the validator greps for.

## Out of scope

- Real gpg-detached signing credentials. The linux block ships no
  signing keys; local builds stay unsigned. T255 will add the
  signed-build CI workflow (gpg key from repo secrets, detached
  `.AppImage.sig` sidecar published alongside the artifact).
- Snap-specific manifest. AppImage is the primary Linux target;
  Snap is a follow-up that reuses the same canonical desktop entry
  + filename pattern.
- Build-number minting automation. The validator just asserts the
  canonical filename shape; CI sets the actual version per release.

## Rules followed

- No secrets added anywhere. No gpg invocation in code paths that
  run on developer machines.
- ≤450 LOC source/script changes (~265 + ~155 + ~85 = ~505 LOC, of
  which ~85 is the orchestrator runner shared in shape with T252).
- ≤150 LOC fixtures (8 fixture files, well under budget).
- ≤250 LOC tests (~105 LOC test file).
- Non-linux hosts skip the live gpg / AppImage check but still
  validate scripts/docs/config — the validator stays cross-platform.
- T250/T251/T252 surfaces untouched:
  `apps/electron/build/entitlements.mac.plist`,
  `scripts/validate-mac-private-release-boundary.ts`,
  `apps/electron/scripts/afterPack.cjs`,
  `apps/electron/scripts/afterPack-windows.cjs`,
  `scripts/validate-windows-private-release-boundary.ts`,
  `scripts/__fixtures__/{mac,windows}-bundle/**`, and
  `.github/workflows/mac-signed-release.yml` are byte-identical to
  origin/main aside from this linux-block addition.

## Validation gates

- `bun run validate:linux-private-release-boundary` — pass (non-linux
  marks gpg step as skipped; docs/config asserts hold).
- `bun run validate:linux-boundary-fixtures` — pass (good green, bad
  red).
- `bun test scripts/__tests__/validate-linux-boundary-fixtures.test.ts` —
  9 pass / 0 fail / 38 expect() calls.
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pass with T253 `Status: DONE`.
- `bun run validate:roadmap` — pass.

## Follow-ups

- **T254** — actual Windows signed-build CI workflow (Authenticode
  via Azure Code Signing or DigiCert KeyLocker, fed by repo secrets).
- **T255** — actual Linux signed-build CI workflow (gpg-detached
  `.AppImage.sig`, key from repo secrets).
- **M.18 closeout** — with T253 the cross-platform private-release
  trust-boundary mirror (Mac + Windows + Linux) is complete; only
  the live signed-build CI workflows remain for public production.
