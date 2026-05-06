# T070 - Private CI/CD Release Pipeline

## 1. Task summary

Add a private release validation contract and local release gate for the ROX ONE
integration branch without introducing real external providers or secrets.

## 2. Repo context discovered

- Existing workflows: `validate.yml`, `validate-server.yml`, `e2e-core.yml`,
  and `mac-arm-build.yml`.
- Existing scripts include `validate:ci`, `validate:ci-contract`,
  `validate:mac-arm-build-workflow`, `e2e:core`, and `electron:build`.
- Current CI coverage is split across workflows; there is no single private
  release candidate workflow contract that covers docs, lint, typecheck, full
  deterministic tests, Electron build, Mac ARM validation, and private artifact
  upload.

## 3. Files inspected

- `package.json`
- `.github/workflows/validate.yml`
- `.github/workflows/e2e-core.yml`
- `.github/workflows/mac-arm-build.yml`
- `.github/workflows/validate-server.yml`
- `scripts/validate-ci-contract.ts`
- `scripts/validate-mac-arm-build-workflow.ts`
- `scripts/electron-dist-dev-mac-arm64.ts`
- `apps/electron/electron-builder.mac-arm64.yml`
- `scripts/build/darwin.ts`
- `scripts/build/linux.ts`
- `scripts/build/win32.ts`
- `scripts/build/common.ts`
- `scripts/release.ts`
- `scripts/check-version.ts`
- `packages/server-core/src/handlers/rpc/transfer.test.ts`

## 4. Tests added first

- Added `scripts/validate-private-release-pipeline.ts` as a contract validator
  for local scripts, private release workflow gates, Mac ARM workflow linkage,
  and private artifact upload behavior.

## 5. Expected failing test output

- `bun run scripts/validate-private-release-pipeline.ts`
  failed before implementation with:
  `[private-release-pipeline] package.json missing script: validate:private-release-pipeline`.
- The first full `bun run validate:release` run later exposed one unrelated
  flaky real-time test under full-suite load:
  `chunked transfer handlers > refreshes TTL as chunks arrive so slow healthy uploads survive`.
  The failure happened after `4668 pass / 13 skip / 1 fail`.

## 6. Implementation changes

- Added `.github/workflows/private-release.yml` with a private release
  candidate gate for docs validation, lint, typecheck, full deterministic
  tests, Electron build, Mac ARM workflow contract validation, private release
  pipeline validation, and private artifact upload.
- Added `scripts/validate-private-release-pipeline.ts` to verify the private
  release workflow and package script contract locally.
- Added `validate:private-release-pipeline` and `validate:release` scripts.
- Extended `validate:ci` so the private release pipeline contract remains part
  of the default CI validation surface.
- Stabilized the transfer TTL regression test with Bun fake timers. Runtime
  transfer behavior was not changed; the test no longer relies on wall-clock
  sleeps that can expire under full-suite load.

## 7. Validation commands run

- `bun run scripts/validate-private-release-pipeline.ts` - expected red before
  implementation.
- `bun run validate:private-release-pipeline` - pass.
- `bun test packages/server-core/src/handlers/rpc/transfer.test.ts --rerun-each 10` - pass.
- `bun run validate:release` - pass.
- `bun run validate:ci-contract` - pass.
- `git diff --check` - pass.

## 8. Passing test output summary

- `bun run validate:private-release-pipeline`:
  `[private-release-pipeline] ok: private release workflow, scripts, and artifact gates passed`.
- `bun test packages/server-core/src/handlers/rpc/transfer.test.ts --rerun-each 10`:
  `50 pass / 0 fail / 60 expect() calls`.
- `bun run validate:release`:
  `bun test` passed with `4669 pass / 13 skip / 0 fail / 1 snapshots /
  11919 expect() calls / 4682 tests across 392 files`.
- `bun run validate:ci-contract`:
  `[ci-contract] ok: workflow, package scripts, and validator fixture checks passed`.

## 9. Build output summary

`bun run validate:release` ran `bun run electron:build` successfully. The build
completed with existing non-blocking warnings: Vite chunk-size warnings and
Jotai deprecation warnings in the Electron build output.

## 10. Remaining risks

- Remote GitHub Actions execution was not run from this local environment.
- Signed and notarized production release packaging still requires production
  credentials and remains outside this deterministic private release contract.
- Existing ESLint warnings remain in unrelated `App.tsx` and
  `FreeFormInput.tsx` surfaces.
- The root `build` package script still points at `scripts/build.ts`, which is
  not present in this branch. T070 adds a deterministic private release gate
  through `validate:release` and does not alter the legacy build wrapper.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Private release workflow contract exists | DONE | `.github/workflows/private-release.yml`; `bun run validate:private-release-pipeline` |
| Local `validate:release` gate exists | DONE | `package.json`; `bun run validate:release` |
| `validate:ci` includes private release contract check | DONE | `package.json`; `bun run validate:ci-contract` |
| Mac ARM workflow remains contract-validated | DONE | `bun run validate:release` includes `validate:mac-arm-build-workflow` |
| Worklog complete | DONE | This file |
| Scoped commit exists | DONE | Commit after staging T070-only files |
