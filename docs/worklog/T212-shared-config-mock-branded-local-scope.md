# T212 - Shared config mock branded local scope Worklog

## 1. Task summary

Repair full-suite-only storage brand failure caused by a shared-config mock that
returned an unbranded `DEFAULT_LOCAL_SCOPE` literal.

## 2. Repo context discovered

- `storage-internal.ts` must reject unbranded storage scopes.
- `storage-scope-auth.ts` now shares its branded-scope WeakSet across duplicate
  module instances, and targeted storage/backend tests pass.
- Fresh `bun test --bail` still fails only in the full graph at
  `ClaudeAgent -> loadConfigDefaults(DEFAULT_LOCAL_SCOPE)` with
  `BrandedScopeBreachError`.
- Read-only explorer mapping flagged test files that mock
  `@rox-agent/shared/config`; the ordinary `.test.ts` mock in
  `settings-default-thinking.test.ts` provides a plain frozen local-scope
  literal.

## 3. Files inspected

- `packages/shared/src/config/storage-scope-auth.ts`
- `packages/shared/src/config/storage-internal.ts`
- `packages/shared/src/config/storage.ts`
- `packages/shared/src/agent/claude-agent.ts`
- `packages/shared/src/agent/backend/factory.ts`
- `apps/electron/src/main/handlers/__tests__/settings-default-thinking.test.ts`
- `apps/electron/src/main/__tests__/session-branch-rollback.isolated.ts`
- `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`

## 4. Tests added first

No new test file was needed for this test-harness fix. The existing full
`bun test --bail` validation is the red check because the failure requires the
full parallel Bun test graph.

## 5. Expected failing test output

Red command:

```bash
bun test --bail
```

Observed failure:

```text
BrandedScopeBreachError: storage received an unbranded workspace scope
  at getConfigDirForScope (.../packages/shared/src/config/storage-internal.ts:86:56)
  at loadConfigDefaults (.../packages/shared/src/config/storage-io.ts:152:24)
  at new ClaudeAgent (.../packages/shared/src/agent/claude-agent.ts:600:28)
  at createBackend (.../packages/shared/src/agent/backend/factory.ts:137:14)
```

## 6. Implementation changes

- Imported the real branded `DEFAULT_LOCAL_SCOPE` from
  `packages/shared/src/config/storage-scope-auth.ts` into
  `settings-default-thinking.test.ts`.
- Reused the same branded singleton in the shared-config mock for
  `session-branch-rollback.isolated.ts`.
- Left production storage scope branding unchanged; unbranded literals remain
  rejected by storage internals.

## 7. Validation commands run

- `bun test --bail`
- `bun test --bail 2>&1 | tail -n 30`
- `bun test apps/electron/src/main/handlers/__tests__/settings-default-thinking.test.ts packages/shared/src/agent/backend/__tests__/factory.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts packages/shared/src/agent/backend/__tests__/factory.test.ts`
- `bun test packages/shared/src/sources/__tests__/token-refresh-manager.test.ts packages/shared/src/agent/backend/__tests__/factory.test.ts`
- `bun test ./apps/electron/src/main/__tests__/session-branch-rollback.isolated.ts`
- `bun test --bail`

## 8. Passing test output summary

- Targeted settings handler + backend factory: 39 pass, 1 skip, 0 fail,
  57 expects.
- Isolated session branch rollback: 3 pass, 0 fail, 13 expects.
- Full `bun test --bail`: 5000 pass, 13 skip, 0 fail, 1 snapshot,
  12595 expects.

## 9. Build output summary

Final C4 validation ran after this fix. `bun run build` passed.

## 10. Remaining risks

- The final root validation matrix passed in T208. No remaining T212 blocker is
  known.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Full `bun test --bail` no longer fails with backend `BrandedScopeBreachError` | Pass | 5000 pass, 13 skip, 0 fail |
| Targeted settings handler + backend factory ordering passes | Pass | 39 pass, 1 skip, 0 fail after fix |
| Isolated session branch rollback test still passes | Pass | 3 pass, 0 fail |
| Worklog complete | Pass | This file |
| Commit created | Pass | This ticket commit |
