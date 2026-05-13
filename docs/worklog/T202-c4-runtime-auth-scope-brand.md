# T202 - C4 runtime/auth storage scope brand

## 1. Task summary

Introduce the C4 runtime mode detector and auth-owned branded storage scope producer. This is the first slice of C4 and must preserve single-user behavior while creating the trusted factory surface for tenant-scoped storage.

## 2. Repo context discovered

- `AGENTS.md` requires ticket-first, worklog-first, TDD-first implementation and a complete 11-section worklog before completion.
- The C4 design requires the brand symbol and `brand()` applier to stay private to `storage-scope-auth.ts`.
- `packages/shared/src/config/storage-scope.ts` currently owns the unbranded `WorkspaceScope` union and `DEFAULT_LOCAL_SCOPE`.
- `packages/shared/src/utils/debug.ts` exposes `createLogger(scope)` with `debug/info/warn/error`; there is no existing `trace` method.
- `package.json` root `typecheck` currently maps to `typecheck:shared`; full workspace typecheck is `typecheck:all`.
- ByteRover was requested by installed skill guidance, but `brv` is not installed in this container, so repo-local artifacts and explorers are the fallback.

## 3. Files inspected

- `AGENTS.md`
- `docs/superpowers/specs/2026-05-10-c4-multi-tenant-storage-isolation-design.md`
- `docs/superpowers/plans/2026-05-10-c4-multi-tenant-storage-isolation.md`
- `docs/decision-records/audit-harness/0005-storage-tenancy-contract.md`
- `packages/shared/src/config/storage-scope.ts`
- `packages/shared/src/config/storage-internal.ts`
- `packages/shared/src/utils/debug.ts`
- `package.json`

## 4. Tests added first

- `packages/shared/src/config/__tests__/storage-scope-runtime.test.ts`
- `packages/shared/src/config/__tests__/storage-scope-auth.test.ts`

## 5. Expected failing test output

Confirmed before implementation:

```text
Cannot find module '../storage-scope-runtime.ts'
Cannot find module '../storage-scope-auth.ts'
```

## 6. Implementation changes

- Added `storage-scope-runtime.ts` with literal `ROX_MULTI_TENANT=1` activation, memoized first read, and test override/reset helpers.
- Added `storage-scope-auth.ts` with a private runtime brand symbol, non-exported `brand()` applier, `BrandedWorkspaceScope`, branded/frozen `DEFAULT_LOCAL_SCOPE`, `deriveScopeFromAuth`, and `MultiTenantForgeryError`.
- Added structured audit payload emission through `createLogger('storage-scope')` for `scope.factory.downgraded` and `scope.factory.forgery_rejected`.
- Kept `storage-scope.ts` as the unbranded union owner and re-exported the public auth-owned scope API without exporting the brand symbol or applier.
- Updated the storage barrel to preserve facade imports for `DEFAULT_LOCAL_SCOPE` and expose the new branded public types/factory.

## 7. Validation commands run

- `git pull --ff-only origin main` - passed.
- `brv query "C4 multi-tenant storage isolation storage scope patterns in rox-one-terminal"` - failed because `brv` is not installed.
- `bun test packages/shared/src/config/__tests__/storage-scope-runtime.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts` - failed before implementation for missing modules.
- `bun test packages/shared/src/config/__tests__/storage-scope-runtime.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts` - passed after implementation.
- `bun run typecheck` - passed.

## 8. Passing test output summary

- Runtime/auth targeted tests: 19 pass, 0 fail, 38 assertions.
- `bun run typecheck` completed with `packages/shared && bun run tsc --noEmit` exit 0.

## 9. Build output summary

Not run for this foundation ticket. Runtime behavior changed, so the full build remains required at the end of the C4 slice after downstream resolver/RPC work lands.

## 10. Remaining risks

- Existing logger lacks a literal `trace` method. The implementation emits the required `scope.factory.downgraded` event payload at debug level with `level:"trace"` so the event name remains observable without a new dependency.
- Storage resolver, submodule narrowing, caller migration, and RPC demo wiring remain for later C4 tickets.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `DEFAULT_LOCAL_SCOPE` is branded, frozen, and canonical | Pass | `storage-scope-auth.test.ts` |
| `ROX_MULTI_TENANT=1` is the only activating env value | Pass | `storage-scope-runtime.test.ts` |
| Runtime mode is memoized and test-overridable | Pass | `storage-scope-runtime.test.ts` |
| Single-user factory returns `DEFAULT_LOCAL_SCOPE` and emits downgrade audit | Pass | `storage-scope-auth.test.ts` |
| Multi-tenant factory permits only `session.permittedWorkspaces` | Pass | `storage-scope-auth.test.ts` |
| Forgery throws and emits audit | Pass | `storage-scope-auth.test.ts` |
| Brand symbol and applier are not exported | Pass | `storage-scope-auth.test.ts` |
| Tests pass | Pass | Targeted auth/runtime tests and `bun run typecheck` |
| Worklog complete | Pass | This worklog |
| Commit created | Pass | This ticket commit |
