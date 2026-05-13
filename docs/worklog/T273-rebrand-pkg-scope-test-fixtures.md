# T273 - Rebrand test-fixtures package scope

## 1. Task summary

Rename the test-only workspace package scope from the legacy test-fixtures
package name to `@rox-one/test-fixtures`.

## 2. Repo context discovered

- Phase R.5.1 explicitly starts with the test-fixtures package because it has
  no production runtime surface.
- Direct `rg` found current references in:
  `packages/test-fixtures/package.json`, `packages/test-fixtures/README.md`,
  `packages/test-fixtures/src/index.ts`, `packages/shared/package.json`,
  two `packages/shared/tests/mode-manager*.test.ts` importers, and `bun.lock`.
- There are no tsconfig path mappings for this package; workspace package
  resolution is via package metadata and lockfile.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `packages/test-fixtures/package.json`
- `packages/test-fixtures/README.md`
- `packages/test-fixtures/src/index.ts`
- `packages/shared/package.json`
- `packages/shared/tests/mode-manager.test.ts`
- `packages/shared/tests/mode-manager-bash-validation.test.ts`
- `bun.lock`
- `tsconfig.json`
- `tsconfig.base.json`

## 4. Tests added first

Added `scripts/__tests__/rebrand-package-scope.test.ts` before implementation.
The T273 test asserts:

- test-fixtures package metadata uses `@rox-one/test-fixtures`;
- shared package devDependency uses `@rox-one/test-fixtures`;
- known shared-test importers use `@rox-one/test-fixtures`;
- package README/source comments use `@rox-one/test-fixtures`;
- lockfile no longer names the legacy test-fixtures scope.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- Result: exit 1.
- Expected failure: `packages/test-fixtures/package.json` still reported
  `@rox-agent/test-fixtures` while the test expected `@rox-one/test-fixtures`.

## 6. Implementation changes

- Renamed `packages/test-fixtures/package.json` package name to
  `@rox-one/test-fixtures`.
- Updated `packages/shared/package.json` devDependency to
  `@rox-one/test-fixtures`.
- Updated known shared-test importers:
  `packages/shared/tests/mode-manager.test.ts` and
  `packages/shared/tests/mode-manager-bash-validation.test.ts`.
- Updated `packages/test-fixtures/README.md` and
  `packages/test-fixtures/src/index.ts` scope references.
- Ran `bun install` to refresh `bun.lock`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun install`
- `bun run typecheck`
- `bun run lint`
- `bun test packages/shared/tests/mode-manager.test.ts packages/shared/tests/mode-manager-bash-validation.test.ts`
- `bun test`
- `bun run build`
- `bun run validate:docs`
- `git diff --check`
- `bun run validate:rebrand` (expected red until later R.5/R.6/R.7 phases)
- `rg -n "@rox-agent/test-fixtures|@rox-one/test-fixtures" packages/test-fixtures packages/shared/package.json packages/shared/tests/mode-manager.test.ts packages/shared/tests/mode-manager-bash-validation.test.ts bun.lock`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`: 1 pass, 0 fail,
  13 assertions.
- `bun install`: exit 0; lockfile saved, 10 packages installed, 1 removed.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- Targeted shared mode-manager tests: 309 pass, 0 fail, 327 assertions.
- `bun test`: 5097 pass, 13 skip, 0 fail, 12942 assertions.
- `bun run build`: exit 0.
- `bun run validate:docs`: exit 0; agent contract, architecture docs, and
  sync-v2 design validators passed.
- `git diff --check`: exit 0.
- `bun run validate:rebrand`: expected exit 1 with 3921 remaining forbidden
  token findings outside the allowlist; dominant buckets are later-phase
  package/env/CLI surfaces (`rox-agent`, `@rox-agent`, `ROX_`,
  `rox-cli`).
- Targeted scope grep shows only `@rox-one/test-fixtures` in the T273 surface.

## 9. Build output summary

`bun run build` passed after the T273 commit. The build completed Electron main,
preload, renderer, resources, and asset steps. Vite reported existing chunk-size
warnings only; there were no build errors.

## 10. Remaining risks

- The rest of R.5 package-scope renames remain intentionally untouched, so
  whole-repo rebrand validation stays expected-red.
- Remote GitHub checks may still fail to start while the account billing lock
  is active; local validation is the authoritative evidence for this sub-phase.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Red test proves test-fixtures scope gap | Pass | Red exit 1 on legacy package name before implementation |
| Package metadata uses `@rox-one/test-fixtures` | Pass | R.5 package-scope regression test passes |
| Known importers use `@rox-one/test-fixtures` | Pass | R.5 package-scope regression test and targeted grep pass |
| Lockfile is refreshed | Pass | `bun install` saved `bun.lock` with the ROX scope |
| Targeted shared tests pass | Pass | 309 pass, 0 fail |
| Full suite passes | Pass | `bun test`: 5097 pass, 13 skip, 0 fail |
| Build passes | Pass | `bun run build`: exit 0 |
| Validation evidence recorded | Pass | Commands and outputs summarized above |
| Worklog complete | Pass | This 11-section worklog is complete |
| Commit created | Pass | This worklog is included in the T273 task commit in git history |
