# T286 - Rebrand env-var call-site migration

Status: DONE
Phase: R.6
Ticket: docs/tickets/T286-rebrand-env-var-call-site-migration.md
R.6 merge evidence: `777ada7` (`Complete R.6 env-var rename with readEnv() shim (#66)`)

## 1. Task summary

Migrate every runtime `process.env.ROX_<canonical-16>` read to
`readEnv('ROX_<canonical-16>')`. Leave tests that intentionally set
`process.env.ROX_*=...` alone — they exercise the legacy fallback the
shim is contractually obliged to support.

## 2. Repo context discovered

T285 lands the shim. Grep for `process\.env\.ROX_<canonical-16>` finds
production reads in:

- `packages/shared/src/{config,agent,utils}/...`
- `packages/server/src/index.ts`
- `packages/server-core/src/{bootstrap,runtime}/...`
- `packages/session-mcp-server/src/index.ts`
- `apps/electron/src/main/index.ts`
- `apps/electron/src/preload/bootstrap.ts`
- `apps/cli/src/index.ts`

Tests that write `process.env.ROX_*` (e.g.
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

For each runtime file, replace `process.env.ROX_<name>` with
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

- Runtime canonical-16 read audit:
  `rg -n "process\\.env\\.ROX_(SERVER_TOKEN|SERVER_URL|RPC_HOST|RPC_PORT|RPC_TLS_CERT|RPC_TLS_KEY|RPC_TLS_CA|TLS_CA|DEBUG|DEV_RUNTIME|BUNDLED_ASSETS_ROOT|WEBUI_DIR|WEBUI_PORT|MESSAGING_WA_WORKER|MESSAGING_NODE_BIN|CONFIG_DIR)" packages apps scripts --glob '!**/__tests__/**' --glob '!**/*.test.ts'`
  found only compatibility writes (`scripts/electron-dev.ts`,
  `apps/electron/src/main/index.ts`) and the non-canonical
  `ROX_DEBUG_SSE_RAW` read.
- `bun run validate:rebrand`: `rebrand validation passed: no forbidden
  tokens outside the allowlist`.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- Full `bun test`: 5258 pass, 13 skip, 0 fail, 1 snapshot, 13419 expects
  across 5271 tests in 476 files.

## 9. Build output summary

`bun run build` completed successfully. Electron main, preload, renderer,
resources, and assets builds completed; the only observed output of note was
the existing Vite large-chunk warning.

## 10. Remaining risks

- A small set of ROX_* tokens appear inside template strings in
  Electron child-process env handoff (e.g. `apps/electron/src/main/index.ts`
  sets `ROX_DEBUG=1` so subprocesses inherit it). For these *writes*, we
  set BOTH `ROX_*` and `ROX_*` until R.7 fully eliminates them; this
  keeps subprocesses still on the legacy path happy while preserving
  `readEnv()` behavior.
- Tests that probe the legacy ROX_ fallback intentionally continue to
  write `process.env.ROX_*=...`. These are valid uses of the legacy
  surface and the rebrand validator allowlist intentionally excludes test
  files via the prefix path.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
|---|---|---|
| Every runtime call site uses `readEnv()` | Pass | Canonical-16 `process.env.ROX_*` read audit found no remaining runtime reads; accepted compatibility writes remain |
| No test in scope regresses by more than 1 case vs main | Pass | Full `bun test`: 5258 pass, 13 skip, 0 fail |
| `validate:rebrand` shows a smaller `ROX_` finding count | Pass | Final validator exits 0 with no forbidden tokens outside allowlist |
| `bun run build` passes | Pass | Branch-level build exits 0 |
