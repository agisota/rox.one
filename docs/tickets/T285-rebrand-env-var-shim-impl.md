# T285 - Rebrand env-var shim implementation

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into the ROX.ONE Agent
Workbench Suite. Phase R.6 of the rebrand sweep renames the 16 canonical
`ROX_*` environment variables to `ROX_*` and keeps the legacy names readable
for one minor version via a shared backward-compat shim.

Relevant goals:

- preserve runtime behavior for existing operators who already export `ROX_*`
- give every call site a single read API (`readEnv()`) so legacy reads are
  visible and removable
- emit a deprecation warning on stderr exactly once per process per legacy var

## Goal

Add `packages/shared/src/utils/env-compat.ts` exporting a `readEnv(name: string)`
function that:

1. Returns `process.env[name]` when set.
2. Falls back to the matching `ROX_*` legacy name when the new `ROX_*` name
   starts with `ROX_` and the legacy var is set, emitting a deprecation
   warning on the first read of each legacy var.
3. Returns `undefined` when neither is set.
4. Exposes `__resetEnvCompatWarningsForTests()` so the per-process Set of
   already-warned legacy names can be cleared between tests.

## Required UI

None. Pure runtime shim with no user-facing surface.

## Required Data/API

- New module `packages/shared/src/utils/env-compat.ts`.
- New named exports: `readEnv`, `__resetEnvCompatWarningsForTests`.
- Re-export both from `packages/shared/src/utils/index.ts`.

## Required Automations

None beyond the existing validation matrix gates. The rebrand validator
already allowlists `packages/shared/src/utils/env-compat.ts` for the
`ROX_` prefix (see `scripts/validate-rebrand.cjs:73`).

## Required Subagents

None. The surface area is small and the design is fully specified in
`docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md` §"Phase R.6".

## TDD Requirements

Before implementation, write `packages/shared/src/utils/__tests__/env-compat.test.ts`
covering:

1. `readEnv('ROX_FOO')` returns `undefined` when neither `ROX_FOO` nor
   `ROX_FOO` is set.
2. `readEnv('ROX_FOO')` returns the new value when `ROX_FOO` is set.
3. `readEnv('ROX_FOO')` returns the legacy value when only `ROX_FOO` is set,
   and emits a deprecation warning on stderr.
4. The deprecation warning fires exactly once per legacy var per process.
5. Different legacy vars (`ROX_FOO` vs `ROX_BAR`) each get their own
   warning.
6. `readEnv('ROX_FOO')` returns the new value if both `ROX_FOO` and
   `ROX_FOO` are set (no warning).

Use `spyOn(process.stderr, 'write')` per the T211 pattern in
`packages/shared/src/config/__tests__/storage-scope-auth.test.ts`.

Run the test, confirm failure for the right reason (module does not exist),
record verbatim output in the worklog before implementing.

## Implementation Requirements

Implement the smallest module that turns the tests green. Use the exact
function bodies sketched in the goal doc. Do not export the
`warnedLegacyEnvVars` Set or `emitEnvDeprecationWarning` helper.

## Validation Commands

- `bun test packages/shared/src/utils/__tests__/env-compat.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:rebrand`

## Acceptance Criteria

- [x] `env-compat.ts` exists and exports `readEnv` + `__resetEnvCompatWarningsForTests`.
- [x] All 6 unit tests pass.
- [x] Deprecation warning fires exactly once per legacy var per process.
- [x] Re-exported from `packages/shared/src/utils/index.ts`.
- [x] No regression in `bun run typecheck` or `bun run lint`.
- [x] No new `ROX_*` findings introduced outside the allowlist.

## Worklog

Update `docs/worklog/T285-rebrand-env-var-shim-impl.md`.
