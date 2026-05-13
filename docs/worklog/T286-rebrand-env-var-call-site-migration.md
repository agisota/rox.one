# T286 - Rebrand env-var call-site migration

Status: IN_PROGRESS
Phase: R.6
Ticket: docs/tickets/T286-rebrand-env-var-call-site-migration.md

## 1. Task summary

Migrate every runtime `process.env.CRAFT_<canonical-16>` read to
`readEnv('ROX_<canonical-16>')`. Leave tests that intentionally set
`process.env.CRAFT_*=...` alone — they exercise the legacy fallback the
shim is contractually obliged to support.

## 2. Repo context discovered

T285 lands the shim. Grep for `process\.env\.CRAFT_<canonical-16>` finds
production reads in:

- `packages/shared/src/{config,agent,utils}/...`
- `packages/server/src/index.ts`
- `packages/server-core/src/{bootstrap,runtime}/...`
- `packages/session-mcp-server/src/index.ts`
- `apps/electron/src/main/index.ts`
- `apps/electron/src/preload/bootstrap.ts`
- `apps/cli/src/index.ts`

Tests that write `process.env.CRAFT_*` (e.g.
`packages/shared/src/config/__tests__/storage-scope.test.ts`) stay as-is.

## 3. Files inspected

Same as the production-file list under "Repo context".

## 4. Tests added first

T286 piggybacks on T285's test file. Additional integration coverage comes
from the existing test suite — if a migrated call site breaks something,
it surfaces in the full `bun test` run.

## 5. Expected failing test output

Pre-migration baseline (from `git fetch origin && bun test` on faa5b04):

```
5068 pass, 13 skip, 26 fail, 1 error
```

These existing failures predate R.6 and are tracked under R.10 closeout.
T286 must not regress this baseline by more than 1 case.

## 6. Implementation changes

For each runtime file, replace `process.env.CRAFT_<name>` with
`readEnv('ROX_<name>')`. Add the `readEnv` import using the relative path
inside `packages/shared/src/utils/env-compat.ts` for shared-package
internal callers and the package-scoped path `@rox-one/shared/utils` for
out-of-package callers.

## 7. Validation commands run

- `bun test`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `bun run validate:rebrand`

## 8. Passing test output summary

To be filled at green.

## 9. Build output summary

To be filled at green.

## 10. Remaining risks

- A small set of CRAFT_* tokens appear inside template strings in
  Electron child-process env handoff (e.g. `apps/electron/src/main/index.ts`
  sets `CRAFT_DEBUG=1` so subprocesses inherit it). For these *writes*, we
  set BOTH `CRAFT_*` and `ROX_*` until R.7 fully eliminates them; this
  keeps subprocesses still on the legacy path happy while preserving
  `readEnv()` behavior.
- Tests that probe the legacy CRAFT_ fallback intentionally continue to
  write `process.env.CRAFT_*=...`. These are valid uses of the legacy
  surface and the rebrand validator allowlist intentionally excludes test
  files via the prefix path.

## 11. Acceptance criteria matrix

Filled at green.
