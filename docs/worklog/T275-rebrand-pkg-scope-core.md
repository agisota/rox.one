# T275 - Rebrand core package scope

## 1. Task summary

Rename the core workspace package scope from `@craft-agent/core` to
`@rox-one/core`.

## 2. Repo context discovered

- Phase R.5.3 follows the landed UI package rename.
- Direct `rg` found active core scope references in package metadata,
  workspace dependencies, tsconfig path mappings, app/runtime imports, package
  docs, and `bun.lock`.
- Runtime memory directories such as `.omc/` and `.omx/` are outside this
  ticket and remain untouched.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-package-scope.test.ts`
- `packages/core/package.json`
- `apps/electron/package.json`
- `apps/viewer/package.json`
- `packages/shared/package.json`
- `packages/server/package.json`
- `packages/server-core/package.json`
- `packages/ui/package.json`
- `packages/messaging-gateway/package.json`
- `packages/core/README.md`
- `packages/core/CLAUDE.md`
- `bun.lock`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-package-scope.test.ts` before
implementation. The T275 test asserts:

- core package metadata uses `@rox-one/core`;
- known workspace package dependencies use `@rox-one/core`;
- active `apps/`, `packages/`, and `bun.lock` files no longer contain
  `@craft-agent/core`;
- active files contain `@rox-one/core` after the rename.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- Result: exit 1.
- Expected failure: `packages/core/package.json` still reported
  `@craft-agent/core` while the test expected `@rox-one/core`.

## 6. Implementation changes

- Renamed `packages/core/package.json` package name to `@rox-one/core`.
- Updated workspace dependencies in Electron, viewer, messaging gateway,
  server, server-core, shared, and UI packages to `@rox-one/core`.
- Updated active imports, type imports, tsconfig path mappings, package docs,
  and package comments from `@craft-agent/core` to `@rox-one/core`.
- Ran `bun install` to refresh `bun.lock`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun install`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `git diff --check`
- `bun install --frozen-lockfile`
- `rg -n "@craft-agent/core|@rox-one/core" apps packages bun.lock tsconfig*.json package.json --glob '!**/dist/**' --glob '!**/node_modules/**' --glob '!**/.omc/**' --glob '!**/.omx/**'`
- Post-commit `bun test`
- Post-commit `bun run build`
- Post-commit `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- Post-commit `bun run validate:agent-contract`
- Post-commit `bun run validate:docs`
- Post-commit `git diff --check`
- Post-commit `bun run validate:rebrand` (expected red until later
  R.5/R.6/R.7 phases)

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`: 3 pass, 0 fail,
  41 assertions.
- `bun install`: exit 0; lockfile saved, 2 packages installed.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- `bun run validate:docs`: exit 0; agent contract, architecture docs, and
  sync-v2 design validators passed.
- `git diff --check`: exit 0.
- `bun install --frozen-lockfile`: exit 0.
- Targeted scope grep shows only `@rox-one/core` in active `apps/`,
  `packages/`, tsconfig/package metadata, and `bun.lock` surfaces.
- Post-commit `bun test`: 5099 pass, 13 skip, 0 fail, 12970 assertions.
- Post-commit focused package-scope test: 3 pass, 0 fail, 41 assertions.
- Post-commit `bun run validate:agent-contract`: exit 0; 11 skills, 196
  tickets, and 7 required docs validated.
- Post-commit `bun run validate:docs`: exit 0; agent contract, architecture
  docs, and sync-v2 design validators passed.
- Post-commit `git diff --check`: exit 0.
- Post-commit `bun run validate:rebrand`: expected exit 1 with 3423 remaining
  forbidden token findings outside the allowlist; dominant buckets are
  later-phase package/env/CLI surfaces (`craft-agent`, `@craft-agent`,
  `CRAFT_`, `craft-cli`).

## 9. Build output summary

Post-commit `bun run build` passed. The build completed Electron main,
preload, renderer, resources, and asset steps. Vite reported existing
chunk-size warnings only; there were no build errors.

## 10. Remaining risks

- The rest of R.5 package-scope renames remain intentionally untouched, so
  whole-repo rebrand validation stays expected-red.
- Remote GitHub checks may still fail to start while the account billing lock
  is active; local validation is the authoritative evidence for this sub-phase.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Red test proves core scope gap | Pass | Red exit 1 on legacy core package name before implementation |
| Core package metadata uses `@rox-one/core` | Pass | R.5 package-scope regression test passes |
| Workspace dependencies use `@rox-one/core` | Pass | R.5 package-scope regression test passes |
| Active import/path mappings use `@rox-one/core` | Pass | Targeted scope grep and typecheck pass |
| Lockfile is refreshed | Pass | `bun install` saved `bun.lock` with the ROX scope |
| Full suite passes | Pass | Post-commit `bun test`: 5099 pass, 13 skip, 0 fail |
| Build passes | Pass | Post-commit `bun run build`: exit 0 |
| Validation evidence recorded | Pass | Commands and outputs summarized above |
| Worklog complete | Pass | This 11-section worklog is complete |
| Commit created | Pass | This worklog is included in the T275 task commit in git history |
