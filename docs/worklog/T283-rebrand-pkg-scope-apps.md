# T283 - Rebrand app package scopes

## 1. Task summary

Rename the four app workspace package scopes from `@rox-agent/<app>` to
`@rox-one/<app>`.

## 2. Repo context discovered

- Phase R.5.11 follows the landed shared package scope rename and closes the
  explicit app package group in the R.5 ordering.
- Active exact app package references remain in app `package.json` metadata,
  `bun.lock`, and a small number of package-path text references.
- Generic bare `rox-agent` tokens remain out of scope for this package-name
  ticket.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-package-scope.test.ts`
- `apps/cli/package.json`
- `apps/electron/package.json`
- `apps/viewer/package.json`
- `apps/webui/package.json`
- `bun.lock`
- `package.json`
- `packages/shared/src/prompts/print-system-prompt.ts`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-package-scope.test.ts` with
`renames the app workspace packages to the ROX scope`.

The test asserts:

- `apps/cli/package.json`, `apps/electron/package.json`,
  `apps/viewer/package.json`, and `apps/webui/package.json` use
  `@rox-one/<app>` package names.
- Active files under `apps`, `packages`, `scripts`, root `package.json`, and
  `bun.lock` have no exact legacy app package references.
- Active files and `bun.lock` contain the ROX-scoped app package references.

## 5. Expected failing test output

Initial red run before implementation:

`bun test scripts/__tests__/rebrand-package-scope.test.ts`

- Exit: 1.
- Summary: 10 pass, 1 fail, 112 expect calls.
- Expected failure: app package metadata still reported `@rox-agent/cli`
  where the new test expected `@rox-one/cli`.

## 6. Implementation changes

- Renamed app `package.json` names to `@rox-one/cli`,
  `@rox-one/electron`, `@rox-one/viewer`, and `@rox-one/webui`.
- Replaced active exact app package references in `bun.lock`.
- Replaced active exact app package-path text in `package.json`,
  `apps/viewer/src/components/index.ts`, and
  `packages/shared/src/prompts/print-system-prompt.ts`.
- Refreshed `bun.lock` with `bun install`.
- Left generic bare `rox-agent` ESLint plugin ids, CLI command names, env
  vars, config dirs, and historical docs for their owning later rebrand phases.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-package-scope.test.ts` before
  implementation: expected red.
- `bun install`
- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun install --frozen-lockfile`
- `bun run validate:docs`
- `git diff --check`
- `rg -n "@rox-agent/(cli|electron|viewer|webui)" apps packages scripts package.json tsconfig*.json bun.lock --glob '!**/dist/**' --glob '!**/node_modules/**' --glob '!**/.omx/**' --glob '!**/.omc/**'`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:rebrand`
- `bun run build`
- Post-commit: `bun test`
- Post-commit: `bun run build`

## 8. Passing test output summary

- Targeted R.5 package-scope suite after implementation:
  `11 pass`, `0 fail`, `127 expect() calls`.
- `bun install --frozen-lockfile`: exit 0.
- `bun run validate:docs`: exit 0; agent-contract, architecture docs, and
  sync-v2 design checks passed.
- `git diff --check`: exit 0.
- Targeted active grep for exact app package legacy scopes: exit 1 with no
  matches.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- Post-commit full suite: `5107 pass`, `13 skip`, `0 fail`,
  `1 snapshots`, `13057 expect() calls`, `5120 tests across 462 files`.
- `bun run validate:rebrand`: expected exit 1; 1478 legacy-token findings
  remain for later R.6/R.7/R.8/R.5 closeout phases.

## 9. Build output summary

`bun run build`: exit 0 before commit and exit 0 after commit.

The build completed the session tools core, Session MCP server, Pi agent
server, interceptor, WhatsApp worker, Electron main/preload/renderer, Electron
resources, and Electron assets stages.

## 10. Remaining risks

- Root package name, CLI binary names, `ROX_*` env vars, config dirs, and
  historical docs still carry legacy tokens until later rebrand phases.
- The R.5 closeout still needs to assert zero active `@rox-agent/` package
  references outside the compatibility-shim policy.
- The shared/server-core transitional package shim question remains open from
  the package-scope closeout risk.
- Remote GitHub checks may fail with the existing billing-lock annotation even
  when local validation is green.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Ticket exists before code changes | Pass | T283 ticket and worklog created before implementation |
| Red test proves app scope gap | Pass | Targeted package-scope suite failed on `@rox-agent/cli` metadata before implementation |
| App package metadata uses ROX scope | Pass | App `package.json` names now use `@rox-one/<app>` |
| Active exact app package references use ROX scope | Pass | Targeted active grep finds no exact legacy app package scopes; R.5 test passes |
| Lockfile is refreshed | Pass | `bun install` updated `bun.lock`; frozen install passes |
| Full suite passes | Pass | Post-commit `bun test`: 5107 pass, 13 skip, 0 fail |
| Build passes | Pass | Pre-commit and post-commit `bun run build` exit 0 |
| Validation evidence recorded | Pass | Sections 4-10 record red, implementation, test, grep, build, and rebrand evidence |
| Worklog complete | Pass | Post-commit suite and build evidence recorded |
| Commit created | Pass | T283 change committed on `chore/rebrand-R5-app-scope` |
