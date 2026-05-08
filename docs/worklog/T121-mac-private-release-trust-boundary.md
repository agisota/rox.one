# T121 - Mac Private Release Trust Boundary Worklog

## 1. Task summary

Add a deterministic validator for the current macOS private/local release trust
boundary and require the Mac ARM workflow to run it before artifact upload.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 23]
```

## 2. Repo context discovered

- T091 documented the current local packaged app as ad-hoc signed and not
  notarized.
- T115 and the current build pass produced fresh local macOS arm64 artifacts.
- `apps/electron/electron-builder.yml` intentionally has `asar: false` and
  comments that signing/notarization are disabled by default for local builds.
- The Mac ARM workflow builds, smokes, and uploads artifacts, but it does not
  yet run an explicit private-release trust-boundary validator before upload.
- Live local signature evidence:
  - `codesign -dv --verbose=4 apps/electron/release/mac-arm64/ROX.ONE.app`
    reports `Signature=adhoc` and `TeamIdentifier=not set`.
  - `xcrun stapler validate apps/electron/release/mac-arm64/ROX.ONE.app`
    reports `ROX.ONE.app does not have a ticket stapled to it.`

## 3. Files inspected

- `package.json`
- `.github/workflows/mac-arm-build.yml`
- `scripts/validate-mac-arm-build-workflow.ts`
- `scripts/validate-private-release-pipeline.ts`
- `scripts/validate-packaged-artifacts.ts`
- `apps/electron/electron-builder.yml`
- `docs/tickets/T091-packaged-release-hardening.md`
- `docs/worklog/T091-packaged-release-hardening.md`
- `docs/tickets/T115-release-validation-build-gate.md`
- `docs/worklog/T115-release-validation-build-gate.md`

## 4. Tests added first

Red command before implementation:

```bash
bun run validate:mac-private-release-boundary
```

Expected result: FAIL because `validate:mac-private-release-boundary` is not
defined in `package.json`.

Second red contract after adding the validator and workflow-contract assertion:

```bash
bun run validate:mac-arm-build-workflow
```

Expected result before workflow wiring: FAIL because
`.github/workflows/mac-arm-build.yml` does not yet run
`bun run validate:mac-private-release-boundary`.

## 5. Expected failing test output

First red command before implementation:

```bash
bun run validate:mac-private-release-boundary
```

Actual result:

```text
error: Script not found "validate:mac-private-release-boundary"
```

Second red command after adding the validator and workflow-contract assertion,
but before wiring the workflow gate:

```bash
bun run validate:mac-arm-build-workflow
```

Actual result:

```text
[mac-arm-build-workflow] workflow missing private mac release trust-boundary gate: bun run validate:mac-private-release-boundary
```

## 6. Implementation changes

- Added `scripts/validate-mac-private-release-boundary.ts`.
- Added package script `validate:mac-private-release-boundary`.
- Updated `scripts/validate-mac-arm-build-workflow.ts` so the Mac ARM workflow
  contract requires the new private-release trust-boundary gate and script.
- Updated `.github/workflows/mac-arm-build.yml` to run
  `bun run validate:mac-private-release-boundary` before artifact upload.
- Updated `scripts/validate-private-release-pipeline.ts` so the broader private
  release pipeline contract also requires the Mac ARM workflow gate.
- Updated release docs to list T121 and keep the signed/notarized production
  blocker separate from the private/local RC validator.

## 7. Validation commands run

```bash
bun run validate:mac-private-release-boundary
bun run validate:mac-arm-build-workflow
bun run validate:private-release-pipeline
bun run validate:docs
git diff --check
git status --short -- package.json bun.lock apps/electron/package.json
git status --short --branch
```

## 8. Passing test output summary

Private mac release boundary:

```text
[mac-private-release-boundary] packaged app signature: adhoc, TeamIdentifier=not set
[mac-private-release-boundary] packaged app notarization: no stapled ticket
[mac-private-release-boundary] ASAR/signing/notarization boundary is documented as private/local RC only
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
[agent-contract] ok: 11 skills, 122 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /Users/marklindgreen/Projects/rox/rox/docs/architecture/sync-v2-design.md
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

Result: only `M package.json`, which is the intended new script entry. `bun.lock`
and `apps/electron/package.json` are unchanged.

## 9. Remaining risks

- T121 does not create a Developer ID signature, notarize the app, enable ASAR,
  upload artifacts, or mutate existing packaged artifacts.
- The current macOS package remains private/local RC evidence only:
  ad-hoc signed, no TeamIdentifier, and no stapled notarization ticket.
- Public production remains blocked until production signing/notarization,
  provider/hosted infrastructure, dependency remediation or signed
  accepted-risk approval, and external security review are complete.

## 10. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Worklog captures red script-missing evidence | Done | Section 5 |
| Workflow contract fails before workflow gate is added | Done | Section 5 |
| Mac private release boundary validator exists | Done | Section 6 |
| Validator confirms ASAR-disabled local-RC config is documented | Done | Sections 6 and 8 |
| Validator confirms current packaged app is ad-hoc signed on macOS | Done | Section 8 |
| Validator confirms current packaged app has no stapled notarization ticket on macOS | Done | Section 8 |
| Mac ARM workflow runs the boundary validator before upload | Done | Sections 6 and 8 |
| Workflow contract validators require the new gate | Done | Sections 6 and 8 |
| Package/lock dependency files remain stable except intended script entry | Done | Section 8 |
| Focused validation passes | Done | Section 8 |
| Worklog is complete | Done | Sections 1-10 |
| Scoped Lore commit exists | Done | This T121 Lore commit |
