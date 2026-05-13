# T286 - Rebrand env-var call-site migration

Status: DONE

R.6 merge evidence: `777ada7` (`Complete R.6 env-var rename with readEnv() shim (#66)`)

## Context

T285 ships the `readEnv()` shim. T286 migrates every production-code call
site that currently reads one of the 16 canonical `CRAFT_*` env vars over to
`readEnv('ROX_*')`. Tests that intentionally `process.env.CRAFT_*=` to
exercise the legacy fallback path stay as-is — that is exactly the contract
the shim promises to honour for one minor version.

The 16 canonical variables (per the rebrand-sweep goal doc):

```
CRAFT_SERVER_TOKEN, CRAFT_SERVER_URL, CRAFT_RPC_HOST, CRAFT_RPC_PORT,
CRAFT_RPC_TLS_CERT, CRAFT_RPC_TLS_KEY, CRAFT_RPC_TLS_CA, CRAFT_TLS_CA,
CRAFT_DEBUG, CRAFT_DEV_RUNTIME, CRAFT_BUNDLED_ASSETS_ROOT, CRAFT_WEBUI_DIR,
CRAFT_WEBUI_PORT, CRAFT_MESSAGING_WA_WORKER, CRAFT_MESSAGING_NODE_BIN,
CRAFT_CONFIG_DIR
```

## Goal

Every runtime `process.env.CRAFT_<canonical-16>` read becomes
`readEnv('ROX_<canonical-16>')`, importing `readEnv` from
`@rox-one/shared/utils/env-compat` (or the relative path when crossing
package-internal boundaries).

Files in scope (runtime / non-test):

- `packages/shared/src/config/paths.ts`
- `packages/shared/src/interceptor-common.ts`
- `packages/shared/src/agent/options.ts`
- `packages/shared/src/agent/permissions-config.ts`
- `packages/shared/src/agent/pi-agent.ts`
- `packages/shared/src/agent/backend/internal/runtime-resolver.ts`
- `packages/session-mcp-server/src/index.ts`
- `packages/server/src/index.ts`
- `packages/server-core/src/bootstrap/headless-start.ts`
- `packages/server-core/src/runtime/platform-headless.ts`
- `apps/electron/src/main/index.ts`
- `apps/electron/src/preload/bootstrap.ts`
- `apps/cli/src/index.ts`

Test files that set `process.env.CRAFT_*=...` to exercise the legacy
fallback are out of scope (they verify the shim contract).

## Required UI

None.

## Required Data/API

No new types. Same string values; new lookup function.

## Required Automations

The validator allowlist already covers `env-compat.ts`. Every migrated
read removes one `CRAFT_` finding from the rebrand validator's report.

## Required Subagents

None. T285 unblocks every call-site change; replacements are mechanical.

## TDD Requirements

The unit tests added in T285 cover the read contract. The full `bun test`
run after migration must regress by no more than one test relative to main
(per the spine concurrency rules).

## Implementation Requirements

For each runtime file:

1. Add the `readEnv` import using the package's relative or scoped path.
2. Replace `process.env.CRAFT_<name>` with `readEnv('ROX_<name>')`.
3. Where the original expression had `?? '127.0.0.1'` (or similar default),
   keep the default literal.

Leave test files using `process.env.CRAFT_*=...` untouched — they exercise
the legacy path the shim must keep alive.

The `scripts/electron-dev.ts` line that *writes* `process.env.CRAFT_CONFIG_DIR`
is the dev-loop bootstrap; convert the write so it sets both `ROX_CONFIG_DIR`
(canonical) and `CRAFT_CONFIG_DIR` (legacy) so child processes that have not
yet been migrated still see the legacy name. Update its read in the same
file to use `readEnv`.

## Validation Commands

- `bun test` (full)
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `bun run validate:rebrand`

## Acceptance Criteria

- [x] Every runtime call site uses `readEnv()`.
- [x] No test in scope regresses by more than 1 case vs main.
- [x] `bun run validate:rebrand` shows a strictly smaller `CRAFT_` finding count.
- [x] `bun run build` passes.

## Worklog

Update `docs/worklog/T286-rebrand-env-var-call-site-migration.md`.
