# T277 - Rebrand session tools core package scope

## 1. Task summary

Rename the session tools core workspace package scope from
`@craft-agent/session-tools-core` to `@rox-one/session-tools-core`.

## 2. Repo context discovered

- Phase R.5.5 follows the landed audit package rename.
- Direct `rg` found session tools core references in
  `packages/session-tools-core/package.json`, `packages/session-mcp-server`,
  `packages/shared`, and `bun.lock`.
- This slice has active TypeScript importers and type-only dynamic import
  references, unlike the audit package slice.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-package-scope.test.ts`
- `packages/session-tools-core/package.json`
- `packages/session-mcp-server/package.json`
- `packages/session-mcp-server/src/index.ts`
- `packages/shared/package.json`
- `packages/shared/src/agent/pi-agent.ts`
- `packages/shared/src/agent/session-self-management-bindings.ts`
- `packages/shared/src/agent/session-scoped-tools.ts`
- `packages/shared/src/agent/session-scoped-tool-callback-registry.ts`
- `packages/shared/src/agent/mode-manager.ts`
- `packages/shared/src/agent/claude-context.ts`
- `packages/shared/src/agent/backend/pi/session-tool-parity.test.ts`
- `packages/shared/src/agent/backend/pi/session-tool-defs.ts`
- `packages/shared/src/agent/__tests__/session-self-management-bindings.test.ts`
- `packages/shared/src/agent/backend/claude/session-tool-parity.test.ts`
- `bun.lock`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-package-scope.test.ts` before
implementation. The T277 test asserts:

- session tools core package metadata uses `@rox-one/session-tools-core`;
- `packages/session-mcp-server` and `packages/shared` dependency metadata use
  the ROX package name and no longer carry the legacy key;
- active `apps/`, `packages/`, and `bun.lock` files no longer contain
  `@craft-agent/session-tools-core`;
- active files contain `@rox-one/session-tools-core` after the rename.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- Result: exit 1.
- Expected failure: `packages/session-tools-core/package.json` still reported
  `@craft-agent/session-tools-core` while the test expected
  `@rox-one/session-tools-core`.

## 6. Implementation changes

- Renamed `packages/session-tools-core/package.json` package name to
  `@rox-one/session-tools-core`.
- Updated package metadata in `packages/session-mcp-server/package.json` and
  `packages/shared/package.json`.
- Updated active TypeScript imports, type exports, type-only dynamic imports,
  and comments in `packages/session-mcp-server` and `packages/shared`.
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
- `rg -n "@craft-agent/session-tools-core|@rox-one/session-tools-core" apps packages bun.lock tsconfig*.json package.json --glob '!**/dist/**' --glob '!**/node_modules/**' --glob '!**/.omc/**' --glob '!**/.omx/**'`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`: 5 pass, 0 fail,
  53 assertions.
- `bun install`: exit 0; lockfile saved, 2 packages installed.
- `bun install --frozen-lockfile`: exit 0.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- `bun test`: 5101 pass, 13 skip, 0 fail, 1 snapshot, 12982 assertions,
  across 462 files.
- `bun run validate:agent-contract`: exit 0; 11 skills, 198 tickets, and 7
  required docs validated.
- `bun run validate:docs`: exit 0; agent contract, architecture docs, and
  sync-v2 design validators passed.
- `git diff --check`: exit 0.
- Targeted scope grep shows only `@rox-one/session-tools-core` in active app,
  package, and lockfile references.
- `bun run validate:rebrand`: expected exit 1 with 3357 remaining forbidden
  token findings outside the allowlist.

## 9. Build output summary

`bun run build`: exit 0. The Electron build completed main, preload,
renderer, resources, and assets successfully.

## 10. Remaining risks

- The rest of R.5 package-scope renames remain intentionally untouched, so
  whole-repo rebrand validation stays expected-red at 3357 remaining findings.
- Remote GitHub checks may still fail to start while the account billing lock
  is active; local validation is the authoritative evidence for this sub-phase.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Ticket exists before code changes | Pass | T277 ticket and worklog created first |
| Red test proves session tools core scope gap | Pass | Red exit 1 on legacy session tools core package name before implementation |
| Session tools core package metadata uses ROX scope | Pass | R.5 package-scope regression test passes |
| Active importers and dependencies use ROX scope | Pass | Targeted grep shows only `@rox-one/session-tools-core` in active refs |
| Lockfile is refreshed | Pass | `bun install` saved `bun.lock` with the ROX scope |
| Full suite passes | Pass | `bun test`: 5101 pass, 13 skip, 0 fail |
| Build passes | Pass | `bun run build`: exit 0 |
| Validation evidence recorded | Pass | Focused test, install, frozen install, typecheck, lint, full suite, build, docs, contract, diff, rebrand count recorded |
| Worklog complete | Pass | 11 sections filled |
| Commit created | Pass | Atomic Lore commit created for T277 and amended with final evidence |
