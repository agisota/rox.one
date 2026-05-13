# T-LEGACY-THINK-SHIM - Remove legacy 'think' thinkingLevel normalization shim

## Context

When the six-tier thinking system was introduced (`off`, `low`, `medium`, `high`, `xhigh`, `max`),
the old single-level `'think'` value was mapped to `'medium'` via a normalization shim rather than
a hard migration. The shim is present in at least 6 locations and is guarded by TODOs that say
"after old persisted session/workspace data has realistically aged out across upgrades."

No explicit removal version or telemetry threshold has been documented. Current version is `0.9.2`.
This ticket proposes removing the shim at **v1.3.0**, contingent on confirming that no active
sessions in telemetry still carry `thinkingLevel: 'think'`.

**Note:** `'think'` as a `ProductMode` (the "Thinking Partner" workbench mode in
`product-mode-registry.ts`) is **entirely unrelated** and must NOT be touched by this ticket.

## Shim Locations (all 6 must be removed together)

1. `packages/shared/src/agent/thinking-levels.ts:147`
   — `normalizeThinkingLevel()`: `if (value === 'think') return 'medium'`

2. `packages/server-core/src/sessions/session-manager-helpers.ts:804-813`
   — calls `normalizeThinkingLevel()` during `createManagedSession` to handle persisted sessions

3. `packages/shared/src/workspaces/storage.ts:129-133`
   — calls `normalizeThinkingLevel()` inside `loadWorkspaceConfig` for persisted workspace defaults

4. `packages/shared/src/config/validators.ts:103`
   — `StoredConfigSchema.defaultThinkingLevel`: `.enum([...THINKING_LEVEL_IDS, 'think'])` with
     `.transform(v => v === 'think' ? 'medium' : v)`

5. `packages/shared/src/automations/schemas.ts:19-22`
   — `ThinkingLevelInputSchema`: `.enum([...THINKING_LEVEL_IDS, 'think'])` with
     `.transform(value => normalizeThinkingLevel(value))`

6. `packages/shared/src/sessions/types.ts:146,262,347`
   — JSDoc comments still reference `'think'` as an example value; update to reflect current levels

## Removal Prerequisites (gate on all before merging)

- [ ] **Telemetry gate:** Confirm `thinkingLevel: 'think'` appears in <1% of active sessions
      sampled from production. Target date: after v1.2.0 has been live for at least 4 weeks.
- [ ] **No test fixtures using `thinkingLevel: 'think'`** (beyond the shim-exercise tests below
      that will themselves be deleted):
      - `packages/server-core/src/sessions/create-managed-session.test.ts:15`
      - `packages/shared/src/workspaces/__tests__/storage-permission-mode-normalization.test.ts:77`
      - `apps/electron/src/main/handlers/__tests__/settings-default-thinking.test.ts:9,80`
      - `packages/shared/src/automations/validation.test.ts:113,118`
      - `packages/shared/src/config/__tests__/default-thinking-level.test.ts:118-120`

## Goal

Remove all 6 shim locations in a single atomic commit. After removal, `normalizeThinkingLevel()`
becomes a pure validator (returning `undefined` for unknown values including `'think'`), and
persisted sessions/workspaces containing `thinkingLevel: 'think'` will silently drop the field
(falling back to the workspace or global default at runtime).

## Required UI

None. This is a pure backend/persistence cleanup.

## Required Data/API

- `normalizeThinkingLevel()` in `thinking-levels.ts`: remove the `if (value === 'think')` branch
- `StoredConfigSchema` in `config/validators.ts`: remove `'think'` from the enum
- `ThinkingLevelInputSchema` in `automations/schemas.ts`: remove `'think'` from the enum;
  simplify transform to just `normalizeThinkingLevel(value)`
- `loadWorkspaceConfig` in `workspaces/storage.ts`: the call to `normalizeThinkingLevel` can stay
  (it's still useful for forward-compat), but remove the TODO comment
- `createManagedSession` in `session-manager-helpers.ts`: the call to `normalizeThinkingLevel` can
  stay (defense-in-depth), but remove the TODO comment
- JSDoc comments in `sessions/types.ts`: update the `'think'` examples to `'medium'`

## Required Automations

None.

## Required Subagents

Not required; all sites are known.

## TDD Requirements

Before implementation:

1. Update existing shim-exercise tests to assert that `thinkingLevel: 'think'` is now dropped
   (becomes `undefined`) rather than mapped to `'medium'`.
2. Verify `bun test packages/shared/src/agent/` passes.
3. Verify `bun test packages/server-core/src/sessions/` passes.
4. Verify `bun test packages/shared/src/workspaces/` passes.

## Implementation Requirements

Implement only the removals listed in "Required Data/API". Do not touch any `ProductMode` usage
of `'think'` in `product-mode-registry.ts`, `option-graph.ts`, toolbar components, or tests.

## Validation Commands

```bash
bun test packages/shared/src/agent/
bun test packages/server-core/src/sessions/
bun test packages/shared/src/workspaces/
cd packages/shared && bun run tsc --noEmit
node scripts/validate-rebrand.cjs
```

## Acceptance Criteria

- [ ] All 6 shim sites removed in a single commit
- [ ] `normalizeThinkingLevel('think')` returns `undefined` (not `'medium'`)
- [ ] Existing shim-exercise tests updated to assert `undefined` / graceful drop
- [ ] No remaining `thinkingLevel.*'think'\|'think'.*thinkingLevel` matches in non-test source
- [ ] `ProductMode = 'think'` and all workbench/toolbar/test references left untouched
- [ ] `bun test packages/shared/src/agent/` passes
- [ ] `bun test packages/server-core/src/sessions/` passes
- [ ] `bun test packages/shared/src/workspaces/` passes
- [ ] `cd packages/shared && bun run tsc --noEmit` clean
- [ ] `node scripts/validate-rebrand.cjs` passes
- [ ] Worklog entry created at `docs/worklog/T-LEGACY-THINK-SHIM.md`
- [ ] Commit created

## Worklog

Update `docs/worklog/T-LEGACY-THINK-SHIM.md` when work begins.
