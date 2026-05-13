# Test Spec: C4 Multi-Tenant Storage Isolation

## Unit Tests

- `packages/shared/src/config/__tests__/storage-scope-runtime.test.ts`
  - Env unset is false.
  - Literal `ROX_MULTI_TENANT=1` is true.
  - Other values are false.
  - First env read is memoized.
  - Test override and reset work.

- `packages/shared/src/config/__tests__/storage-scope-auth.test.ts`
  - `DEFAULT_LOCAL_SCOPE` is branded and frozen.
  - Unbranded literals are not assignable to `BrandedWorkspaceScope`.
  - Single-user runtime returns `DEFAULT_LOCAL_SCOPE` and emits downgrade audit for requested workspace IDs.
  - Multi-tenant runtime permits authorized workspace scopes.
  - Multi-tenant runtime rejects forged workspace IDs with `MultiTenantForgeryError` and audit.
  - Brand symbol and brand applier are not exported.

- `packages/shared/src/config/__tests__/storage-scope.test.ts`
  - Existing tests remain green.
  - `DEFAULT_LOCAL_SCOPE` satisfies `BrandedWorkspaceScope`.
  - Unsafe unbranded cast reaches storage and throws `BrandedScopeBreachError`.

## Integration Tests

- `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
  - Single-user runtime demo caller reads flat storage.
  - Single-user runtime demo caller downgrades requested workspace ID.
  - Multi-tenant runtime demo caller passes permitted workspace scope.
  - Multi-tenant runtime demo caller rejects forbidden workspace ID.

## Validation Commands

- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope-runtime.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`

## Stop Conditions

Stop only when all targeted tests, typecheck, lint, full tests, build, ADR update, ticket/worklog matrix, and code review are complete, or when the implementation hits a design ambiguity, required production dependency, failed fast-forward, untestable invariant, or unavoidable out-of-scope change.
