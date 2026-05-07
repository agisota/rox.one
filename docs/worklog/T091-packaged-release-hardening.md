# T091 - Packaged Release Hardening Worklog

## 1. Task summary

Create one narrow packaged-release hardening slice that improves packaged mac
arm64 artifact auditability with deterministic validation and explicit release
risk evidence.

## 2. Repo context discovered

- Packaging already succeeds for the local mac arm64 dev release path and
  packaged smoke is known green from the current verified state.
- Existing release scripts validate workflow/pipeline contracts, but there is no
  dedicated packaged-artifact evidence script in the root script surface yet.
- `apps/electron/release/` already contains the expected arm64 dmg/zip artifacts
  and update manifest.
- `electron-builder.yml` intentionally disables ASAR and local packaging is
  expected to remain ad-hoc signed / non-notarized in this slice.

## 3. Files inspected

- `AGENTS.md`
- `package.json`
- `apps/electron/electron-builder.yml`
- `scripts/electron-dist-dev-mac-arm64.ts`
- `scripts/electron-smoke-packaged-mac.ts`
- `scripts/validate-mac-arm-build-workflow.ts`
- `scripts/validate-private-release-pipeline.ts`
- `docs/release/current-state-snapshot-2026-05-06.md`
- `docs/release/final-rc-2026-05-06.md`
- `docs/release/production-readiness-matrix-2026-05-06.md`
- `docs/validation/baseline-commands.md`
- `apps/electron/release/`

## 4. Tests or validation checks added first

Planned first:

- Add a focused `validate:packaged-artifacts` script that fails clearly when the
  expected arm64 packaged release files are missing or when `latest-mac.yml`
  stops referencing the expected arm64 artifacts.
- Use the script to emit deterministic artifact size/checksum evidence without
  mutating the packaged output.

## 5. Expected failing test output or baseline validation output

Initial expected baseline before implementation:

```bash
bun run validate:packaged-artifacts
```

Expected result before implementation: fail because no such package script exists
in `package.json` yet.

## 6. Implementation changes

- Added `scripts/validate-packaged-artifacts.ts`.
- Added package script `validate:packaged-artifacts` in `package.json`.
- The validation script:
  - requires the expected mac arm64 packaged artifact set in
    `apps/electron/release/`;
  - computes SHA256 for the arm64 dmg and zip;
  - prints exact artifact sizes in bytes and human-readable units;
  - parses `latest-mac.yml` with existing `js-yaml` and verifies it references
    `ROX-ONE-arm64.zip` and `ROX-ONE-arm64.dmg`;
  - verifies manifest size fields match the on-disk dmg/zip sizes;
  - does not mutate artifacts, notarize, or upload anything.
- Updated T091 ticket/release docs to capture packaged artifact evidence and
  classify current packaging warnings as accepted local-RC risks or explicit
  follow-up work.

## 7. Validation commands run

```bash
bun run validate:packaged-artifacts
```

Result: PASS. Required artifact set present; SHA256 and size evidence printed;
`latest-mac.yml` arm64 references and size fields verified.

```bash
bun run electron:smoke:packaged:mac
```

Result: PASS. Packaged app emitted the required startup marker and exited cleanly
in smoke mode.

```bash
bun run validate:docs
```

Result: PASS (`11 skills`, `92 tickets`, `7 required docs`).

```bash
git diff --check
```

Result: PASS.

## 8. Passing test output summary

- `validate:packaged-artifacts`: PASS.
- `electron:smoke:packaged:mac`: PASS (`[packaged-smoke] ROX ONE packaged headless startup passed`).
- `validate:docs`: PASS.
- `git diff --check`: PASS.

## 9. Build output summary

No new packaged build was required in this slice. Existing verified artifacts in
`apps/electron/release/` were reused as read-only evidence:

- `apps/electron/release/ROX-ONE-arm64.dmg` — `324517354` bytes (`309.48 MB`)
- `apps/electron/release/ROX-ONE-arm64.zip` — `313597089` bytes (`299.07 MB`)
- `apps/electron/release/ROX-ONE-arm64.dmg.blockmap` — `339647` bytes (`331.69 KB`)
- `apps/electron/release/ROX-ONE-arm64.zip.blockmap` — `321420` bytes (`313.89 KB`)
- `apps/electron/release/latest-mac.yml` — `479` bytes

SHA256:

- dmg: `bffb62ba827eff5d16e709ff3f59fef79ba279315ffe11768a96912d134c34a5`
- zip: `053913f3ebbccbb1f85dc526c865be8b8cdc2bf1d3c11a69e167471b885b7255`

## 10. Remaining risks

- `asar: false` remains an intentional local packaging choice but electron-builder
  warns that disabling ASAR is strongly discouraged; this should be handled as a
  follow-up packaging/performance/security decision rather than silently ignored.
- The packaged app is ad-hoc signed (`codesign -dv` reported `Signature=adhoc`,
  `TeamIdentifier=not set`) and is not notarized (`xcrun stapler validate`
  reported no stapled ticket). This is acceptable for current private/local RC
  evidence but blocks production-grade distribution trust.
- `Assets.car` exists inside the bundled app resources, but current release risk
  evidence still treats the stale-asset/icon fallback warning as unresolved until
  a dedicated icon pipeline follow-up verifies that the packaged app is using the
  intended macOS asset catalog behavior on target machines.
- Vite large chunk warnings remain a follow-up performance/bundle-budget task,
  not a blocker for this packaged-artifact audit slice.
- Missing optional cross-platform dependencies are currently consistent with the
  repo's `optionalDependencies` matrix for Sharp platform packages and are not
  treated as suspicious in this slice.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Packaged mac arm64 artifacts are identified with exact paths | Done | `validate:packaged-artifacts` output + section 9 artifact list |
| Artifact sizes and SHA256 checksums are generated or documented | Done | `validate:packaged-artifacts` output + section 9 checksums |
| Packaged smoke command and result are documented | Done | `bun run electron:smoke:packaged:mac` pass recorded in section 7 |
| ASAR disabled warning is classified as accepted risk or follow-up blocker | Done | Section 10 risk classification |
| Ad-hoc signing / notarization skipped state is explicitly documented | Done | `codesign -dv` / `xcrun stapler validate` evidence in section 10 |
| Stale `Assets.car` / icon fallback is documented with next action | Done | Section 10 risk classification |
| Missing optional dependencies are classified as expected or investigated | Done | Section 10 references `optionalDependencies` matrix |
| Focused validation command passes | Done | Sections 7 and 8 |
| Worklog is complete | Done | This document |
| No unrelated runtime artifacts are touched | Done | `events.jsonl` and `.claude/` excluded from scope |
| Commit exists only after explicit user approval | Pending | No commit created in this session |
