# T477 CircleCI second-round repairs

## 1. Task summary

Repair the second set of CircleCI failures on PR #217 and keep the stacked PR
#218 rebased on the repaired base.

## 2. Repo context discovered

CircleCI job logs showed validate failures in Playwright-backed probes, the
R.11 preflight snapshot, Shiki singleton tests, and then a clean-runner SPA
route-crawler startup timeout. The local full unit gate also exposed the same
Shiki cold-start timeout class in the highlight corpus test. mac-arm packaging
failed after the schema step when electron-builder traversed production
dependencies and hit `libsignal`'s exact `protobufjs@6.8.8` dependency; after
that fix, the live mac trust-boundary validator reached codesign and exposed
that metadata and entitlements should be requested separately, then exposed an
ad-hoc `Identifier=ROX.ONE` fallback while Info.plist still carried the
canonical `CFBundleIdentifier=com.rox.one`.

## 3. Files inspected

- `.circleci/config.yml`
- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `scripts/validate-mac-arm-build-workflow.ts`
- `apps/electron/electron-builder.yml`
- `apps/electron/src/renderer/components/shiki/__tests__/ShikiCodeEditor.singleton.test.ts`
- `packages/shared/src/highlight/__tests__/highlight-corpus.test.ts`
- `packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts`
- `packages/audit/tests/route-crawler.test.ts`
- `packages/audit/src/runners/dev-server-runner.ts`
- `packages/audit/tests/runners/dev-server-runner.test.ts`
- `scripts/validate-mac-private-release-boundary.ts`
- `scripts/__tests__/validate-mac-boundary-fixtures.test.ts`

## 4. Tests added first

- Added a preflight unit case that removes CLI access from `PATH` and expects
  snapshot collection to complete without throwing.
- Extended the mac-arm workflow validator to require the electron-builder
  `beforeBuild` hook and its `return false` external node_modules signal.
- Extended the dev-server runner timeout test to require captured child output
  in timeout errors.
- Added a static mac-boundary fixture assertion that live validation keeps
  codesign metadata separate from entitlements output.

## 5. Expected failing test output

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts --timeout 20000`
  failed with `Executable not found in $PATH: "gh"`.
- `bun run validate:mac-arm-build-workflow` failed with
  `missing apps/electron/scripts/beforeBuild.cjs`.
- CircleCI `validate` build 63 failed with
  `spawnDevServer timeout: ready pattern not seen within 30000ms` before
  `crawlRoutes > discovers /, /about, /contact from SPA fixture`.
- CircleCI `mac-arm-build` build 66 failed with
  `missing ROX.ONE code signing identifier: Identifier=com.rox.one`.
- CircleCI `mac-arm-build` builds 84 and 89 still failed with the same
  identifier assertion after metadata/entitlements were split.
- CircleCI `validate` build 86 proved the root Vite process was starting, but
  the raw colored Vite banner prevented ready-pattern matching:
  `Recent output: VITE v6.4.2 ready in 175 ms ... Local: http://127.0.0.1:5174/`.

## 6. Implementation changes

- CircleCI validate now installs Playwright Chromium before unit tests.
- R.11 preflight command execution now converts missing executables into an
  exit-127 result so the snapshot can fail closed.
- Shiki singleton tests use smaller language/theme fixtures and a 30 second Bun
  test timeout for highlighter rebuild paths.
- Highlight corpus tests use the same 30 second Bun timeout for cold Shiki
  startup paths.
- Electron-builder gets a `beforeBuild` hook returning `false`, matching the
  upstream contract for externally handled `node_modules`.
- The audit route-crawler fixture starts root-installed Vite directly and uses
  a 90 second CI startup budget, avoiding fixture-local dependency installs on
  clean CircleCI runners.
- `spawnDevServer` now preserves recent child stdout/stderr in timeout and
  pre-ready exit errors.
- `spawnDevServer` matches ready patterns against ANSI-stripped output so
  colored Vite banners do not hide the `Local:` URL on CircleCI.
- The live mac trust-boundary validator now runs one codesign call for metadata
  and one for entitlements before applying the identifier/signature/entitlement
  assertions.
- The live mac trust-boundary validator now asserts the canonical Info.plist
  bundle id first, then accepts either `Identifier=com.rox.one` or the
  ad-hoc executable fallback `Identifier=ROX.ONE`; live codesign output is used
  for hardened runtime and entitlement checks without requiring fixture-only
  per-binary sidecar entries.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts --timeout 20000`
- `bun run validate:mac-arm-build-workflow`
- `bun test packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts apps/electron/src/renderer/components/shiki/__tests__/ShikiCodeEditor.singleton.test.ts`
- `bun test packages/shared/src/highlight/__tests__/highlight-corpus.test.ts`
- `bun run validate:docs`
- `bun run validate:ci-contract`
- `bun run validate:rebrand`
- `bun run typecheck`
- `bun run lint`
- `bun -e "const yaml=require('js-yaml'); const fs=require('fs'); for (const f of ['.circleci/config.yml','apps/electron/electron-builder.yml']) yaml.load(fs.readFileSync(f,'utf8'))"`
- `bun run webui:build`
- `bun run test:units`
- `NODE_OPTIONS=--max-old-space-size=2048 bun run validate:ci`
- `git diff --check`
- `CI=true bun test`
- `bun test packages/audit/tests/runners/dev-server-runner.test.ts packages/audit/tests/route-crawler.test.ts scripts/__tests__/validate-mac-boundary-fixtures.test.ts`
- `bun run validate:mac-private-release-boundary`
- `bun run validate:mac-arm-build-workflow`
- `CI=true bun run test:units`
- `NODE_OPTIONS=--max-old-space-size=2048 bun run validate:ci`

## 8. Passing test output summary

- Preflight targeted test: `35 pass, 0 fail, 160 expect() calls`.
- Mac ARM workflow validator:
  `[mac-arm-build-workflow] ok: Mac ARM workflow contract passed`.
- Shiki singleton tests: `14 pass, 0 fail, 37 expect() calls`.
- Highlight corpus targeted test: `24 pass, 0 fail, 94 expect() calls`.
- Full unit gate: `6913 pass, 13 skip, 0 fail, 1 snapshots, 27563 expect() calls`,
  followed by isolated tests passing.
- Updated full unit gate after the CircleCI-only route-crawler repair:
  `6914 pass, 13 skip, 0 fail, 1 snapshots, 27568 expect() calls`, followed
  by isolated tests passing.
- `CI=true bun test`: `6913 pass, 13 skip, 0 fail, 1 snapshots, 27543 expect() calls`.
- Targeted route-crawler/dev-server/mac-boundary repair tests:
  `15 pass, 0 fail, 39 expect() calls`.
- Updated full unit gate after the ANSI/mac-identifier repair:
  `6915 pass, 13 skip, 0 fail, 1 snapshots, 27569 expect() calls`, followed
  by isolated tests passing.
- `validate:docs`, `validate:ci-contract`, `validate:rebrand`, `typecheck`, and
  YAML parsing passed.
- `lint` passed with existing warnings only.
- Updated `validate:ci` passed through agent/architecture/CI/private-release
  contracts, typecheck, shared/doc tests, audit smoke, and i18n
  parity/sort/coverage.

## 9. Build output summary

- `bun run webui:build` passed after removing generated local `/tmp` artifacts.
- `validate:ci` rebuilt webui, viewer, and marketing during audit smoke; all
  audit queues reported `0 findings`.
- CircleCI rerun remains the remote proof after push.

## 10. Remaining risks

CircleCI macOS packaging is the only full proof that the separated codesign
metadata/entitlement validation matches the current macOS runner behavior.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| CircleCI validate installs Playwright browser deps | Done | `.circleci/config.yml` installs Playwright Chromium before tests |
| Preflight tolerates missing external CLIs | Done | `bun test scripts/__tests__/rebrand-r11-preflight.test.ts --timeout 20000` |
| Shiki highlighter tests avoid cold-start timeout | Done | Singleton targeted tests and `highlight-corpus` pass locally |
| mac ARM skips automatic production dependency collector | Done | `bun run validate:mac-arm-build-workflow` |
| SPA route crawler avoids clean-runner fixture install timeout | Done | Root Vite binary launch + targeted route-crawler test |
| Live mac validator keeps codesign metadata visible | Done | Static fixture test for split codesign calls |
| Live mac validator accepts ad-hoc executable identifier fallback after canonical Info.plist check | Done | Static fixture test plus `bun run validate:mac-private-release-boundary` |
| Local validation passes | Done | `CI=true bun run test:units` and `NODE_OPTIONS=--max-old-space-size=2048 bun run validate:ci` |
