# T274 - Rebrand UI package scope

## 1. Task summary

Rename the shared UI workspace package scope from `@craft-agent/ui` to
`@rox-one/ui`.

## 2. Repo context discovered

- Phase R.5.2 follows the landed test-fixtures package rename.
- Direct `rg` found active UI scope references in package metadata, app package
  dependencies, Vite/Vitest config comments and optimizeDeps entries, style
  imports, Electron/webui/viewer importers, UI package comments, and `bun.lock`.
- Historical tickets/worklogs are outside this ticket and remain untouched.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-package-scope.test.ts`
- `packages/ui/package.json`
- `apps/electron/package.json`
- `apps/webui/package.json`
- `apps/viewer/package.json`
- `apps/electron/vite.config.ts`
- `apps/electron/vitest.config.ts`
- `apps/webui/vite.config.ts`
- `apps/viewer/src/index.css`
- `bun.lock`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-package-scope.test.ts` before
implementation. The T274 test asserts:

- UI package metadata uses `@rox-one/ui`;
- Electron, webui, and viewer package dependencies use `@rox-one/ui`;
- active `apps/`, `packages/`, and `bun.lock` files no longer contain
  `@craft-agent/ui`;
- active files contain `@rox-one/ui` after the rename.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- Result: exit 1.
- Expected failure: `packages/ui/package.json` still reported
  `@craft-agent/ui` while the test expected `@rox-one/ui`.

## 6. Implementation changes

- Renamed `packages/ui/package.json` package name to `@rox-one/ui`.
- Updated Electron, webui, and viewer workspace dependencies to `@rox-one/ui`.
- Updated active Electron, webui, viewer, and UI package import/export sites,
  Vite/Vitest references, comments, subpath imports, and style imports from
  `@craft-agent/ui` to `@rox-one/ui`.
- Ran `bun install` to refresh `bun.lock`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun install`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `git diff --check`
- `bun install --frozen-lockfile`
- `rg -n "@craft-agent/ui|@rox-one/ui" apps packages bun.lock --glob '!**/dist/**' --glob '!**/node_modules/**'`
- `bun test` pre-commit (expected git-state guard failure while dependency
  files are uncommitted)
- Post-commit `bun test`
- Post-commit `bun run build`
- Post-commit `bun run typecheck`
- Post-commit `bun run lint`
- Post-commit `bun run validate:agent-contract`
- Post-commit `bun run validate:docs`
- Post-commit `git diff --check`
- Post-commit `bun run validate:rebrand` (expected red until later
  R.5/R.6/R.7 phases)

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`: 2 pass, 0 fail,
  23 assertions.
- `bun install`: exit 0; lockfile saved, 2 packages installed.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- `bun run validate:docs`: exit 0; agent contract, architecture docs, and
  sync-v2 design validators passed.
- `git diff --check`: exit 0.
- `bun install --frozen-lockfile`: exit 0.
- Targeted scope grep shows only `@rox-one/ui` in active `apps/`, `packages/`,
  and `bun.lock` surfaces.
- Pre-commit `bun test`: 5097 pass, 13 skip, 1 fail. The failure was the
  dependency risk register git-state guard reporting uncommitted
  `apps/electron/package.json` and `bun.lock`; it will be rerun after the T274
  commit makes that dependency surface clean.
- Post-commit `bun test`: 5098 pass, 13 skip, 0 fail, 12952 assertions.
- Post-commit `bun run typecheck`: exit 0.
- Post-commit `bun run lint`: exit 0.
- Post-commit `bun run validate:agent-contract`: exit 0; 11 skills, 195
  tickets, and 7 required docs validated.
- Post-commit `bun run validate:docs`: exit 0; agent contract, architecture
  docs, and sync-v2 design validators passed.
- Post-commit `git diff --check`: exit 0.
- Post-commit `bun run validate:rebrand`: expected exit 1 with 3659 remaining
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
| Red test proves UI scope gap | Pass | Red exit 1 on legacy UI package name before implementation |
| UI package metadata uses `@rox-one/ui` | Pass | R.5 package-scope regression test passes |
| App dependencies use `@rox-one/ui` | Pass | R.5 package-scope regression test passes |
| Active import/style subpaths use `@rox-one/ui` | Pass | Targeted scope grep and typecheck pass |
| Lockfile is refreshed | Pass | `bun install` saved `bun.lock` with the ROX scope |
| Full suite passes | Pass | Post-commit `bun test`: 5098 pass, 13 skip, 0 fail |
| Build passes | Pass | Post-commit `bun run build`: exit 0 |
| Validation evidence recorded | Pass | Commands and outputs summarized above |
| Worklog complete | Pass | This 11-section worklog is complete |
| Commit created | Pass | This worklog is included in the T274 task commit in git history |
