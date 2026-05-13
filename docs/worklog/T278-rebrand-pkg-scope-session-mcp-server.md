# T278 - Rebrand session MCP server package scope

## 1. Task summary

Rename the session MCP server workspace package scope from
`@rox-agent/session-mcp-server` to `@rox-one/session-mcp-server`.

## 2. Repo context discovered

- Phase R.5.6 follows the landed session tools core package rename.
- Direct `rg` found session MCP server scope references only in
  `packages/session-mcp-server/package.json` and `bun.lock`.
- No active TypeScript importers or package dependencies currently reference
  this package by workspace name.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-package-scope.test.ts`
- `packages/session-mcp-server/package.json`
- `bun.lock`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-package-scope.test.ts` before
implementation. The T278 test asserts:

- session MCP server package metadata uses `@rox-one/session-mcp-server`;
- active `apps/`, `packages/`, and `bun.lock` files no longer contain
  `@rox-agent/session-mcp-server`;
- active files contain `@rox-one/session-mcp-server` after the rename.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- Result: exit 1.
- Expected failure: `packages/session-mcp-server/package.json` still reported
  `@rox-agent/session-mcp-server` while the test expected
  `@rox-one/session-mcp-server`.

## 6. Implementation changes

- Renamed `packages/session-mcp-server/package.json` package name to
  `@rox-one/session-mcp-server`.
- Ran `bun install` to refresh `bun.lock`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun install`
- `bun install --frozen-lockfile`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun run validate:rebrand`
- `rg -n "@rox-agent/session-mcp-server|@rox-one/session-mcp-server" apps packages bun.lock tsconfig*.json package.json --glob '!**/dist/**' --glob '!**/node_modules/**' --glob '!**/.omc/**' --glob '!**/.omx/**'`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`: 6 pass, 0 fail,
  57 assertions.
- `bun install`: exit 0; lockfile saved, 2 packages installed.
- `bun install --frozen-lockfile`: exit 0.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- `bun test`: 5102 pass, 13 skip, 0 fail, 1 snapshot, 12986 assertions
  across 462 files.
- `bun run validate:agent-contract`: exit 0; 11 skills, 199 tickets, and 7
  required docs passed.
- `bun run validate:docs`: exit 0; agent contract, architecture docs, and
  sync-v2 design validators passed.
- `git diff --check`: exit 0.
- `bun run validate:rebrand`: expected exit 1 with 3345 forbidden token
  findings reserved for later rebrand phases.
- Targeted scope grep shows only `@rox-one/session-mcp-server` in
  `packages/session-mcp-server/package.json` and `bun.lock`.

## 9. Build output summary

- `bun run build`: exit 0; package builds and Electron main, preload,
  renderer, resources, and assets builds completed.

## 10. Remaining risks

- The rest of R.5 package-scope renames remain intentionally untouched, so
  whole-repo rebrand validation stays expected-red at 3345 remaining findings.
- Remote GitHub checks may still fail to start while the account billing lock
  is active; local validation is the authoritative evidence for this sub-phase.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Ticket exists before code changes | Pass | T278 ticket and worklog created first |
| Red test proves session MCP server scope gap | Pass | Red exit 1 on legacy session MCP server package name before implementation |
| Session MCP server package metadata uses ROX scope | Pass | R.5 package-scope regression test passes |
| Lockfile is refreshed | Pass | `bun install` saved `bun.lock` with the ROX scope |
| Full suite passes | Pass | `bun test`: 5102 pass, 13 skip, 0 fail |
| Build passes | Pass | `bun run build`: exit 0 |
| Validation evidence recorded | Pass | Sections 7-9 list command and output summaries |
| Worklog complete | Pass | All 11 required sections are complete |
| Commit created | Pass | Commit `bfb47c6` created before final documentation amend |
