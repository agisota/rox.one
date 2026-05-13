# T276 - Rebrand audit package scope

## 1. Task summary

Rename the audit workspace package scope from `@craft-agent/audit` to
`@rox-one/audit`.

## 2. Repo context discovered

- Phase R.5.4 follows the landed core package rename.
- Direct `rg` found audit scope references only in
  `packages/audit/package.json` and `bun.lock`.
- No active TypeScript importers or tsconfig path mappings currently reference
  the audit package.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-package-scope.test.ts`
- `packages/audit/package.json`
- `bun.lock`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-package-scope.test.ts` before
implementation. The T276 test asserts:

- audit package metadata uses `@rox-one/audit`;
- active `apps/`, `packages/`, and `bun.lock` files no longer contain
  `@craft-agent/audit`;
- active files contain `@rox-one/audit` after the rename.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- Result: exit 1.
- Expected failure: `packages/audit/package.json` still reported
  `@craft-agent/audit` while the test expected `@rox-one/audit`.

## 6. Implementation changes

- Renamed `packages/audit/package.json` package name to `@rox-one/audit`.
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
- `rg -n "@craft-agent/audit|@rox-one/audit" apps packages bun.lock tsconfig*.json package.json --glob '!**/dist/**' --glob '!**/node_modules/**' --glob '!**/.omc/**' --glob '!**/.omx/**'`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`: 4 pass, 0 fail,
  45 assertions.
- `bun install`: exit 0; lockfile saved, 2 packages installed.
- `bun install --frozen-lockfile`: exit 0.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- `bun test`: 5100 pass, 13 skip, 0 fail, 1 snapshot, 12974 assertions,
  across 462 files.
- `bun run validate:agent-contract`: exit 0; 11 skills, 197 tickets, and 7
  required docs validated.
- `bun run validate:docs`: exit 0; agent contract, architecture docs, and
  sync-v2 design validators passed.
- `git diff --check`: exit 0.
- Targeted scope grep shows only `@rox-one/audit` in `packages/audit` and
  `bun.lock`.
- `bun run validate:rebrand`: expected exit 1 with 3417 remaining forbidden
  token findings outside the allowlist.

## 9. Build output summary

`bun run build`: exit 0. The Electron build completed main, preload,
renderer, resources, and assets successfully.

## 10. Remaining risks

- The rest of R.5 package-scope renames remain intentionally untouched, so
  whole-repo rebrand validation stays expected-red at 3417 remaining findings.
- Remote GitHub checks may still fail to start while the account billing lock
  is active; local validation is the authoritative evidence for this sub-phase.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Red test proves audit scope gap | Pass | Red exit 1 on legacy audit package name before implementation |
| Audit package metadata uses `@rox-one/audit` | Pass | R.5 package-scope regression test passes |
| Lockfile is refreshed | Pass | `bun install` saved `bun.lock` with the ROX scope |
| Full suite passes | Pass | `bun test`: 5100 pass, 13 skip, 0 fail |
| Build passes | Pass | `bun run build`: exit 0 |
| Validation evidence recorded | Pass | Focused test, install, frozen install, typecheck, lint, full suite, build, docs, contract, diff, rebrand count recorded |
| Worklog complete | Pass | 11 sections filled |
| Commit created | Pass | Atomic Lore commit created for T276 and amended with final evidence |
