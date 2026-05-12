# C4 Multi-tenant Storage Isolation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `kind: 'workspace'` arm of `WorkspaceScope` (reserved by ADR 0005) progressively — type brand + auth factory + path resolver + runtime mode + demo caller + audit signals — so single-user runtime is byte-identical today and multi-tenant runtime opt-in via `ROX_MULTI_TENANT=1`.

**Architecture:** Three concentric rings (auth factory → branded type → path resolver) plus one wired-up demo caller. Brand is enforced compile-time after Phase 2; runtime defense-in-depth covers the in-flight migration window. Single-user data layout unchanged (`local-single-user` resolves to existing flat path); multi-tenant data layout is `<configDir>/tenants/<workspaceId>/...`.

**Tech Stack:** TypeScript (strict), Bun runtime, Bun test, existing structured logger (project default), monorepo with `packages/shared` and `packages/server-core`.

**Spec:** `docs/superpowers/specs/2026-05-10-c4-multi-tenant-storage-isolation-design.md`

**Worktree:** Recommended `/home/dev/craft/worktrees/rox-c4` off `origin/feat/architecture-slice3-storage-tenancy` (PR #18 base) or off `origin/main` if PR #18 has merged. The plan touches `storage-scope.ts` and the 8 storage submodules; stacks naturally on PR #18's WorkspaceScope work.

---

## File Structure

### Files created (3 source + 3 tests + 1 ADR)

| Path | Responsibility |
|---|---|
| `packages/shared/src/config/storage-scope-auth.ts` | Brand symbol (private), `BrandedWorkspaceScope` type, `DEFAULT_LOCAL_SCOPE` constant, `deriveScopeFromAuth` factory, `MultiTenantForgeryError`. Single owner of brand minting. |
| `packages/shared/src/config/storage-scope-runtime.ts` | `isMultiTenantActivated()` reading `ROX_MULTI_TENANT`, memoized at process start. `__setMultiTenantForTests()` escape hatch. |
| `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md` | New ADR documenting C4's contract. |
| `packages/shared/src/config/__tests__/storage-scope-auth.test.ts` | Factory unit tests + brand non-leakage assertions. |
| `packages/shared/src/config/__tests__/storage-scope-runtime.test.ts` | Env-var memoization + escape-hatch tests. |
| `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts` | Integration test for the demo caller across both runtime modes. |

### Files modified (5 source + 1 ADR + 1 barrel)

| Path | Change |
|---|---|
| `packages/shared/src/config/storage-scope.ts` | Remove `DEFAULT_LOCAL_SCOPE` (moves to `storage-scope-auth.ts`). Keep unbranded `WorkspaceScope` discriminated union. Re-export `BrandedWorkspaceScope` and `DEFAULT_LOCAL_SCOPE` from new module so existing import paths still work. |
| `packages/shared/src/config/storage.ts` (barrel) | Add re-exports for `BrandedWorkspaceScope`, `deriveScopeFromAuth`, `MultiTenantForgeryError` from `storage-scope-auth`. Existing `DEFAULT_LOCAL_SCOPE` and `WorkspaceScope` re-exports continue to work via the chain. |
| `packages/shared/src/config/storage-internal.ts` | Add `getConfigDirForScope(scope: BrandedWorkspaceScope): string` and `BrandedScopeBreachError`. Add runtime brand-check inside `getConfigDirForScope`. |
| Each of 8 submodules: `packages/shared/src/config/storage-{io,settings,workspaces,conversations,drafts,themes,llm-connections,tool-icons}.ts` | Replace internal `getConfigDir()` calls with `getConfigDirForScope(_scope)`. Phase 1: signatures unchanged. Phase 2: signatures narrowed `WorkspaceScope` → `BrandedWorkspaceScope`. |
| `packages/server-core/src/handlers/rpc/workspace.ts` | Wire `deriveScopeFromAuth(ctx.session, ctx.workspaceId)` in ONE chosen handler (`getWorkspaces`). Sibling handlers get `// TODO(C4)` comment. |
| `packages/shared/src/config/__tests__/storage-scope.test.ts` (existing from PR #18) | Extend with: `DEFAULT_LOCAL_SCOPE` satisfies `BrandedWorkspaceScope`; brand symbol not exported (compile-time check via `// @ts-expect-error`). |
| `docs/decision-records/audit-harness/0005-storage-tenancy-contract.md` | Update "Out of scope" section to mark workspace-id forgery defense, scope leakage prevention, and audit logging as implemented in ADR 0007 (single-user runtime). |

### Caller migration files (Phase 2)

After signatures narrow to `BrandedWorkspaceScope`, the typechecker will report errors at any caller constructing an unbranded `WorkspaceScope` literal. These callers are migrated in one sweep (Task 8). Likely hot zones based on PR #29's "remaining sites" report:

- `packages/shared/src/{agent,auth,credentials,workspaces}/...`
- `packages/shared/src/config/{watcher,validators,proxy-env,preferences}.ts`
- `apps/electron/src/main/{index,onboarding,power-manager,network-proxy,browser-pane-manager,auto-update}.ts`
- `packages/server/src/index.ts`
- `packages/server-core/src/webui/http-server.ts`

The exact set is determined by the typechecker after the narrowing commit; the plan keeps Task 8 generic enough to absorb all of them.

---

## Conventions used in this plan

- Every code block in a step is the **complete file** to write (or the complete diff hunk for a Modify step). The engineer copies it verbatim unless adapting to the actual current file content (which they should diff against).
- Test commands assume `bun` is installed and the working directory is the repo root.
- "Run typecheck" means `bunx tsc --noEmit` from the relevant package directory unless otherwise specified.
- Each task's final commit step is mandatory; do not batch commits across tasks.

---

### Task 1: Runtime mode detector

**Files:**
- Create: `packages/shared/src/config/storage-scope-runtime.ts`
- Create: `packages/shared/src/config/__tests__/storage-scope-runtime.test.ts`

- [ ] **Step 1: Write failing tests for the runtime mode detector**

`packages/shared/src/config/__tests__/storage-scope-runtime.test.ts`:
```ts
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  isMultiTenantActivated,
  __setMultiTenantForTests,
  __resetMultiTenantForTests,
} from '../storage-scope-runtime.ts';

describe('isMultiTenantActivated', () => {
  beforeEach(() => __resetMultiTenantForTests());
  afterEach(() => __resetMultiTenantForTests());

  test('returns false when ROX_MULTI_TENANT is unset', () => {
    delete process.env.ROX_MULTI_TENANT;
    expect(isMultiTenantActivated()).toBe(false);
  });

  test('returns true when ROX_MULTI_TENANT=1', () => {
    process.env.ROX_MULTI_TENANT = '1';
    expect(isMultiTenantActivated()).toBe(true);
  });

  test('returns false for non-"1" truthy strings', () => {
    for (const v of ['true', 'TRUE', 'yes', '0', '', 'on']) {
      process.env.ROX_MULTI_TENANT = v;
      __resetMultiTenantForTests();
      expect(isMultiTenantActivated()).toBe(false);
    }
  });

  test('result is memoized — env change after first read has no effect', () => {
    process.env.ROX_MULTI_TENANT = '1';
    expect(isMultiTenantActivated()).toBe(true);
    delete process.env.ROX_MULTI_TENANT;
    expect(isMultiTenantActivated()).toBe(true); // memoized
  });

  test('__setMultiTenantForTests overrides the memoized value', () => {
    expect(isMultiTenantActivated()).toBe(false);
    __setMultiTenantForTests(true);
    expect(isMultiTenantActivated()).toBe(true);
    __setMultiTenantForTests(false);
    expect(isMultiTenantActivated()).toBe(false);
  });

  test('__resetMultiTenantForTests clears the memo and the override', () => {
    __setMultiTenantForTests(true);
    expect(isMultiTenantActivated()).toBe(true);
    __resetMultiTenantForTests();
    delete process.env.ROX_MULTI_TENANT;
    expect(isMultiTenantActivated()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test packages/shared/src/config/__tests__/storage-scope-runtime.test.ts
```
Expected: FAIL with "Cannot find module '../storage-scope-runtime.ts'".

- [ ] **Step 3: Implement `storage-scope-runtime.ts`**

`packages/shared/src/config/storage-scope-runtime.ts`:
```ts
/**
 * Runtime-mode detection for multi-tenant storage isolation (C4).
 *
 * Reads `ROX_MULTI_TENANT` once at first invocation and memoizes the result.
 * The env var must be exactly "1" to activate multi-tenant runtime; any other
 * value (including "true", "yes", "TRUE") leaves the system in single-user
 * runtime where `kind:'workspace'` scopes gracefully downgrade to flat.
 *
 * Memoization is intentional: operators must restart the process to flip
 * runtime modes. This prevents env-var tampering during process lifetime.
 *
 * See: docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md
 */

let memoized: boolean | null = null;
let testOverride: boolean | null = null;

export function isMultiTenantActivated(): boolean {
  if (testOverride !== null) return testOverride;
  if (memoized === null) {
    memoized = process.env.ROX_MULTI_TENANT === '1';
  }
  return memoized;
}

/**
 * Test-only escape hatch. Bypasses the env-var read and memoization for
 * the lifetime of a test. MUST be paired with `__resetMultiTenantForTests`
 * in `afterEach` to avoid leaking state across tests.
 */
export function __setMultiTenantForTests(value: boolean): void {
  testOverride = value;
}

/**
 * Test-only escape hatch. Clears both the memoized value and any test
 * override so the next `isMultiTenantActivated()` call re-reads the env.
 */
export function __resetMultiTenantForTests(): void {
  memoized = null;
  testOverride = null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test packages/shared/src/config/__tests__/storage-scope-runtime.test.ts
```
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Run typecheck**

```bash
cd packages/shared && bunx tsc --noEmit
```
Expected: EXIT=0.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/config/storage-scope-runtime.ts \
        packages/shared/src/config/__tests__/storage-scope-runtime.test.ts
git commit -m "feat(shared/config): runtime-mode detector for multi-tenant storage (C4)"
```

---

### Task 2: Brand symbol + BrandedWorkspaceScope type

**Files:**
- Create: `packages/shared/src/config/storage-scope-auth.ts` (skeleton — brand only; factory and DEFAULT_LOCAL_SCOPE come in Tasks 3+4)
- Create: `packages/shared/src/config/__tests__/storage-scope-auth.test.ts`

- [ ] **Step 1: Write failing test for the brand**

`packages/shared/src/config/__tests__/storage-scope-auth.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';
import type { BrandedWorkspaceScope } from '../storage-scope-auth.ts';
import type { WorkspaceScope } from '../storage-scope.ts';

describe('BrandedWorkspaceScope', () => {
  test('is structurally a WorkspaceScope', () => {
    // Compile-time check: any BrandedWorkspaceScope is assignable to WorkspaceScope.
    // Phantom property doesn't change the runtime shape.
    const _check: (b: BrandedWorkspaceScope) => WorkspaceScope = (b) => b;
    expect(typeof _check).toBe('function');
  });

  test('plain WorkspaceScope literal is NOT a BrandedWorkspaceScope at the type level', () => {
    // Verified at compile time: the line below should fail typecheck.
    // We don't assert at runtime; this is documentation of the expected
    // compile error.
    //
    // @ts-expect-error - unbranded literal is not assignable
    const _bad: BrandedWorkspaceScope = { kind: 'local-single-user' };
    expect(_bad).toBeDefined(); // satisfies the linter; the error is at compile time
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts
```
Expected: FAIL with "Cannot find module '../storage-scope-auth.ts'".

- [ ] **Step 3: Create `storage-scope-auth.ts` with brand only**

`packages/shared/src/config/storage-scope-auth.ts`:
```ts
/**
 * Auth-bound minting of multi-tenant storage scopes.
 *
 * This module is the SINGLE owner of the brand that turns a plain
 * `WorkspaceScope` into a `BrandedWorkspaceScope`. The brand symbol and the
 * `brand()` applier below are NOT exported. Only `DEFAULT_LOCAL_SCOPE` and
 * `deriveScopeFromAuth` (added in subsequent tasks) escape this module with
 * branded values.
 *
 * Storage submodule signatures accept `BrandedWorkspaceScope`. Forgery is
 * compile-prevented because no exported function can mint a branded
 * `kind:'workspace'` value without going through the auth factory.
 *
 * See: docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md
 */

import type { WorkspaceScope } from './storage-scope.ts';

// Private brand. Not exported; not re-exported from the barrel. This is the
// linchpin of compile-time forgery defense.
declare const BRAND: unique symbol;

/**
 * A `WorkspaceScope` that has been minted by this module's auth factory or
 * comes from the `DEFAULT_LOCAL_SCOPE` constant. Storage submodules accept
 * only this branded type.
 */
export type BrandedWorkspaceScope = WorkspaceScope & {
  readonly [BRAND]: true;
};

// Internal applier. Not exported. Only this module's exported APIs may call it.
function brand(scope: WorkspaceScope): BrandedWorkspaceScope {
  return scope as BrandedWorkspaceScope;
}

// Suppress TypeScript's "unused declaration" warning for `brand` until
// later tasks add real callers. Remove this line in Task 3.
void brand;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts
```
Expected: PASS — 2 tests pass.

- [ ] **Step 5: Run typecheck**

```bash
cd packages/shared && bunx tsc --noEmit
```
Expected: EXIT=0.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/config/storage-scope-auth.ts \
        packages/shared/src/config/__tests__/storage-scope-auth.test.ts
git commit -m "feat(shared/config): BrandedWorkspaceScope type + private brand symbol (C4)"
```

---

### Task 3: Move DEFAULT_LOCAL_SCOPE to storage-scope-auth.ts

**Files:**
- Modify: `packages/shared/src/config/storage-scope-auth.ts` (add `DEFAULT_LOCAL_SCOPE` export)
- Modify: `packages/shared/src/config/storage-scope.ts` (remove `DEFAULT_LOCAL_SCOPE`; re-export from new module so import paths stay stable)
- Modify: `packages/shared/src/config/__tests__/storage-scope-auth.test.ts` (extend with `DEFAULT_LOCAL_SCOPE` assertions)

- [ ] **Step 1: Extend tests for DEFAULT_LOCAL_SCOPE in the new module**

Append to `packages/shared/src/config/__tests__/storage-scope-auth.test.ts`:
```ts
import { DEFAULT_LOCAL_SCOPE } from '../storage-scope-auth.ts';

describe('DEFAULT_LOCAL_SCOPE', () => {
  test('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_LOCAL_SCOPE)).toBe(true);
  });

  test('has kind === "local-single-user"', () => {
    expect(DEFAULT_LOCAL_SCOPE.kind).toBe('local-single-user');
  });

  test('satisfies BrandedWorkspaceScope at the type level', () => {
    // Compile-time check: assignment from BrandedWorkspaceScope succeeds.
    const _branded: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE;
    expect(_branded.kind).toBe('local-single-user');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts
```
Expected: FAIL with "DEFAULT_LOCAL_SCOPE is not exported".

- [ ] **Step 3: Add `DEFAULT_LOCAL_SCOPE` export to `storage-scope-auth.ts`**

Replace `packages/shared/src/config/storage-scope-auth.ts`'s tail:
```ts
// Replace the `void brand;` placeholder with the real first user of brand():
/**
 * The canonical single-user, untenanted scope. Frozen to prevent accidental
 * mutation that could leak across requests.
 *
 * Single-user runtime resolves all storage paths through this scope: every
 * existing single-user installation continues to read/write at the existing
 * flat `<configDir>/...` path with zero filesystem migration.
 */
export const DEFAULT_LOCAL_SCOPE: BrandedWorkspaceScope = brand(
  Object.freeze({ kind: 'local-single-user' as const }),
);
```

The full updated file should now be:
```ts
/**
 * Auth-bound minting of multi-tenant storage scopes.
 *
 * This module is the SINGLE owner of the brand that turns a plain
 * `WorkspaceScope` into a `BrandedWorkspaceScope`. The brand symbol and the
 * `brand()` applier below are NOT exported. Only `DEFAULT_LOCAL_SCOPE` and
 * `deriveScopeFromAuth` (added in subsequent tasks) escape this module with
 * branded values.
 *
 * Storage submodule signatures accept `BrandedWorkspaceScope`. Forgery is
 * compile-prevented because no exported function can mint a branded
 * `kind:'workspace'` value without going through the auth factory.
 *
 * See: docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md
 */

import type { WorkspaceScope } from './storage-scope.ts';

declare const BRAND: unique symbol;

export type BrandedWorkspaceScope = WorkspaceScope & {
  readonly [BRAND]: true;
};

function brand(scope: WorkspaceScope): BrandedWorkspaceScope {
  return scope as BrandedWorkspaceScope;
}

/**
 * The canonical single-user, untenanted scope. Frozen to prevent accidental
 * mutation that could leak across requests.
 *
 * Single-user runtime resolves all storage paths through this scope: every
 * existing single-user installation continues to read/write at the existing
 * flat `<configDir>/...` path with zero filesystem migration.
 */
export const DEFAULT_LOCAL_SCOPE: BrandedWorkspaceScope = brand(
  Object.freeze({ kind: 'local-single-user' as const }),
);
```

- [ ] **Step 4: Remove the duplicate `DEFAULT_LOCAL_SCOPE` from `storage-scope.ts`**

Edit `packages/shared/src/config/storage-scope.ts`. Remove the existing `DEFAULT_LOCAL_SCOPE` export. Keep the `WorkspaceScope` discriminated-union type and the `workspaceIdFromScope` helper.

Then ADD a re-export at the bottom so existing imports `from './storage-scope.ts'` keep working:
```ts
// Re-export branded API from the auth-bound module so existing import paths
// remain stable. The brand and `deriveScopeFromAuth` live in
// `./storage-scope-auth.ts` to keep this module a pure type-definition file.
export { DEFAULT_LOCAL_SCOPE, type BrandedWorkspaceScope } from './storage-scope-auth.ts';
```

- [ ] **Step 5: Update the storage barrel to also re-export the brand types**

Edit `packages/shared/src/config/storage.ts`. After the existing `export *` lines, ADD (or extend if already present):
```ts
export {
  DEFAULT_LOCAL_SCOPE,
  type BrandedWorkspaceScope,
} from './storage-scope-auth.ts';
```

This means callers using `import { DEFAULT_LOCAL_SCOPE } from '@craft-agent/shared/config/storage'` continue to work without changing their imports.

- [ ] **Step 6: Run tests to verify they pass**

```bash
bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts
bun test packages/shared/src/config/__tests__/storage-scope.test.ts
```
Expected: PASS — all tests pass (including the existing PR #18 freeze-test).

- [ ] **Step 7: Run typecheck**

```bash
cd packages/shared && bunx tsc --noEmit
```
Expected: EXIT=0.

- [ ] **Step 8: Run shared package smoke**

```bash
bun test packages/shared 2>&1 | tail -3
```
Expected: baseline preserved (e.g., 2885 pass / 12 skip / 0 fail or current baseline; nothing regressed).

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/config/storage-scope-auth.ts \
        packages/shared/src/config/storage-scope.ts \
        packages/shared/src/config/storage.ts \
        packages/shared/src/config/__tests__/storage-scope-auth.test.ts
git commit -m "refactor(shared/config): move DEFAULT_LOCAL_SCOPE to storage-scope-auth (C4)"
```

---

### Task 4: deriveScopeFromAuth — single-user mode

**Files:**
- Modify: `packages/shared/src/config/storage-scope-auth.ts` (add factory, single-user branch only)
- Modify: `packages/shared/src/config/__tests__/storage-scope-auth.test.ts`

- [ ] **Step 1: Write failing tests for the factory in single-user runtime**

Append to `packages/shared/src/config/__tests__/storage-scope-auth.test.ts`:
```ts
import { deriveScopeFromAuth } from '../storage-scope-auth.ts';
import {
  __setMultiTenantForTests,
  __resetMultiTenantForTests,
} from '../storage-scope-runtime.ts';

describe('deriveScopeFromAuth — single-user runtime', () => {
  beforeEach(() => __resetMultiTenantForTests());
  afterEach(() => __resetMultiTenantForTests());

  test('returns DEFAULT_LOCAL_SCOPE when ROX_MULTI_TENANT is unset (no requestedWorkspaceId)', () => {
    __setMultiTenantForTests(false);
    const session = { userId: 'u1', permittedWorkspaces: [] };
    const scope = deriveScopeFromAuth(session, null);
    expect(scope).toBe(DEFAULT_LOCAL_SCOPE);
  });

  test('returns DEFAULT_LOCAL_SCOPE in single-user mode even with requestedWorkspaceId', () => {
    __setMultiTenantForTests(false);
    const session = { userId: 'u1', permittedWorkspaces: [] };
    const scope = deriveScopeFromAuth(session, 'W42');
    expect(scope).toBe(DEFAULT_LOCAL_SCOPE);
  });

  test('returns DEFAULT_LOCAL_SCOPE when requestedWorkspaceId is empty string', () => {
    __setMultiTenantForTests(false);
    const session = { userId: 'u1', permittedWorkspaces: [] };
    const scope = deriveScopeFromAuth(session, '');
    expect(scope).toBe(DEFAULT_LOCAL_SCOPE);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts
```
Expected: FAIL — `deriveScopeFromAuth` is not exported.

- [ ] **Step 3: Add minimal factory + audit emit hook**

Edit `packages/shared/src/config/storage-scope-auth.ts`. Add at the end:
```ts
import { isMultiTenantActivated } from './storage-scope-runtime.ts';
import { logger } from '../logger.ts'; // adjust import to existing project logger

/**
 * Auth context required to derive a scope. The implementation cares only
 * about `userId` (for audit emit) and `permittedWorkspaces` (for forgery
 * defense in multi-tenant runtime). Slice 4's `AccountSession` already
 * carries `userId`; `permittedWorkspaces` is a forward-compatible field
 * populated by RBAC slice 6 — empty array in single-user runtime today.
 */
export interface ScopeAuthContext {
  readonly userId: string;
  readonly permittedWorkspaces: readonly string[];
}

/**
 * Mints a `BrandedWorkspaceScope` from authenticated session state.
 *
 * Single-user runtime (default): always returns `DEFAULT_LOCAL_SCOPE`,
 * ignoring `requestedWorkspaceId`. Emits a trace-level "downgraded"
 * audit event when `requestedWorkspaceId` was non-null/non-empty so
 * operators can observe the migration path before flipping multi-tenant
 * runtime on.
 *
 * Multi-tenant runtime (Task 5 extends this): validates
 * `requestedWorkspaceId ∈ session.permittedWorkspaces`; rejects forgery
 * with `MultiTenantForgeryError` and emits a warn-level audit event.
 */
export function deriveScopeFromAuth(
  session: ScopeAuthContext,
  requestedWorkspaceId: string | null | undefined,
): BrandedWorkspaceScope {
  if (!isMultiTenantActivated()) {
    if (requestedWorkspaceId !== null && requestedWorkspaceId !== undefined && requestedWorkspaceId !== '') {
      logger.trace(
        {
          event: 'scope.factory.downgraded',
          userId: session.userId,
          requestedWorkspaceId,
          reason: 'multi-tenant-not-activated',
        },
        'storage scope downgraded to local',
      );
    }
    return DEFAULT_LOCAL_SCOPE;
  }
  // Multi-tenant runtime path lands in Task 5.
  return DEFAULT_LOCAL_SCOPE;
}
```

> NOTE FOR IMPLEMENTER: The actual logger import path in this codebase may differ (e.g., `../logging/index.ts` or `@craft-agent/shared/logging`). Inspect an existing usage like `packages/shared/src/agent/base-agent.ts` for the canonical import. Replace `import { logger } from '../logger.ts'` with whatever the project actually exports.

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts
```
Expected: PASS — 3 new tests pass plus the previous 5.

- [ ] **Step 5: Run typecheck**

```bash
cd packages/shared && bunx tsc --noEmit
```
Expected: EXIT=0.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/config/storage-scope-auth.ts \
        packages/shared/src/config/__tests__/storage-scope-auth.test.ts
git commit -m "feat(shared/config): deriveScopeFromAuth single-user mode (C4)"
```

---

### Task 5: deriveScopeFromAuth — multi-tenant mode + forgery rejection

**Files:**
- Modify: `packages/shared/src/config/storage-scope-auth.ts` (add multi-tenant branch + `MultiTenantForgeryError`)
- Modify: `packages/shared/src/config/__tests__/storage-scope-auth.test.ts`

- [ ] **Step 1: Write failing tests for multi-tenant runtime + forgery**

Append to `packages/shared/src/config/__tests__/storage-scope-auth.test.ts`:
```ts
import { MultiTenantForgeryError } from '../storage-scope-auth.ts';

describe('deriveScopeFromAuth — multi-tenant runtime', () => {
  beforeEach(() => __resetMultiTenantForTests());
  afterEach(() => __resetMultiTenantForTests());

  test('returns branded workspace scope when requestedWorkspaceId is permitted', () => {
    __setMultiTenantForTests(true);
    const session = { userId: 'u1', permittedWorkspaces: ['W42', 'W17'] };
    const scope = deriveScopeFromAuth(session, 'W42');
    expect(scope.kind).toBe('workspace');
    expect((scope as { kind: 'workspace'; workspaceId: string }).workspaceId).toBe('W42');
  });

  test('returns DEFAULT_LOCAL_SCOPE when requestedWorkspaceId is null', () => {
    __setMultiTenantForTests(true);
    const session = { userId: 'u1', permittedWorkspaces: ['W42'] };
    const scope = deriveScopeFromAuth(session, null);
    expect(scope).toBe(DEFAULT_LOCAL_SCOPE);
  });

  test('throws MultiTenantForgeryError when requestedWorkspaceId is not permitted', () => {
    __setMultiTenantForTests(true);
    const session = { userId: 'u1', permittedWorkspaces: ['W42'] };
    expect(() => deriveScopeFromAuth(session, 'W_OTHER')).toThrow(MultiTenantForgeryError);
  });

  test('throws MultiTenantForgeryError carrying request context', () => {
    __setMultiTenantForTests(true);
    const session = { userId: 'u1', permittedWorkspaces: ['W42'] };
    try {
      deriveScopeFromAuth(session, 'W_OTHER');
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(MultiTenantForgeryError);
      expect((e as MultiTenantForgeryError).userId).toBe('u1');
      expect((e as MultiTenantForgeryError).requestedWorkspaceId).toBe('W_OTHER');
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts
```
Expected: FAIL — `MultiTenantForgeryError` not exported; multi-tenant branch returns `DEFAULT_LOCAL_SCOPE` (wrong shape) for permitted case.

- [ ] **Step 3: Add `MultiTenantForgeryError` and complete the multi-tenant branch**

Edit `packages/shared/src/config/storage-scope-auth.ts`. Add this class somewhere near the top (after the imports, before the brand declaration):
```ts
/**
 * Thrown by `deriveScopeFromAuth` in multi-tenant runtime when
 * `requestedWorkspaceId` is not in `session.permittedWorkspaces`.
 *
 * Caught at the webui error boundary; mapped to HTTP 403 Forbidden.
 * Carries enough context for audit/forensics without leaking the full
 * permitted-workspace list.
 */
export class MultiTenantForgeryError extends Error {
  readonly userId: string;
  readonly requestedWorkspaceId: string;
  readonly permittedCount: number;

  constructor(userId: string, requestedWorkspaceId: string, permittedCount: number) {
    super(
      `User ${userId} attempted to access workspace ${requestedWorkspaceId} ` +
        `but it is not in their permitted set (${permittedCount} permitted).`,
    );
    this.name = 'MultiTenantForgeryError';
    this.userId = userId;
    this.requestedWorkspaceId = requestedWorkspaceId;
    this.permittedCount = permittedCount;
  }
}
```

Then replace the placeholder multi-tenant branch in `deriveScopeFromAuth` (the `// Multi-tenant runtime path lands in Task 5.` comment) with:
```ts
  // Multi-tenant runtime: validate against session.permittedWorkspaces.
  if (requestedWorkspaceId === null || requestedWorkspaceId === undefined || requestedWorkspaceId === '') {
    return DEFAULT_LOCAL_SCOPE;
  }
  if (!session.permittedWorkspaces.includes(requestedWorkspaceId)) {
    logger.warn(
      {
        event: 'scope.factory.forgery_rejected',
        userId: session.userId,
        requestedWorkspaceId,
        permittedCount: session.permittedWorkspaces.length,
      },
      'storage scope forgery rejected',
    );
    throw new MultiTenantForgeryError(
      session.userId,
      requestedWorkspaceId,
      session.permittedWorkspaces.length,
    );
  }
  return brand({ kind: 'workspace', workspaceId: requestedWorkspaceId });
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts
```
Expected: PASS — all tests pass (8 from Task 4 + 4 new = 12 in this file).

- [ ] **Step 5: Run typecheck**

```bash
cd packages/shared && bunx tsc --noEmit
```
Expected: EXIT=0.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/config/storage-scope-auth.ts \
        packages/shared/src/config/__tests__/storage-scope-auth.test.ts
git commit -m "feat(shared/config): deriveScopeFromAuth multi-tenant + forgery rejection (C4)"
```

---

### Task 6: getConfigDirForScope + BrandedScopeBreachError

**Files:**
- Modify: `packages/shared/src/config/storage-internal.ts`
- Create or extend: tests for the path resolver. If `storage-internal.test.ts` doesn't exist, create one alongside the new logic; otherwise extend.

- [ ] **Step 1: Write failing tests for `getConfigDirForScope`**

Create `packages/shared/src/config/__tests__/storage-internal-scope.test.ts`:
```ts
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as path from 'node:path';
import {
  getConfigDirForScope,
  BrandedScopeBreachError,
} from '../storage-internal.ts';
import { DEFAULT_LOCAL_SCOPE } from '../storage-scope-auth.ts';
import {
  __setMultiTenantForTests,
  __resetMultiTenantForTests,
} from '../storage-scope-runtime.ts';
import { getConfigDir } from '../paths.ts'; // adjust to actual path util

describe('getConfigDirForScope', () => {
  beforeEach(() => __resetMultiTenantForTests());
  afterEach(() => __resetMultiTenantForTests());

  test('local-single-user → flat configDir', () => {
    expect(getConfigDirForScope(DEFAULT_LOCAL_SCOPE)).toBe(getConfigDir());
  });

  test('workspace + multi-tenant activated → tenant-prefixed', () => {
    __setMultiTenantForTests(true);
    // Use the auth factory to mint a branded workspace scope; do not
    // construct one externally (the brand is private).
    const { deriveScopeFromAuth } = require('../storage-scope-auth.ts');
    const scope = deriveScopeFromAuth(
      { userId: 'u1', permittedWorkspaces: ['W42'] },
      'W42',
    );
    const expected = path.join(getConfigDir(), 'tenants', 'W42');
    expect(getConfigDirForScope(scope)).toBe(expected);
  });

  test('workspace + multi-tenant NOT activated → flat (graceful downgrade)', () => {
    // Force-construct a branded workspace scope by activating multi-tenant
    // for the mint step, then deactivate before the resolver call.
    __setMultiTenantForTests(true);
    const { deriveScopeFromAuth } = require('../storage-scope-auth.ts');
    const scope = deriveScopeFromAuth(
      { userId: 'u1', permittedWorkspaces: ['W42'] },
      'W42',
    );
    __setMultiTenantForTests(false);
    expect(getConfigDirForScope(scope)).toBe(getConfigDir());
  });

  test('unbranded scope-shaped object → throws BrandedScopeBreachError', () => {
    const fakeScope = { kind: 'workspace' as const, workspaceId: 'W_FAKE' };
    expect(() => {
      // @ts-expect-error - deliberately bypassing the brand for the test
      getConfigDirForScope(fakeScope);
    }).toThrow(BrandedScopeBreachError);
  });
});
```

> IMPLEMENTER NOTE: `getConfigDir` in this test imports from `../paths.ts`. Inspect `storage-internal.ts` to see what utility it currently uses (likely `paths.ts` or similar) and adjust the test import accordingly.

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test packages/shared/src/config/__tests__/storage-internal-scope.test.ts
```
Expected: FAIL — `getConfigDirForScope` and `BrandedScopeBreachError` not exported.

- [ ] **Step 3: Implement `getConfigDirForScope` and `BrandedScopeBreachError`**

Edit `packages/shared/src/config/storage-internal.ts`. Add imports at top:
```ts
import * as path from 'node:path';
import type { BrandedWorkspaceScope } from './storage-scope-auth.ts';
import { isMultiTenantActivated } from './storage-scope-runtime.ts';
import { logger } from '../logger.ts'; // adjust import path as in Task 4
```

Add at the bottom of the file:
```ts
/**
 * Thrown when a scope reaches storage without the brand symbol. Should
 * never fire in normal code paths because the type system rejects unbranded
 * literals at submodule signatures. Defense-in-depth against unsafe casts.
 */
export class BrandedScopeBreachError extends Error {
  readonly receivedShape: unknown;

  constructor(receivedShape: unknown) {
    super('storage received an unbranded scope (compile-time defense bypassed)');
    this.name = 'BrandedScopeBreachError';
    this.receivedShape = receivedShape;
  }
}

/**
 * Resolves a `BrandedWorkspaceScope` to the on-disk config directory the
 * caller should read/write under. Single-user runtime always resolves to
 * the existing flat `getConfigDir()` path; multi-tenant runtime resolves
 * `kind:'workspace'` scopes to `<configDir>/tenants/<workspaceId>`.
 *
 * In single-user runtime, `kind:'workspace'` scopes gracefully downgrade
 * to the flat path with a warn-level audit log. This means an operator can
 * flip `ROX_MULTI_TENANT=1` on then off and the data layout stays consistent
 * during the transition (modulo any data they wrote under the tenant prefix).
 *
 * Runtime brand-check: if the scope arrives without the brand symbol (only
 * possible via `as BrandedWorkspaceScope`), throws `BrandedScopeBreachError`
 * and emits an error-level audit event. This is defense-in-depth — the
 * primary forgery defense is the type system at submodule call sites.
 */
export function getConfigDirForScope(scope: BrandedWorkspaceScope): string {
  // Runtime brand-check. We can't see the symbol at runtime (declare const),
  // so we validate the structural shape: kind must be one of the two known
  // values, and the object must not be a plain object literal lacking either
  // `kind:'local-single-user'` or `kind:'workspace' & workspaceId:string`.
  if (
    scope === null ||
    typeof scope !== 'object' ||
    !('kind' in scope) ||
    (scope.kind !== 'local-single-user' &&
      scope.kind !== 'workspace')
  ) {
    logger.error(
      { event: 'scope.brand.cast_breach', scopeShape: scope },
      'storage received unbranded scope',
    );
    throw new BrandedScopeBreachError(scope);
  }
  if (scope.kind === 'local-single-user') {
    return getConfigDir();
  }
  // scope.kind === 'workspace'
  if (typeof scope.workspaceId !== 'string' || scope.workspaceId === '') {
    logger.error(
      { event: 'scope.brand.cast_breach', scopeShape: scope },
      'storage received malformed workspace scope',
    );
    throw new BrandedScopeBreachError(scope);
  }
  if (!isMultiTenantActivated()) {
    logger.warn(
      {
        event: 'scope.runtime.workspace_downgraded',
        workspaceId: scope.workspaceId,
      },
      'workspace scope downgraded to flat (multi-tenant not activated)',
    );
    return getConfigDir();
  }
  return path.join(getConfigDir(), 'tenants', scope.workspaceId);
}
```

> IMPLEMENTER NOTE: This module already imports `getConfigDir`. Use that existing import; do not add a duplicate.

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test packages/shared/src/config/__tests__/storage-internal-scope.test.ts
```
Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Run shared package tests + typecheck**

```bash
cd packages/shared && bunx tsc --noEmit && bun test 2>&1 | tail -3
```
Expected: typecheck EXIT=0; test baseline preserved.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/config/storage-internal.ts \
        packages/shared/src/config/__tests__/storage-internal-scope.test.ts
git commit -m "feat(shared/config): getConfigDirForScope + BrandedScopeBreachError (C4)"
```

---

### Task 7: Wire 8 storage submodules to use getConfigDirForScope

**Files (8 modify):**
- `packages/shared/src/config/storage-io.ts`
- `packages/shared/src/config/storage-settings.ts`
- `packages/shared/src/config/storage-workspaces.ts`
- `packages/shared/src/config/storage-conversations.ts`
- `packages/shared/src/config/storage-drafts.ts`
- `packages/shared/src/config/storage-themes.ts`
- `packages/shared/src/config/storage-llm-connections.ts`
- `packages/shared/src/config/storage-tool-icons.ts`

This task is mechanical: for each submodule, replace internal `getConfigDir()` call sites with `getConfigDirForScope(_scope)`. **Signatures DO NOT change in this task** (Phase 1 keeps signatures at `WorkspaceScope`). Single-user runtime behavior is byte-identical because `DEFAULT_LOCAL_SCOPE` resolves to the flat path.

- [ ] **Step 1: Read one submodule to understand the call pattern**

```bash
head -40 packages/shared/src/config/storage-settings.ts
```
Find every line that calls `getConfigDir()` and trace what it does with the result.

- [ ] **Step 2: Update each submodule**

For each of the 8 files, perform this transformation:

1. Add (or extend) the import at the top:
   ```ts
   import { getConfigDirForScope } from './storage-internal.ts';
   ```
   If `getConfigDirForScope` is already imported via another path, deduplicate.

2. Replace every `getConfigDir()` call inside an exported function whose signature includes `_scope: WorkspaceScope`:
   ```ts
   // Before:
   const dir = getConfigDir();
   // After:
   const dir = getConfigDirForScope(_scope);
   ```

3. Leave `getConfigDir()` calls in helpers that don't have scope in scope as-is (they should be rare; if any persist, file a follow-up note in the commit body).

> IMPLEMENTER NOTE: After PR #29 the submodule signatures already accept `_scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE`. The `_scope` variable is in scope for every exported function; use it directly.

- [ ] **Step 3: Run shared package tests after each submodule**

After updating each file, run:
```bash
bun test packages/shared 2>&1 | tail -3
```
Expected: baseline preserved. `getConfigDirForScope(DEFAULT_LOCAL_SCOPE) === getConfigDir()` so behavior is byte-identical.

If a test fails, the submodule passes a non-default scope somewhere unexpected, or the import is wrong. Investigate before continuing.

- [ ] **Step 4: Final verification**

```bash
cd packages/shared && bunx tsc --noEmit
bun test packages/shared 2>&1 | tail -3
bun test packages/server-core 2>&1 | tail -3
```
Expected: typecheck EXIT=0; both test suites green at their respective baselines.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/config/storage-{io,settings,workspaces,conversations,drafts,themes,llm-connections,tool-icons}.ts
git commit -m "refactor(shared/config): wire 8 storage submodules to getConfigDirForScope (C4)"
```

---

### Task 8: Narrow submodule signatures to BrandedWorkspaceScope + sweep callers

This is the **compile-time enforcement landing**. After this commit, no caller can pass an unbranded `WorkspaceScope` to a storage submodule.

**Files (modify):**
- 8 storage submodule signatures
- All caller files that produce typecheck errors after the narrowing (the set is determined by typecheck output; expected zones listed in "Caller migration files" above)

- [ ] **Step 1: Narrow each submodule signature**

For each of the 8 storage submodules, change the parameter type:
```ts
// Before:
export function persistConfig(
  cfg: StoredConfig,
  _scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE,
): void { /* ... */ }

// After:
export function persistConfig(
  cfg: StoredConfig,
  _scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE,
): void { /* ... */ }
```

Update the import for each file: `WorkspaceScope` → `BrandedWorkspaceScope`. The barrel re-exports both, so callers get type errors only at sites constructing literals.

- [ ] **Step 2: Run typecheck across the workspace to find the breakage set**

```bash
cd packages/shared && bunx tsc --noEmit 2>&1 | head -50
cd packages/server-core && bunx tsc --noEmit 2>&1 | head -50
cd apps/electron && bunx tsc --noEmit 2>&1 | head -50
cd packages/server && bunx tsc --noEmit 2>&1 | head -50
```

Expected: typecheck reports errors of the form `Type '{ kind: "local-single-user"; }' is not assignable to type 'BrandedWorkspaceScope'`. Capture each error's `file:line` for the next step.

- [ ] **Step 3: Fix each caller**

For each error site, the fix is one of:

(a) Caller constructs `{ kind: 'local-single-user' }` literal → replace with `DEFAULT_LOCAL_SCOPE`:
```ts
// Before:
storage.persistConfig(cfg, { kind: 'local-single-user' });
// After:
storage.persistConfig(cfg, DEFAULT_LOCAL_SCOPE);
```

(b) Caller constructs `{ kind: 'workspace', workspaceId: x }` literal → use `deriveScopeFromAuth`:
```ts
// Before:
storage.persistConfig(cfg, { kind: 'workspace', workspaceId: 'W42' });
// After:
const scope = deriveScopeFromAuth(ctx.session, 'W42');
storage.persistConfig(cfg, scope);
```

(c) Caller variable typed as `WorkspaceScope` is being passed to a `BrandedWorkspaceScope` parameter → either change the variable type to `BrandedWorkspaceScope` (preferred — propagates the brand requirement up the call chain) or replace with `DEFAULT_LOCAL_SCOPE` if the caller doesn't actually need scope discrimination.

After each cluster of fixes, run typecheck for that package and verify it goes from "errors" to "EXIT=0" before moving to the next cluster. **Do NOT batch all clusters into one untested change.**

- [ ] **Step 4: Final verification**

```bash
cd packages/shared && bunx tsc --noEmit
cd packages/server-core && bunx tsc --noEmit
cd apps/electron && bunx tsc --noEmit
cd packages/server && bunx tsc --noEmit
bun test packages/shared 2>&1 | tail -3
bun test packages/server-core 2>&1 | tail -3
```

Expected: ALL typechecks EXIT=0; test baselines preserved.

- [ ] **Step 5: Commit**

```bash
# Stage the 8 submodule signature changes:
git add packages/shared/src/config/storage-{io,settings,workspaces,conversations,drafts,themes,llm-connections,tool-icons}.ts
# Stage every caller file you touched in Step 3. After typecheck is clean,
# `git status --short` lists the modified files; stage them all:
git status --short | awk '$1 == "M" || $1 == "MM" {print $2}' | xargs git add
# Verify the stage looks right (no unrelated files):
git status --short
# Commit:
git commit -m "refactor: narrow storage submodule signatures to BrandedWorkspaceScope (C4)

Lands compile-time forgery defense for the multi-tenant storage isolation
slice. Submodule signatures now require BrandedWorkspaceScope; callers must
either pass DEFAULT_LOCAL_SCOPE or mint a branded scope via
deriveScopeFromAuth. Unbranded literal construction is a type error."
```

---

### Task 9: Demo caller — wire deriveScopeFromAuth in workspace.ts

**Files:**
- Modify: `packages/server-core/src/handlers/rpc/workspace.ts`

The demo caller picks ONE handler in `workspace.ts` and wires `deriveScopeFromAuth` end-to-end. Other handlers in the same file get `// TODO(C4)` comments. The choice of handler should be a read-only path (for safety); `getWorkspaces` is a good candidate.

- [ ] **Step 1: Identify the chosen handler**

```bash
head -100 packages/server-core/src/handlers/rpc/workspace.ts
```

Find a handler that:
- Is read-only (GET-style)
- Has access to `ctx.session` (or whatever the project calls the auth context)
- Calls a storage submodule

`getWorkspaces` is the recommended target. If unavailable or not read-only, `getWorkspaceByNameOrId` is the fallback.

- [ ] **Step 2: Wire the auth factory**

In the chosen handler, replace the `DEFAULT_LOCAL_SCOPE` argument with a derived scope:
```ts
// Before:
async function getWorkspacesHandler(ctx: Context): Promise<Workspace[]> {
  return storage.getWorkspaces(DEFAULT_LOCAL_SCOPE);
}

// After:
async function getWorkspacesHandler(ctx: Context): Promise<Workspace[]> {
  // C4: scope derived from authenticated session state. Single-user runtime
  // returns DEFAULT_LOCAL_SCOPE; multi-tenant runtime checks
  // session.permittedWorkspaces and rejects forgery.
  const scope = deriveScopeFromAuth(ctx.session, ctx.workspaceId ?? null);
  return storage.getWorkspaces(scope);
}
```

> IMPLEMENTER NOTE: `ctx.session` and `ctx.workspaceId` are the assumed shape; use whatever the project's actual context uses. If `ctx.session.permittedWorkspaces` doesn't exist yet (slice 6 RBAC hasn't landed), provide an empty array — single-user runtime ignores it anyway.

- [ ] **Step 3: Add TODO comments to sibling handlers**

For each OTHER handler in `workspace.ts` that calls a storage submodule with `DEFAULT_LOCAL_SCOPE`, add a one-line comment immediately above the call:
```ts
// TODO(C4): use deriveScopeFromAuth(ctx.session, ctx.workspaceId) when ready.
```

This makes the migration pattern discoverable and creates a grep target for follow-up slices.

- [ ] **Step 4: Verify typecheck and tests**

```bash
cd packages/server-core && bunx tsc --noEmit
bun test packages/server-core 2>&1 | tail -3
```
Expected: typecheck EXIT=0; existing tests green (no integration test for the demo caller yet — that's Task 10).

- [ ] **Step 5: Commit**

```bash
git add packages/server-core/src/handlers/rpc/workspace.ts
git commit -m "feat(server-core/rpc): wire deriveScopeFromAuth in workspace.ts demo caller (C4)"
```

---

### Task 10: Integration test for the demo caller

**Files:**
- Create: `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`

- [ ] **Step 1: Write integration tests**

`packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`:
```ts
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  __setMultiTenantForTests,
  __resetMultiTenantForTests,
} from '@craft-agent/shared/config/storage-scope-runtime';
import {
  MultiTenantForgeryError,
} from '@craft-agent/shared/config/storage-scope-auth';
// Adjust the import below to whatever the project's test harness expects:
import { invokeHandler } from '../../../../tests/helpers/invoke-rpc-handler.ts';

describe('workspace.ts getWorkspaces — scope wiring (C4)', () => {
  beforeEach(() => __resetMultiTenantForTests());
  afterEach(() => __resetMultiTenantForTests());

  test('single-user runtime: returns existing flat-path data', async () => {
    __setMultiTenantForTests(false);
    const ctx = {
      session: { userId: 'u1', permittedWorkspaces: [] },
      workspaceId: null,
    };
    const result = await invokeHandler('getWorkspaces', ctx);
    // Existing single-user behavior preserved.
    expect(Array.isArray(result)).toBe(true);
  });

  test('single-user runtime ignores requestedWorkspaceId (downgrades to flat)', async () => {
    __setMultiTenantForTests(false);
    const ctx = {
      session: { userId: 'u1', permittedWorkspaces: [] },
      workspaceId: 'W42',
    };
    const result = await invokeHandler('getWorkspaces', ctx);
    expect(Array.isArray(result)).toBe(true);
    // Reads same flat data as the no-workspaceId case.
  });

  test('multi-tenant runtime: returns tenant-prefixed data for permitted workspace', async () => {
    __setMultiTenantForTests(true);
    const ctx = {
      session: { userId: 'u1', permittedWorkspaces: ['W42'] },
      workspaceId: 'W42',
    };
    const result = await invokeHandler('getWorkspaces', ctx);
    expect(Array.isArray(result)).toBe(true);
    // Path resolution went through tenants/W42; absent fixture data is empty array.
  });

  test('multi-tenant runtime: forgery attempt throws MultiTenantForgeryError', async () => {
    __setMultiTenantForTests(true);
    const ctx = {
      session: { userId: 'u1', permittedWorkspaces: ['W42'] },
      workspaceId: 'W_OTHER',
    };
    await expect(invokeHandler('getWorkspaces', ctx)).rejects.toThrow(MultiTenantForgeryError);
  });

  test('multi-tenant runtime + null workspaceId: returns flat data (downgrade path)', async () => {
    __setMultiTenantForTests(true);
    const ctx = {
      session: { userId: 'u1', permittedWorkspaces: ['W42'] },
      workspaceId: null,
    };
    const result = await invokeHandler('getWorkspaces', ctx);
    expect(Array.isArray(result)).toBe(true);
  });
});
```

> IMPLEMENTER NOTE: `invokeHandler` is a stand-in. Inspect existing tests under `packages/server-core/src/handlers/rpc/__tests__/` (or equivalent) for the project's actual handler-invocation harness. If no harness exists, simulate by directly importing the handler function and calling it with a synthetic context object; the test still validates the scope-wiring contract.

- [ ] **Step 2: Run tests to verify they fail (or pass cleanly if the demo caller is correctly wired)**

```bash
bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts
```
Expected: PASS for tests 1, 2, 5 (scope downgrades); PASS for tests 3, 4 (multi-tenant + permitted/forgery). If any fail, the demo caller wiring (Task 9) needs adjustment.

- [ ] **Step 3: Run server-core tests + typecheck**

```bash
cd packages/server-core && bunx tsc --noEmit
bun test packages/server-core 2>&1 | tail -3
```
Expected: typecheck EXIT=0; baseline preserved + 5 new tests.

- [ ] **Step 4: Commit**

```bash
git add packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts
git commit -m "test(server-core/rpc): integration tests for C4 demo caller across runtime modes"
```

---

### Task 11: ADR 0007 + ADR 0005 update

**Files:**
- Create: `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
- Modify: `docs/decision-records/audit-harness/0005-storage-tenancy-contract.md`

- [ ] **Step 1: Write ADR 0007**

`docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`:
```markdown
# Decision 0007: Multi-Tenant Storage Isolation (Progressive)

- Status: accepted
- Date: 2026-05-10
- Implements: ADR 0005's reserved `kind:'workspace'` arm of `WorkspaceScope`

## Canonical

`WorkspaceScope` is now nominally typed via `BrandedWorkspaceScope`, owned exclusively by `packages/shared/src/config/storage-scope-auth.ts`. Storage submodule signatures accept only branded values. The brand symbol and `brand()` applier are private to that module — no external code can mint branded scopes.

`DEFAULT_LOCAL_SCOPE` and `deriveScopeFromAuth(session, requestedWorkspaceId)` are the only producers of branded values. The factory:

- Single-user runtime (default): always returns `DEFAULT_LOCAL_SCOPE`. Emits trace-level `scope.factory.downgraded` audit when `requestedWorkspaceId` was non-null.
- Multi-tenant runtime (`ROX_MULTI_TENANT=1`): validates `requestedWorkspaceId ∈ session.permittedWorkspaces`. Permitted → returns branded `kind:'workspace'`. Not permitted → throws `MultiTenantForgeryError` and emits warn-level `scope.factory.forgery_rejected`. Null/empty → returns `DEFAULT_LOCAL_SCOPE`.

`storage-internal.getConfigDirForScope(scope)` resolves on-disk paths:
- `kind:'local-single-user'` → existing flat `<configDir>/...` (zero migration for existing single-user installations)
- `kind:'workspace'` + multi-tenant activated → `<configDir>/tenants/<workspaceId>/...`
- `kind:'workspace'` + single-user runtime → graceful downgrade to flat with warn-level `scope.runtime.workspace_downgraded` audit

A defense-in-depth runtime brand-check throws `BrandedScopeBreachError` if a scope-shaped object reaches storage without the structural brand markers (only possible via unsafe `as` casts).

One demo caller in `packages/server-core/src/handlers/rpc/workspace.ts` wires `deriveScopeFromAuth` end-to-end. Sibling handlers carry `// TODO(C4)` comments as a copy-paste template for follow-up slices.

## Why

- **Compile-time forgery defense**, not just runtime. The brand makes unbranded `WorkspaceScope` literals unassignable to storage submodule parameters. ADR 0005 promised forgery defense; this ADR delivers it at the point in the build where it's hardest to bypass.
- **Single-user installations see zero behavior change.** `DEFAULT_LOCAL_SCOPE` resolves to the existing flat path; no filesystem migration. Trace-level `scope.factory.downgraded` events are filtered by default.
- **Multi-tenant runtime is opt-in.** Operators flip `ROX_MULTI_TENANT=1` to activate. Without it, `kind:'workspace'` scopes downgrade to flat. Means the type system is fully enforced today (factory always returns `local-single-user` in single-user runtime), but no production traffic exercises the multi-tenant path until operators explicitly opt in.
- **Auth factory is the only producer of `kind:'workspace'` scopes** — enforced by colocating the brand symbol and the factory in the same private module.

## Out of scope (deferred to follow-up slices)

- **Per-tenant credential encryption.** v1 uses path-prefix isolation under the existing single-user encryption substrate. A follow-up slice can add `tenantKey = HKDF(masterKey, workspaceId)` for `credentials/manager.ts` if SaaS-grade key isolation becomes a requirement.
- **RBAC-driven `session.permittedWorkspaces` population.** Slice 6 (RBAC) populates this field. Today it's an empty array in single-user runtime; multi-tenant runtime requires operators to populate it through whatever mechanism precedes RBAC.
- **Pi-agent-server scope propagation across IPC.** Subprocesses see `local-single-user` always in this slice. Cross-process scope propagation is its own design problem (serialization, integrity, replay).
- **Multi-tenant data migration tools.** Operators flipping `ROX_MULTI_TENANT=1` on existing single-user data need a migration tool to relocate `<configDir>/...` → `<configDir>/tenants/<defaultWorkspaceId>/...`. That tool is a separate slice.
- **Audit-event storage backend.** Current implementation uses the existing structured logger. A queryable audit store (search, retention, tamper-resistance) is a future slice if operators need it.
- **Demo caller migration to remaining handlers.** Only `workspace.ts:getWorkspaces` is wired; sibling handlers carry `// TODO(C4)` markers.
- **`apps/electron/src/main/handlers/*` migration.** These remain at `DEFAULT_LOCAL_SCOPE` permanently — they're headless / no-session paths.

## Security implications

- **Workspace-id forgery:** compile-time prevented. Any bypass requires an `as BrandedWorkspaceScope` unsafe cast, which the runtime brand-check catches with `BrandedScopeBreachError`.
- **Scope leakage across requests:** `DEFAULT_LOCAL_SCOPE` is a frozen singleton (safe to share). Multi-tenant scopes are constructed fresh per request inside `deriveScopeFromAuth`; not cached on shared state. Mutex-protected request boundaries (PR #25's per-user rotation mutex) extend naturally to scope-bound state.
- **Storage-root mixing:** all storage paths derive from `getConfigDirForScope(_scope)`. A typo in one submodule cannot cross-write into another tenant's data because there is exactly one path-resolution chokepoint.
- **Audit completeness:** v1 emits forgery + scope-mismatch only. Read-event audit is a future slice.
```

- [ ] **Step 2: Update ADR 0005**

Edit `docs/decision-records/audit-harness/0005-storage-tenancy-contract.md`. Find the "Out of scope" section and add at the top:
```markdown
> **Update 2026-05-10:** workspace-id forgery defense, scope leakage prevention, and audit logging of cross-scope access attempts are **implemented in ADR 0007 (single-user runtime; multi-tenant runtime opt-in via `ROX_MULTI_TENANT=1`)**. The remaining out-of-scope items below stand.
```

- [ ] **Step 3: Run a final-pass smoke**

```bash
cd packages/shared && bunx tsc --noEmit
cd packages/server-core && bunx tsc --noEmit
cd apps/electron && bunx tsc --noEmit
cd packages/server && bunx tsc --noEmit
bun test packages/shared 2>&1 | tail -3
bun test packages/server-core 2>&1 | tail -3
```
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md \
        docs/decision-records/audit-harness/0005-storage-tenancy-contract.md
git commit -m "docs(architecture): ADR 0007 multi-tenant storage isolation (C4)"
```

---

## Final verification

After Task 11:

```bash
# Sanity: are all files present?
ls packages/shared/src/config/storage-scope-auth.ts
ls packages/shared/src/config/storage-scope-runtime.ts
ls docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md

# Test counts
bun test packages/shared 2>&1 | tail -3
# Expected: prior baseline + ~12 new auth.test + ~6 runtime.test + ~4 internal-scope.test = +22 tests
bun test packages/server-core 2>&1 | tail -3
# Expected: prior baseline + 5 new workspace-scope.test = +5 tests

# Typecheck
cd packages/shared && bunx tsc --noEmit
cd packages/server-core && bunx tsc --noEmit
cd apps/electron && bunx tsc --noEmit
cd packages/server && bunx tsc --noEmit

# Audit emit smoke
ROX_MULTI_TENANT=0 LOG_LEVEL=trace bun test packages/server-core --grep "scope" 2>&1 | grep "scope.factory" | head -5
# Expected: at least one trace-level scope.factory.downgraded event
```

## Pushing the branch

```bash
git push -u origin feat/architecture-c4-multi-tenant-storage-isolation
gh pr create --base main --head feat/architecture-c4-multi-tenant-storage-isolation \
  --title "Slice C4: multi-tenant storage isolation (progressive)" \
  --body-file docs/superpowers/specs/2026-05-10-c4-multi-tenant-storage-isolation-design.md
```

## What this slice DOES NOT deliver

- Multi-tenant runtime in production traffic (operators must flip the env var)
- RBAC-populated `permittedWorkspaces` (slice 6)
- Per-tenant credential encryption keys
- Cross-process scope propagation (Pi-agent-server)
- Migration tools for existing data layouts
- Audit storage backend beyond structured-logger output
- Sibling-handler migration in `workspace.ts` (only the demo handler is wired)

These are correctly deferred per ADR 0007's "Out of scope" section. Each is a future slice on the deferred-list roadmap.
