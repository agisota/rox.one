# T284 - Rebrand package scope closeout

## 1. Task summary

Close the active package-scope rename surface by proving no active
`@rox-agent/` package-scope references remain in TypeScript, package metadata,
or tsconfig files.

## 2. Repo context discovered

- R.5.1 through R.5.11 have landed on `main`.
- Direct active-surface grep found the remaining package-scope literals only in
  `scripts/build-server.ts`.
- Historical docs, tickets, worklogs, and release notes still contain legacy
  package references and remain outside this active package-scope closeout.
- The R.5 goal calls for transitional package shims for shared and server-core,
  but earlier R.5 slices recorded that no concrete shim package shape is locked.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-package-scope.test.ts`
- `scripts/build-server.ts`
- `docs/worklog/T281-rebrand-pkg-scope-server.md`
- `docs/worklog/T282-rebrand-pkg-scope-shared.md`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-package-scope.test.ts` with
`keeps active package-scope surfaces free of legacy workspace scope`.

The test scans active package-scope closeout files under `apps`, `packages`,
and `scripts`, plus root package/tsconfig files, for the legacy workspace scope.

## 5. Expected failing test output

Initial red run before implementation:

`bun test scripts/__tests__/rebrand-package-scope.test.ts`

- Exit: 1.
- Summary: 11 pass, 1 fail, 128 expect calls.
- Expected failure: `legacyMatches` contained only `scripts/build-server.ts`.

## 6. Implementation changes

- Updated `scripts/build-server.ts` import scanning so workspace packages are
  recognized under `@rox-one/*`.
- Updated generated server build `tsconfig.json` paths for `core` and
  `session-tools-core` to `@rox-one/*`.
- Updated generated server build workspace symlink creation from
  `node_modules/@rox-agent` to `node_modules/@rox-one`.
- Left shared/server-core transitional package-shim shape unresolved and
  recorded as a remaining risk rather than adding active legacy package-scope
  literals without a locked design.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-package-scope.test.ts` before
  implementation: expected red.
- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `rg -n "@rox-agent/" scripts apps packages package.json tsconfig*.json --glob '*.ts' --glob '*.tsx' --glob 'package.json' --glob 'tsconfig*.json' --glob '!**/dist/**' --glob '!**/node_modules/**' --glob '!**/.omx/**' --glob '!**/.omc/**'`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:rebrand`
- `bun run validate:docs`
- `git diff --check`
- `bun test`
- `bun run build`

## 8. Passing test output summary

- Targeted R.5 package-scope suite after implementation:
  `12 pass`, `0 fail`, `128 expect() calls`.
- Active package-scope grep: exit 1 with no matches.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- `bun run validate:docs`: exit 0 after T301 repaired pre-existing missing
  ticket status metadata.
- `git diff --check`: exit 0.
- `bun run validate:rebrand`: expected exit 1; 1466 legacy-token findings
  remain for later R.6/R.7/R.8/R.10 phases.
- Full suite: `5121 pass`, `13 skip`, `0 fail`, `1 snapshots`,
  `13104 expect() calls`, `5134 tests across 463 files`.

## 9. Build output summary

`bun run build`: exit 0.

The build completed session tools core verification, Session MCP server, Pi
agent server, unified network interceptor, WhatsApp worker, Electron
main/preload/renderer/resources/assets. Existing Vite large-chunk warnings
remain.

## 10. Remaining risks

- The shared/server-core transitional package-shim requirement still needs a
  concrete, reviewable package shape. This closeout will not silently introduce
  active `@rox-agent/` package metadata or TypeScript literals without that
  design decision.
- Later R.6/R.7/R.8/R.10 phases still own env vars, binary/config paths,
  user-data migration, and broad forbidden-token closeout.
- Remote GitHub checks may fail with the existing billing-lock annotation even
  when local validation is green.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Ticket exists before code changes | Pass | T284 ticket and worklog created before test/code edits |
| Red test proves closeout gap | Pass | Targeted suite failed with `scripts/build-server.ts` as the only legacy match |
| R.5 suite asserts zero active legacy package scopes | Pass | Closeout test passes in targeted and full suites |
| Server build package-scope handling uses ROX scope | Pass | `scripts/build-server.ts` now emits `@rox-one/*` paths and symlinks |
| Active package-scope grep returns no matches | Pass | Active grep exit 1 with no output |
| Full suite passes | Pass | `bun test`: 5121 pass, 13 skip, 0 fail |
| Build passes | Pass | `bun run build` exit 0 |
| Compatibility-shim ambiguity recorded | Pass | Section 10 records unresolved shim shape explicitly |
| Worklog complete | Pass | Red, implementation, validation, and build evidence recorded |
| Commit created | Pass | This T284 closeout commit carries the ticket, worklog, test, and implementation changes |
