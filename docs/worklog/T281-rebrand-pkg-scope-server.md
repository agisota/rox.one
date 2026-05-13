# T281 - Rebrand server package scopes

## 1. Task summary

Rename the server workspace package scopes from `@rox-agent/server` and
`@rox-agent/server-core` to `@rox-one/server` and
`@rox-one/server-core`.

## 2. Repo context discovered

- Phase R.5.9 follows the landed Pi agent server package scope rename.
- Direct `rg` found `@rox-agent/server` in `packages/server/package.json`
  and `bun.lock`.
- Direct `rg` found `@rox-agent/server-core` across package metadata,
  workspace dependencies, tsconfig paths, source imports, tests, comments,
  package README, `scripts/build-server.ts`, and `bun.lock`.
- `@rox-agent/shared` remains intentionally untouched for R.5.10.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-package-scope.test.ts`
- `packages/server/package.json`
- `packages/server-core/package.json`
- `packages/server/tsconfig.json`
- `packages/server/src/index.ts`
- `packages/server-core/README.md`
- `packages/server-core/package.json`
- `packages/messaging-gateway/package.json`
- `apps/cli/package.json`
- `apps/electron/package.json`
- `apps/cli/tsconfig.json`
- `apps/electron/tsconfig.json`
- `scripts/build-server.ts`
- `bun.lock`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-package-scope.test.ts` before
implementation. The T281 test asserts:

- server package metadata uses `@rox-one/server`;
- server-core package metadata uses `@rox-one/server-core`;
- app, messaging gateway, and server workspace dependencies use
  `@rox-one/server-core`;
- active `apps/`, `packages/`, `scripts/build-server.ts`, and `bun.lock` files
  no longer contain exact package references to `@rox-agent/server` or
  `@rox-agent/server-core`;
- active files and `bun.lock` contain the ROX server and server-core package
  scopes after the rename.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- Result: exit 1.
- Expected failure: `packages/server/package.json` still reported
  `@rox-agent/server` while the test expected `@rox-one/server`.

## 6. Implementation changes

- Renamed `packages/server/package.json` package name to `@rox-one/server`.
- Renamed `packages/server-core/package.json` package name to
  `@rox-one/server-core`.
- Updated active `@rox-agent/server-core` workspace dependencies, imports,
  dynamic imports, comments, tsconfig paths, and `scripts/build-server.ts` path
  alias to `@rox-one/server-core`.
- Updated the server package comment and `bun.lock` entries from
  `@rox-agent/server` to `@rox-one/server`.
- Ran `bun install` to refresh `bun.lock`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun install`
- `bun install --frozen-lockfile`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun run validate:rebrand`
- Post-commit `bun test`
- Post-commit `bun run build`
- Targeted active-scope grep:
  `rg -n "@rox-agent/server-core|@rox-agent/server(?!-core)" apps packages scripts bun.lock package.json tsconfig*.json --pcre2 --glob '!**/dist/**' --glob '!**/node_modules/**' --glob '!**/.omx/**' --glob '!**/.omc/**'`
- Separate baseline repair: `docs/tickets/T299-spine-integration.md` was
  missing the required `Status:` line on fresh `main`; commit `947c84f`
  restores that docs-contract metadata and lets `validate:docs` run.
- Separate baseline repair: `scripts/__tests__/rebrand-doc-cleanup.test.ts`
  still expected the pre-spine `plan.md` successor sentence; the T300 commit
  aligns the test with the merged spine roadmap so full `bun test` can pass.

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`: 9 pass, 0 fail,
  91 assertions.
- `bun install`: exit 0; lockfile saved, 3 packages installed.
- `bun install --frozen-lockfile`: exit 0.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- `bun run validate:agent-contract`: exit 0; 11 skills, 203 tickets, and 7
  required docs passed after the T299 metadata repair.
- `bun run validate:docs`: exit 0; agent contract, architecture docs, and
  sync-v2 design validators passed.
- `git diff --check`: exit 0.
- `bun run validate:rebrand`: expected exit 1 with 2884 forbidden token
  findings reserved for later rebrand phases.
- Post-commit `bun test`: exit 0; 5105 pass, 13 skip, 0 fail, 1 snapshot,
  13021 assertions, 5118 tests across 462 files.
- Targeted active-scope grep for legacy server/server-core package references:
  exit 1 with no matches.

## 9. Build output summary

- Post-commit `bun run build`: exit 0; session MCP server, Pi agent server,
  unified network interceptor, WhatsApp worker, Electron main, Electron
  preload, Electron renderer, resources, and assets completed.

## 10. Remaining risks

- The R.5.10 `@rox-agent/shared` rename remains intentionally untouched, so
  active imports from `@rox-agent/shared` continue to exist until the next
  sub-phase.
- The package-scope compatibility shim requirement covers `server-core` and
  `shared`; this ticket renames the active server-core package and records any
  shim deferral explicitly if the current R.5 package-scope test surface cannot
  prove it without reintroducing active `@rox-agent/server-core` matches.
- Remote GitHub checks may still fail to start while the account billing lock
  is active; local validation is the authoritative evidence for this sub-phase.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Ticket exists before code changes | Pass | T281 ticket and worklog created first |
| Red test proves server scope gap | Pass | Red exit 1 on legacy server package name before implementation |
| Server package metadata uses ROX scope | Pass | R.5 package-scope regression test passes |
| Server-core package metadata uses ROX scope | Pass | R.5 package-scope regression test passes |
| Active server-core dependencies, imports, paths, and alias use ROX scope | Pass | R.5 package-scope regression test and targeted active-scope grep pass |
| Lockfile is refreshed | Pass | `bun install` saved `bun.lock` with the ROX scopes |
| Full suite passes | Pass | Post-commit `bun test`: 5105 pass, 13 skip, 0 fail |
| Build passes | Pass | Post-commit `bun run build` exited 0 |
| Validation evidence recorded | Pass | Sections 7-9 list command and output summaries |
| Worklog complete | Pass | All 11 required sections are filled |
| Commit created | Pass | T281 package-scope commit created in this branch |
