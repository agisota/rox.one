# T122 - Mac ARM Artifact Validator Upload Gate Worklog

## 1. Task summary

Require the Mac ARM workflow to run the existing packaged artifact validator
before uploading macOS arm64 artifacts.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 24]
```

## 2. Repo context discovered

- T091 added `scripts/validate-packaged-artifacts.ts` and root script
  `validate:packaged-artifacts`.
- The Mac ARM workflow currently packages, runs packaged smoke, runs Electron
  smoke, runs the T121 private release boundary validator, and then uploads
  artifacts.
- The workflow does not yet run `bun run validate:packaged-artifacts` before
  upload.
- `validate:mac-arm-build-workflow` and `validate:private-release-pipeline`
  already contract-test key Mac ARM workflow gates, so they are the right
  red/green surfaces for this workflow slice.

## 3. Files inspected

- `.github/workflows/mac-arm-build.yml`
- `scripts/validate-mac-arm-build-workflow.ts`
- `scripts/validate-private-release-pipeline.ts`
- `scripts/validate-packaged-artifacts.ts`
- `package.json`
- `docs/tickets/T121-mac-private-release-trust-boundary.md`
- `docs/worklog/T121-mac-private-release-trust-boundary.md`

## 4. Tests added first

Workflow-contract assertions for `bun run validate:packaged-artifacts` are added
before the workflow step.

Expected red commands:

```bash
bun run validate:mac-arm-build-workflow
bun run validate:private-release-pipeline
```

Expected result before implementation: FAIL because
`.github/workflows/mac-arm-build.yml` does not yet run
`bun run validate:packaged-artifacts`.

## 5. Expected failing test output

Red command after adding workflow-contract assertions, before workflow wiring:

```bash
bun run validate:mac-arm-build-workflow
```

Actual result:

```text
[mac-arm-build-workflow] workflow missing packaged artifact validation gate: bun run validate:packaged-artifacts
```

Second red command:

```bash
bun run validate:private-release-pipeline
```

Actual result:

```text
[private-release-pipeline] missing Mac ARM workflow release gate: bun run validate:packaged-artifacts
```

## 6. Implementation changes

- Updated `scripts/validate-mac-arm-build-workflow.ts` to require
  `validate:packaged-artifacts` as a root script and Mac ARM workflow gate.
- Updated `scripts/validate-private-release-pipeline.ts` to require the Mac ARM
  workflow to run `bun run validate:packaged-artifacts`.
- Updated `.github/workflows/mac-arm-build.yml` to run
  `bun run validate:packaged-artifacts` after smoke checks and before the T121
  private release boundary gate plus artifact upload.
- Updated release docs to list T122 and record packaged artifact validation as
  a Mac ARM upload precondition.

## 7. Validation commands run

```bash
bun run validate:packaged-artifacts
bun run validate:mac-arm-build-workflow
bun run validate:private-release-pipeline
bun run validate:docs
git diff --check
git status --short -- package.json bun.lock apps/electron/package.json
git status --short --branch
```

## 8. Passing test output summary

Packaged artifact validator:

```text
[packaged-artifacts] required packaged artifacts present
- apps/electron/release/ROX-ONE-arm64.dmg :: 328212696 bytes (313.01 MB)
- apps/electron/release/ROX-ONE-arm64.zip :: 317260984 bytes (302.56 MB)
- apps/electron/release/ROX-ONE-arm64.dmg.blockmap :: 343696 bytes (335.64 KB)
- apps/electron/release/ROX-ONE-arm64.zip.blockmap :: 322786 bytes (315.22 KB)
- apps/electron/release/latest-mac.yml :: 479 bytes (479 B)
[packaged-artifacts] SHA256 ROX-ONE-arm64.dmg 7702af190a399a9ca6e41a38d5f4e6aac1e31ec172a90f780b041150b10f42ae
[packaged-artifacts] SHA256 ROX-ONE-arm64.zip ba178ee68b578412810f89090a48e5c56915e87453bc5e5daab516a8fd79ef30
[packaged-artifacts] latest-mac.yml path=ROX-ONE-arm64.zip
[packaged-artifacts] latest-mac.yml size[dmg]=328212696 bytes
[packaged-artifacts] latest-mac.yml size[zip]=317260984 bytes
[packaged-artifacts] latest-mac.yml artifact references verified
```

Mac ARM workflow contract:

```text
[mac-arm-build-workflow] ok: Mac ARM workflow contract passed
```

Private release pipeline contract:

```text
[private-release-pipeline] ok: private release workflow, scripts, and artifact gates passed
```

Docs validation:

```text
[agent-contract] ok: 11 skills, 123 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /Users/marklindgreen/Projects/craft/craft/docs/architecture/sync-v2-design.md
```

Whitespace:

```text
git diff --check
```

Result: PASS with no output.

Package/lock hygiene:

```text
git status --short -- package.json bun.lock apps/electron/package.json
```

Result: PASS with no output.

## 9. Remaining risks

- T122 does not rebuild or mutate packaged artifacts; it reuses the existing
  validator and workflow contract.
- T122 does not sign, notarize, enable ASAR, upload artifacts, or unblock public
  production.
- The current local artifacts remain private/local RC evidence only.

## 10. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Worklog captures red workflow-contract evidence | Done | Section 5 |
| Mac ARM workflow runs packaged artifact validation before upload | Done | Sections 6 and 8 |
| Mac ARM workflow contract requires packaged artifact validation | Done | Sections 5 and 8 |
| Private release pipeline contract requires packaged artifact validation in Mac ARM workflow | Done | Sections 5 and 8 |
| Existing packaged artifact validator passes | Done | Section 8 |
| Package/lock dependency files remain unchanged | Done | Section 8 |
| Focused validation passes | Done | Section 8 |
| Release docs mention T122 upload-gate evidence | Done | Section 6 |
| Worklog is complete | Done | Sections 1-10 |
| Scoped Lore commit exists | Done | This T122 Lore commit |
