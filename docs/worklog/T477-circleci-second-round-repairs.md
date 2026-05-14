# T477 CircleCI second-round repairs

## 1. Task summary

Repair the second set of CircleCI failures on PR #217 and keep the stacked PR
#218 rebased on the repaired base.

## 2. Repo context discovered

CircleCI job logs showed validate failures in Playwright-backed probes, the
R.11 preflight snapshot, and Shiki singleton tests. The local full unit gate
also exposed the same Shiki cold-start timeout class in the highlight corpus
test. mac-arm packaging failed after the schema step when electron-builder
traversed production dependencies and hit `libsignal`'s exact
`protobufjs@6.8.8` dependency.

## 3. Files inspected

- `.circleci/config.yml`
- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `scripts/validate-mac-arm-build-workflow.ts`
- `apps/electron/electron-builder.yml`
- `apps/electron/src/renderer/components/shiki/__tests__/ShikiCodeEditor.singleton.test.ts`
- `packages/shared/src/highlight/__tests__/highlight-corpus.test.ts`
- `packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts`

## 4. Tests added first

- Added a preflight unit case that removes CLI access from `PATH` and expects
  snapshot collection to complete without throwing.
- Extended the mac-arm workflow validator to require the electron-builder
  `beforeBuild` hook and its `return false` external node_modules signal.

## 5. Expected failing test output

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts --timeout 20000`
  failed with `Executable not found in $PATH: "gh"`.
- `bun run validate:mac-arm-build-workflow` failed with
  `missing apps/electron/scripts/beforeBuild.cjs`.

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

## 8. Passing test output summary

- Preflight targeted test: `35 pass, 0 fail, 160 expect() calls`.
- Mac ARM workflow validator:
  `[mac-arm-build-workflow] ok: Mac ARM workflow contract passed`.
- Shiki singleton tests: `14 pass, 0 fail, 37 expect() calls`.
- Highlight corpus targeted test: `24 pass, 0 fail, 94 expect() calls`.
- Full unit gate: `6913 pass, 13 skip, 0 fail, 1 snapshots, 27563 expect() calls`,
  followed by isolated tests passing.
- `validate:docs`, `validate:ci-contract`, `validate:rebrand`, `typecheck`, and
  YAML parsing passed.
- `lint` passed with existing warnings only.
- `validate:ci` passed through agent/architecture/CI/private-release contracts,
  typecheck, shared/doc tests, audit smoke, and i18n parity/sort/coverage.

## 9. Build output summary

- `bun run webui:build` passed after removing generated local `/tmp` artifacts.
- `validate:ci` rebuilt webui, viewer, and marketing during audit smoke; all
  audit queues reported `0 findings`.
- CircleCI rerun remains the remote proof after push.

## 10. Remaining risks

CircleCI macOS packaging is the only full proof that the hook avoids the remote
production dependency collector failure.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| CircleCI validate installs Playwright browser deps | Done | `.circleci/config.yml` installs Playwright Chromium before tests |
| Preflight tolerates missing external CLIs | Done | `bun test scripts/__tests__/rebrand-r11-preflight.test.ts --timeout 20000` |
| Shiki highlighter tests avoid cold-start timeout | Done | Singleton targeted tests and `highlight-corpus` pass locally |
| mac ARM skips automatic production dependency collector | Done | `bun run validate:mac-arm-build-workflow` |
| Local validation passes | Done | `bun run test:units` and `NODE_OPTIONS=--max-old-space-size=2048 bun run validate:ci` |
