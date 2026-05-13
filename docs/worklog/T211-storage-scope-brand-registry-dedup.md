# T211 - Storage scope brand registry dedup Worklog

## 1. Task summary

Repair the C4 scope-brand runtime so official branded scopes minted through
duplicate module instances are accepted by storage internals.

## 2. Repo context discovered

- `storage-scope-auth.ts` keeps branded objects in a module-local WeakSet.
- `storage-internal.ts` rejects any scope not present in that WeakSet.
- Full `bun test --bail` reproduced the backend factory failure as:
  `BrandedScopeBreachError: storage received an unbranded workspace scope` from
  `loadConfigDefaults(DEFAULT_LOCAL_SCOPE)` in `ClaudeAgent`.
- A direct Bun probe confirmed duplicate imports create separate
  `DEFAULT_LOCAL_SCOPE` objects and separate WeakSets:
  `import('./storage-scope-auth.ts')` vs
  `import('./storage-scope-auth.ts?dup')`.

## 3. Files inspected

- `packages/shared/src/config/storage-scope-auth.ts`
- `packages/shared/src/config/storage-scope.ts`
- `packages/shared/src/config/storage-internal.ts`
- `packages/shared/src/config/storage-io.ts`
- `packages/shared/src/config/__tests__/storage-scope.test.ts`
- `packages/shared/src/agent/backend/__tests__/factory.test.ts`
- `packages/shared/src/agent/claude-agent.ts`

## 4. Tests added first

Add a regression test in `storage-scope.test.ts` that imports
`storage-scope-auth.ts` through a query-suffixed dynamic import and passes that
official duplicate `DEFAULT_LOCAL_SCOPE` to `getConfigDirForScope`.

## 5. Expected failing test output

Expected red command:

```bash
bun test packages/shared/src/config/__tests__/storage-scope.test.ts
```

Expected failure:

```text
BrandedScopeBreachError: storage received an unbranded workspace scope
```

## 6. Implementation changes

- Moved the internal branded-scope WeakSet onto a process-global registry keyed
  by a non-exported `Symbol.for('rox.storage.scope.brandedScopes')`.
- Kept the private brand symbol and `brand()` applier unexported.
- Added a regression test that imports `storage-scope-auth.ts` as a duplicate
  module instance and verifies its official `DEFAULT_LOCAL_SCOPE` resolves.
- Strengthened the runtime breach test so both forged local and forged workspace
  literals remain rejected.

## 7. Validation commands run

- `bun test packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts`
- `bun test packages/shared/src/agent/backend/__tests__/factory.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/agent/backend/__tests__/factory.test.ts`

## 8. Passing test output summary

- `storage-scope.test.ts`: 11 pass, 0 fail, 14 expects.
- `storage-scope-auth.test.ts`: 13 pass, 0 fail, 23 expects.
- `factory.test.ts`: 36 pass, 1 skip, 0 fail, 46 expects.
- Combined targeted run: 60 pass, 1 skip, 0 fail, 84 expects.

## 9. Build output summary

Pending final validation.

## 10. Remaining risks

- The shared registry is intentionally not exported. Code that does not import
  the official factory still cannot brand a scope through public APIs.
- Full suite must still be rerun to prove the earlier backend factory failure is
  gone in the complete test graph.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Duplicate-module official `DEFAULT_LOCAL_SCOPE` is accepted | Pass | New regression test |
| Unbranded literals remain rejected | Pass | Forged local and workspace literals throw `BrandedScopeBreachError` |
| Backend factory test passes | Pass | 36 pass, 1 skip, 0 fail |
| Worklog complete | Pass | This file |
| Commit created | Pass | This ticket commit |
