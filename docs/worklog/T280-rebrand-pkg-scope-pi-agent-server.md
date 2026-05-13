# T280 - Rebrand Pi agent server package scope

## 1. Task summary

Rename the Pi agent server workspace package scope from
`@craft-agent/pi-agent-server` to `@rox-one/pi-agent-server`.

## 2. Repo context discovered

- Phase R.5.8 follows the landed messaging package scope rename.
- Direct `rg` found Pi agent server scope references only in
  `packages/pi-agent-server/package.json` and `bun.lock`.
- No active TypeScript importers, workspace dependencies, or tsconfig paths
  currently reference this package by workspace name.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-package-scope.test.ts`
- `packages/pi-agent-server/package.json`
- `bun.lock`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-package-scope.test.ts` before
implementation. The T280 test asserts:

- Pi agent server package metadata uses `@rox-one/pi-agent-server`;
- active `apps/`, `packages/`, and `bun.lock` files no longer contain
  `@craft-agent/pi-agent-server`;
- active files and `bun.lock` contain `@rox-one/pi-agent-server` after the
  rename.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- Result: exit 1.
- Expected failure: `packages/pi-agent-server/package.json` still reported
  `@craft-agent/pi-agent-server` while the test expected
  `@rox-one/pi-agent-server`.

## 6. Implementation changes

- Renamed `packages/pi-agent-server/package.json` package name to
  `@rox-one/pi-agent-server`.
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

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`: 8 pass, 0 fail,
  75 assertions.
- `bun install`: exit 0; lockfile saved, 2 packages installed.
- `bun install --frozen-lockfile`: exit 0.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- `bun run validate:agent-contract`: exit 0; 11 skills, 201 tickets, and 7
  required docs passed.
- `bun run validate:docs`: exit 0; agent contract, architecture docs, and
  sync-v2 design validators passed.
- `git diff --check`: exit 0.
- `bun run validate:rebrand`: expected exit 1 with 3279 forbidden token
  findings reserved for later rebrand phases.
- Post-commit `bun test`: exit 0; 5104 pass, 13 skip, 0 fail, 1 snapshot,
  13004 assertions, 5117 tests across 462 files.

## 9. Build output summary

- Post-commit `bun run build`: exit 0; session MCP, Pi agent server,
  interceptor, WhatsApp worker, Electron main, Electron preload, Electron
  renderer, resources, and assets completed.

## 10. Remaining risks

- The rest of R.5 package-scope renames remain intentionally untouched, so
  whole-repo rebrand validation stays expected-red at 3279 remaining findings.
- Remote GitHub checks may still fail to start while the account billing lock
  is active; local validation is the authoritative evidence for this sub-phase.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Ticket exists before code changes | Pass | T280 ticket and worklog created first |
| Red test proves Pi agent server scope gap | Pass | Red exit 1 on legacy Pi agent server package name before implementation |
| Pi agent server package metadata uses ROX scope | Pass | R.5 package-scope regression test passes |
| Lockfile is refreshed | Pass | `bun install` saved `bun.lock` with the ROX scope |
| Full suite passes | Pass | Post-commit `bun test` passed with 5104 pass, 13 skip, 0 fail |
| Build passes | Pass | Post-commit `bun run build` exited 0 |
| Validation evidence recorded | Pass | Worklog records red, targeted, install, typecheck, lint, full suite, build, docs, diff, and expected-red rebrand evidence |
| Worklog complete | Pass | All 11 required sections are filled |
| Commit created | Pass | Initial commit `ef61c0f` created before final evidence amend |
