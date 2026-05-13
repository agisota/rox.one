# T282 - Rebrand shared package scope

## 1. Task summary

Rename the shared workspace package scope from `@craft-agent/shared` to
`@rox-one/shared`.

## 2. Repo context discovered

- Phase R.5.10 follows the landed server and server-core package scope rename.
- The shared package is the highest fan-in R.5 package and remains referenced
  across active app/package dependencies, imports, dynamic imports, tsconfig
  paths, build scripts, tests, docs, and `bun.lock`.
- App package names remain intentionally out of scope until R.5.11.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-package-scope.test.ts`
- `packages/shared/package.json`
- `scripts/build-server.ts`
- `package.json`
- Root and app/package `tsconfig*.json` files

## 4. Tests added first

Extended `scripts/__tests__/rebrand-package-scope.test.ts` with
`renames the shared workspace package to the ROX scope`.

The test asserts:

- `packages/shared/package.json` is named `@rox-one/shared`.
- Active package dependencies use `@rox-one/shared` and do not keep
  `@craft-agent/shared`.
- Active files under `apps`, `packages`, `scripts`, root `package.json`, and
  `bun.lock` have no exact legacy shared package reference.
- `bun.lock` contains the ROX-scoped shared package resolution.

## 5. Expected failing test output

Initial red run before implementation:

`bun test scripts/__tests__/rebrand-package-scope.test.ts`

- Exit: 1.
- Summary: 9 pass, 1 fail, 92 expect calls.
- Expected failure: shared package metadata still reported
  `@craft-agent/shared` where the new test expected `@rox-one/shared`.

## 6. Implementation changes

- Renamed `packages/shared/package.json` from `@craft-agent/shared` to
  `@rox-one/shared`.
- Replaced active `@craft-agent/shared` workspace dependencies in app and
  package manifests with `@rox-one/shared`.
- Replaced active TypeScript imports, dynamic imports, and package-reference
  comments across `apps`, `packages`, and `scripts`.
- Updated tsconfig path mappings and the server build alias for shared to
  `@rox-one/shared`.
- Updated the Pi SDK import-boundary contract expectations for the renamed
  shared package.
- Refreshed `bun.lock` with `bun install`.
- Did not rename app package names; R.5.11 owns app scope names.
- Did not add an ad hoc `@craft-agent/shared` compatibility shim in this
  ticket. The R.5 goal requires shared/server-core transitional shims, but no
  concrete shim package shape is locked in the package-scope slices yet; that
  remains a closeout risk instead of reintroducing active legacy package
  references silently.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-package-scope.test.ts` before
  implementation: expected red.
- `bun install`
- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun install --frozen-lockfile`
- `bun run validate:docs`
- `git diff --check`
- `rg -n "@craft-agent/shared" apps packages scripts package.json tsconfig*.json bun.lock --glob '!**/dist/**' --glob '!**/node_modules/**' --glob '!**/.omx/**' --glob '!**/.omc/**'`
- `bun run typecheck`
- `bun run lint`
- `bun test` before commit, expected dirty-tree guard failure only.
- `bun run build`
- `bun run validate:rebrand`
- Post-commit `bun test`
- Post-commit `bun run build`

## 8. Passing test output summary

- Targeted R.5 package-scope suite after implementation:
  `10 pass`, `0 fail`, `111 expect() calls`.
- `bun install --frozen-lockfile`: exit 0.
- `bun run validate:docs`: exit 0; agent-contract, architecture docs, and
  sync-v2 design checks passed.
- `git diff --check`: exit 0.
- Targeted active grep for `@craft-agent/shared`: exit 1 with no matches.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- Pre-commit `bun test`: exit 1 only because
  `scripts/__tests__/dependency-risk-register-contract.test.ts` requires
  `apps/electron/package.json` and `bun.lock` to be clean. The suite otherwise
  reported `5105 pass`, `13 skip`, `1 fail`, `1 snapshot`, `13032 expect()
  calls`, and `5119 tests across 462 files`.
- Post-commit `bun test`: exit 0 with `5106 pass`, `13 skip`, `0 fail`,
  `1 snapshot`, `13041 expect() calls`, and `5119 tests across 462 files`.
- `bun run validate:rebrand`: expected exit 1; 1524 legacy-token findings
  remain for later R.5/R.6/R.7/R.8 phases.

## 9. Build output summary

`bun run build`: exit 0 before commit and again after commit.

The build completed the session tools core, Session MCP server, Pi agent
server, interceptor, WhatsApp worker, Electron main/preload/renderer, Electron
resources, and Electron assets stages.

## 10. Remaining risks

- App package names still use the legacy package scope until R.5.11.
- The R.5 goal calls for transitional package shims for shared and
  server-core. This slice records the gap but does not invent a new shim shape
  or allowlist active legacy package references.
- `bun run validate:rebrand` remains red by design until the later rebrand
  phases clear env-var, config-dir, docs, app-scope, and compatibility tokens.
- Remote GitHub checks may fail with the existing billing-lock annotation even
  when local validation is green.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Ticket exists before code changes | Pass | T282 ticket and worklog were created before implementation |
| Red test proves shared scope gap | Pass | Targeted package-scope suite failed on `@craft-agent/shared` metadata before implementation |
| Shared package metadata uses ROX scope | Pass | `packages/shared/package.json` now names `@rox-one/shared` |
| Active shared dependencies, imports, paths, and aliases use ROX scope | Pass | Targeted active grep finds no `@craft-agent/shared`; R.5 test passes |
| Lockfile is refreshed | Pass | `bun install` updated `bun.lock`; frozen install passes |
| Full suite passes | Pass | Post-commit `bun test`: 5106 pass, 13 skip, 0 fail |
| Build passes | Pass | `bun run build` exit 0 before and after commit |
| Validation evidence recorded | Pass | Sections 4-10 record red, implementation, test, grep, build, and rebrand evidence |
| Worklog complete | Pass | All 11 required sections are filled with post-commit evidence |
| Commit created | Pass | Initial T282 commit created and will be amended with final evidence |
