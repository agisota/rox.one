# T203 - C4 storage scope path resolver

## 1. Task summary

Add the branded scope path resolver in `storage-internal.ts` and extend `storage-scope.test.ts` to prove flat single-user layout, tenant-prefixed opt-in layout, single-user downgrade, and runtime breach rejection.

## 2. Repo context discovered

- T202 moved `DEFAULT_LOCAL_SCOPE` into `storage-scope-auth.ts` and added the private runtime brand.
- `storage-internal.ts` currently has only flat helpers backed by `getConfigDir()`.
- `paths.ts` resolves `getConfigDir()` dynamically from `ROX_CONFIG_DIR`, which lets tests isolate config roots without new dependencies.
- The design spec names only three new test files, so resolver tests extend existing `storage-scope.test.ts` rather than adding a fourth test file.

## 3. Files inspected

- `packages/shared/src/config/storage-internal.ts`
- `packages/shared/src/config/paths.ts`
- `packages/shared/src/config/storage-io.ts`
- `packages/shared/src/config/__tests__/storage-scope.test.ts`
- `packages/shared/src/config/storage-scope-auth.ts`

## 4. Tests added first

- Extended `packages/shared/src/config/__tests__/storage-scope.test.ts`

## 5. Expected failing test output

Confirmed before implementation:

```text
SyntaxError: Export named 'BrandedScopeBreachError' not found in module
```

## 6. Implementation changes

- Added `BrandedScopeBreachError` and `getConfigDirForScope(scope)` to `storage-internal.ts`.
- `DEFAULT_LOCAL_SCOPE` resolves directly to `getConfigDir()`, preserving the flat single-user layout.
- Branded workspace scopes resolve to `<configDir>/tenants/<workspaceId>` only when multi-tenant mode is active.
- Branded workspace scopes downgrade to `getConfigDir()` when multi-tenant mode is inactive and emit `scope.runtime.workspace_downgraded`.
- Added a non-minting `isBrandedWorkspaceScope()` check in `storage-scope-auth.ts` backed by a private `WeakSet`. The brand symbol and applier remain private; the exported check cannot produce branded values.
- Unbranded scope-shaped values reaching storage throw `BrandedScopeBreachError` and emit `scope.brand.cast_breach`.

## 7. Validation commands run

- `bun test packages/shared/src/config/__tests__/storage-scope.test.ts` - failed before implementation for missing `BrandedScopeBreachError`.
- `bun test packages/shared/src/config/__tests__/storage-scope.test.ts` - passed after implementation.
- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts` - passed after implementation.
- `bun run typecheck` - passed.

## 8. Passing test output summary

- Extended `storage-scope.test.ts`: 8 pass, 0 fail, 10 assertions.
- Auth/runtime regression tests: 19 pass, 0 fail, 38 assertions.
- `bun run typecheck` completed with `packages/shared && bun run tsc --noEmit` exit 0.

## 9. Build output summary

Not run for this resolver ticket. Full build remains required at the end of the C4 source/runtime slice.

## 10. Remaining risks

- Resolver is not yet used by the 8 storage submodules; that is the next ticket.
- `isBrandedWorkspaceScope()` is exported only so `storage-internal.ts` can verify the private brand without exporting the private symbol or applier. It does not mint scopes.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `DEFAULT_LOCAL_SCOPE` resolves to `getConfigDir()` | Pass | `storage-scope.test.ts` |
| Workspace scope resolves to tenant prefix when active | Pass | `storage-scope.test.ts` |
| Workspace scope downgrades to flat when inactive | Pass | `storage-scope.test.ts` |
| Unbranded scope-shaped object throws `BrandedScopeBreachError` | Pass | `storage-scope.test.ts` |
| Audit events are observable | Pass | `storage-scope.test.ts` |
| Tests pass | Pass | Targeted resolver/auth/runtime tests and `bun run typecheck` |
| Worklog complete | Pass | This worklog |
| Commit created | Pass | This ticket commit |
