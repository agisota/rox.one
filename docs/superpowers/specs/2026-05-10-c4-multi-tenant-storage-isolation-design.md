# C4 — Multi-tenant storage isolation (progressive)

- **Status:** brainstormed (this document); ready for implementation plan
- **Date:** 2026-05-10
- **Supersedes / extends:** ADR 0002 (storage decomposition), ADR 0005 (storage tenancy contract — reserved the slot)
- **Successor ADR after implementation:** `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
- **Slice:** C4 from the architecture-roadmap deferred list

## Goal

Implement the `kind: 'workspace'` arm of `WorkspaceScope` (reserved by ADR 0005) progressively: ship the type surface, auth factory, path resolver, runtime mode, audit signals, and one wired-up demo caller end-to-end. Single-user runtime is the default; multi-tenant runtime is opt-in via `ROX_MULTI_TENANT=1`.

## Six locked decisions (from brainstorming)

1. **Trust boundary: progressive.** Type surface designed for multi-tenant SaaS; runtime defaults to permissive single-user. Same code paths.
2. **Tenant data model: tenant ≡ workspace.** Flat extension of ADR 0005's `WorkspaceScope`. No org/tenant-slug layer.
3. **Storage layout: path-prefix isolation.** `local-single-user` resolves to existing flat `<configDir>/...`; `workspace` resolves to `<configDir>/tenants/<workspaceId>/...`. One chokepoint: `getConfigDirForScope` in `storage-internal.ts`.
4. **Forgery defense: branded type + factory at auth boundary.** A private `Symbol` brands `WorkspaceScope`; only `deriveScopeFromAuth` and the `DEFAULT_LOCAL_SCOPE` constant produce branded values. Storage submodule signatures accept `BrandedWorkspaceScope` only.
5. **Credential scoping: same path-prefix substrate, no per-tenant encryption (v1).** `credentials/manager.ts` gets isolation for free via `getConfigDirForScope`; per-tenant key derivation deferred.
6. **Audit logging: forgery + scope-mismatch only, via existing structured logger.** No new audit storage substrate.

## Architecture

Three concentric rings with one wire-through:

- **Auth ring:** `deriveScopeFromAuth(session, requestedWorkspaceId)` is the only producer of `kind: 'workspace'` scopes. In single-user runtime, always returns `DEFAULT_LOCAL_SCOPE`. In multi-tenant runtime, validates `requestedWorkspaceId ∈ session.permittedWorkspaces`; rejects forgery; emits audit.
- **Type ring:** `WorkspaceScope` becomes nominally typed via a private brand symbol. Unbranded `{ kind: '...', ... }` literals stop compiling at storage submodule call sites.
- **Runtime ring:** `getConfigDirForScope(scope)` in `storage-internal.ts` resolves the on-disk path. Gated by `isMultiTenantActivated()` reading `ROX_MULTI_TENANT`. Without the env var, the workspace arm gracefully downgrades to flat (defense in depth — single-user data layout never accidentally splits).
- **Demo caller:** ONE webui handler (`packages/server-core/src/handlers/rpc/workspace.ts`'s `getWorkspaces` or equivalent) wires `deriveScopeFromAuth(ctx.session, ctx.workspaceId)` end-to-end. Other handlers in this slice keep `DEFAULT_LOCAL_SCOPE` with `// TODO(C4): use deriveScopeFromAuth` markers.

### Five invariants

1. **Compile-time forgery defense.** Brand makes unbranded literals not assignable to storage submodule parameters.
2. **Single-user data layout unchanged.** `DEFAULT_LOCAL_SCOPE` resolves to the existing flat path; zero filesystem migration.
3. **Multi-tenant runtime is opt-in.** Without `ROX_MULTI_TENANT=1`, the workspace arm downgrades to flat.
4. **Audit signals are always-on** (single-user mode emits trace-level downgrade events; multi-tenant emits warn/error).
5. **Auth factory is the only producer of `kind: 'workspace'`** — enforced via a private brand symbol that lives entirely inside `storage-scope-auth.ts` (the symbol and `brand()` applier are not exported, so external code cannot mint branded scopes; `DEFAULT_LOCAL_SCOPE` and `deriveScopeFromAuth` are the only escape paths).

## Components

### New files (3)

- `packages/shared/src/config/storage-scope-auth.ts` — owns the brand symbol AND `DEFAULT_LOCAL_SCOPE`. Exports: `BrandedWorkspaceScope` type, `DEFAULT_LOCAL_SCOPE` constant, `deriveScopeFromAuth` factory, `MultiTenantForgeryError`. The brand `Symbol` and its `brand()` applier are private to this module. ~150 LOC.
- `packages/shared/src/config/storage-scope-runtime.ts` — `isMultiTenantActivated()` reading `ROX_MULTI_TENANT`, memoized at process start. Plus `__setMultiTenantForTests()` escape hatch. ~40 LOC.
- `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md` — new ADR. ~150 LOC.

### Modified files

- `packages/shared/src/config/storage-scope.ts` — keeps the unbranded `WorkspaceScope` discriminated-union type. The brand and `DEFAULT_LOCAL_SCOPE` move to `storage-scope-auth.ts` (single owner of brand minting). The barrel `packages/shared/src/config/storage.ts` continues to re-export `DEFAULT_LOCAL_SCOPE` and `WorkspaceScope` (and now `BrandedWorkspaceScope`) so existing callers' barrel imports don't change.
- `packages/shared/src/config/storage-internal.ts` — add `getConfigDirForScope(scope: BrandedWorkspaceScope): string`. Resolves `local-single-user` → `getConfigDir()`; `workspace` → `<configDir>/tenants/<workspaceId>` if `isMultiTenantActivated()`, else falls back to flat with a trace-level "scope-downgraded" log. Includes a runtime brand-check that throws `BrandedScopeBreachError` if a scope arrives without the brand symbol (defense in depth).
- The 8 storage submodules (`storage-{io,settings,workspaces,conversations,drafts,themes,llm-connections,tool-icons}.ts`) — change public function parameters from `WorkspaceScope` to `BrandedWorkspaceScope`. Replace internal `getConfigDir()` calls with `getConfigDirForScope(scope)`.
- `packages/server-core/src/handlers/rpc/workspace.ts` — wire `deriveScopeFromAuth(ctx.session, ctx.workspaceId)` in ONE chosen handler. Other handlers in this file get `// TODO(C4): use deriveScopeFromAuth when ready` comments.
- `docs/decision-records/audit-harness/0005-storage-tenancy-contract.md` — update "Out of scope" section to mark workspace-id forgery defense, scope leakage prevention, and audit logging as "implemented in ADR 0007 (single-user runtime; multi-tenant runtime opt-in via env var)".

### Caller migration (extends slice scope per option (a))

The brand will type-error at the ~30 unmigrated callers PR #29 left behind. They get fixed in this slice as mechanical caller-pass commits, grouped by area:

- `packages/shared/{agent,auth,credentials,config/{watcher,validators,proxy-env,preferences},workspaces/storage}.ts` — internal callers of storage submodules
- `apps/electron/src/main/{index,onboarding,power-manager,network-proxy,browser-pane-manager,auto-update}.ts` — electron main-process callers
- `packages/server/src/index.ts` and `packages/server-core/src/webui/http-server.ts` — bootstrap/server callers

All migrated to pass `DEFAULT_LOCAL_SCOPE` explicitly (these are headless/no-session paths). After this slice, the `_scope = DEFAULT_LOCAL_SCOPE` default in submodule signatures CAN be removed in a follow-up commit, but is left in for one more slice as belt-and-suspenders.

### Test files (3 new + 1 spot-edit)

- `packages/shared/src/config/__tests__/storage-scope-auth.test.ts` — factory tests: forgery rejection, single-user-mode always-downgrade, audit emit on rejection, branded-symbol non-leakage attempts.
- `packages/shared/src/config/__tests__/storage-scope-runtime.test.ts` — env-var memoization, `__setMultiTenantForTests` override, runtime mode toggle.
- `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts` — integration: demo caller returns 403 on forgery; passes through `DEFAULT_LOCAL_SCOPE` in single-user runtime; passes branded workspace scope when multi-tenant activated + permitted.
- Existing `packages/shared/src/config/__tests__/storage-scope.test.ts` (from PR #18) — extend with: brand symbol can't be constructed externally; `DEFAULT_LOCAL_SCOPE` satisfies `BrandedWorkspaceScope`; runtime cast `{} as BrandedWorkspaceScope` reaches storage and emits a defense-in-depth log.

### Out of scope for C4 (deferred to follow-up slices)

- `apps/electron/src/main/handlers/*` — these stay as `DEFAULT_LOCAL_SCOPE` permanently (headless, no session).
- Pi-agent-server IPC scope propagation — subprocess sees `local-single-user` always.
- `credentials/manager.ts` per-tenant key derivation — only path-prefix isolation in v1.
- RBAC integration that populates `session.permittedWorkspaces` — that's slice 6.
- Multi-tenant data migration tools (existing flat → tenant-prefixed) — needed only when an operator first flips `ROX_MULTI_TENANT=1` on data they want to keep; that's a separate slice with its own design.
- Audit-event storage backend — current decision uses existing structured logger; a queryable audit store (search/retention/tamper-resistance) is a future slice if/when SaaS deployments need it.

## Data flow

### Scenario 1 — Single-user runtime (default)

```
HTTP: GET /api/workspaces/W42/sessions
  → webui auth middleware (PR #19's CAS path) → ctx.session
  → workspace.ts handler:
      const scope = deriveScopeFromAuth(ctx.session, "W42");
  → storage-scope-auth:
      isMultiTenantActivated() → false
      trace-log "scope.factory.downgraded"
      return DEFAULT_LOCAL_SCOPE
  → storage submodule: getWorkspaces(scope)
  → storage-internal.getConfigDirForScope:
      kind === 'local-single-user' → getConfigDir()
  → filesystem: <configDir>/workspaces.json   (existing layout)
```

Net: zero behavior change vs PR #18+#29. One trace-level log per request hitting the demo caller.

### Scenario 2 — Multi-tenant runtime (`ROX_MULTI_TENANT=1`)

```
HTTP: GET /api/workspaces/W42/sessions
  → webui auth middleware → ctx.session
                            session.permittedWorkspaces = ["W42","W17","W99"]
  → workspace.ts handler:
      const scope = deriveScopeFromAuth(ctx.session, "W42");
  → storage-scope-auth:
      isMultiTenantActivated() → true
      "W42" ∈ session.permittedWorkspaces → ALLOWED
      return brand({ kind: 'workspace', workspaceId: 'W42' })
  → storage submodule: getWorkspaces(scope)
  → storage-internal.getConfigDirForScope:
      kind === 'workspace' AND isMultiTenantActivated()
      → path.join(getConfigDir(), 'tenants', 'W42')
  → filesystem: <configDir>/tenants/W42/workspaces.json
```

### Forgery alternate path (multi-tenant runtime, attacker)

```
requestedWorkspaceId = "W_OTHER"   (not in session.permittedWorkspaces)
  → storage-scope-auth:
      "W_OTHER" ∉ permittedWorkspaces → REJECT
      structured-log warn "scope.factory.forgery_rejected"
        { userId, requestedWorkspaceId: "W_OTHER",
          permittedCount: 3, reqId }
      throw new MultiTenantForgeryError(...)
  → handler error boundary → 403 Forbidden
```

### Audit event taxonomy

| Event | Fired when | Severity | Payload |
|---|---|---|---|
| `scope.factory.downgraded` | Single-user runtime, request had a non-null `requestedWorkspaceId` | trace | `{ userId, requestedWorkspaceId, reason: 'multi-tenant-not-activated' }` |
| `scope.factory.forgery_rejected` | Multi-tenant runtime, `requestedWorkspaceId` ∉ `session.permittedWorkspaces` | warn | `{ userId, requestedWorkspaceId, permittedCount, reqId }` |
| `scope.brand.cast_breach` | Defense-in-depth. Scope reached storage without the brand symbol (only possible via `as BrandedWorkspaceScope` unsafe cast) | error | `{ caller: stackFrame[0], scopeShape }` |

Notably absent: per-read audit. Forgery + scope-mismatch only is the v1 contract. The seam (`getConfigDirForScope`) is in place if a future slice wants to add per-op audit.

## Error handling

Three custom errors, exported from `storage-scope-auth.ts` and `storage-internal.ts`:

| Error | Where thrown | Severity | HTTP mapping |
|---|---|---|---|
| `MultiTenantForgeryError` | `deriveScopeFromAuth` when `requestedWorkspaceId ∉ session.permittedWorkspaces` (multi-tenant runtime) | warn (audit) | **403 Forbidden** at webui error boundary |
| `MultiTenantNotActivatedError` | `getConfigDirForScope` if a `kind:'workspace'` scope reaches it but `isMultiTenantActivated()` is false. Should not normally fire — the factory downgrades in single-user runtime. Defense-in-depth signal only. | error (audit) | **500 Internal** (operator misconfig) |
| `BrandedScopeBreachError` | `getConfigDirForScope` runtime brand check, when a scope-shaped object arrives without the brand symbol (only possible via `as BrandedWorkspaceScope`) | error (audit) | **500 Internal** |

Caught at the webui error boundary in `http-server.ts`. Renderer/electron callers receive the error as-is (they don't have a webui error boundary; the existing electron error handling applies).

## Testing

### Unit tests (~15 across 3 new files)

`storage-scope-auth.test.ts`:
- `DEFAULT_LOCAL_SCOPE` is branded
- Factory single-user-mode: returns `DEFAULT_LOCAL_SCOPE` regardless of `requestedWorkspaceId`
- Factory single-user-mode emits trace-level `scope.factory.downgraded` log
- Factory multi-tenant + permitted workspace: returns branded `kind:'workspace'`
- Factory multi-tenant + un-permitted: throws `MultiTenantForgeryError` + emits `scope.factory.forgery_rejected`
- Factory multi-tenant + null/empty `requestedWorkspaceId`: returns `DEFAULT_LOCAL_SCOPE`
- Brand symbol is not exported / cannot be imported

`storage-scope-runtime.test.ts`:
- `isMultiTenantActivated()` returns false when env unset
- Returns true for `ROX_MULTI_TENANT=1`
- Returns false for `ROX_MULTI_TENANT=0`, `ROX_MULTI_TENANT=true`, `ROX_MULTI_TENANT=` (only literal "1" activates)
- Memoized: changing the env after first read has no effect (caller must restart process)
- `__setMultiTenantForTests()` overrides for tests; reset on test teardown

Existing `storage-scope.test.ts` extension:
- Brand symbol can't be constructed externally (compile-time check via `// @ts-expect-error`)
- `DEFAULT_LOCAL_SCOPE` satisfies `BrandedWorkspaceScope` (assignment compiles)
- Unsafe cast `{} as BrandedWorkspaceScope` reaches storage layer and triggers `BrandedScopeBreachError` + `scope.brand.cast_breach` audit log

### Integration test (1 new)

`workspace-scope.test.ts`:
- Demo caller in single-user runtime: returns flat data, emits trace-level downgrade
- Demo caller in multi-tenant runtime + permitted: returns tenant-prefixed data
- Demo caller in multi-tenant runtime + forgery attempt: returns 403, emits warn-level forgery_rejected
- Existing single-user data is reachable after this slice lands (no migration needed)

### Backward-compat smoke

After all migrations: `bun test packages/shared` and `bun test packages/server-core` baselines preserved (or improved per ongoing baseline progress). No `.skip` / `.only` / `xit` introduced.

## Migration strategy

This slice is **type-driven and behavior-preserving** for single-user installations. The build stays green at every commit:

1. **Foundation commit** (one): introduce `storage-scope-auth.ts` (brand symbol, `BrandedWorkspaceScope`, `DEFAULT_LOCAL_SCOPE` moved here, `deriveScopeFromAuth` factory, errors), `storage-scope-runtime.ts`, and the updated `storage-internal.ts` with `getConfigDirForScope` and the runtime brand-check. Update the 8 storage submodule signatures from `WorkspaceScope` to `BrandedWorkspaceScope`. Update `storage.ts` barrel re-exports. After this commit: build breaks at every unbranded caller (this is the desired migration signal). Tests for the new files land in this same commit so package-level test runs stay green where applicable.
2. **Caller-fix commits** (one per area): pass `DEFAULT_LOCAL_SCOPE` explicitly at every error site. Areas split as in PR #29 (sessions, rpc handlers, model-fetchers, electron handlers) plus the ~30 new sites this slice surfaces (`shared/{agent,auth,credentials,config/{watcher,validators,proxy-env,preferences},workspaces/storage}`, `apps/electron/src/main/{index,onboarding,power-manager,network-proxy,browser-pane-manager,auto-update}`, `packages/server/src/index.ts`, `packages/server-core/src/webui/http-server.ts`). Each commit verifies typecheck + tests green.
3. **Demo caller commit**: wire `deriveScopeFromAuth` into one chosen handler in `packages/server-core/src/handlers/rpc/workspace.ts`; mark sibling handlers with `// TODO(C4)`.
4. **Integration test commit**: add `workspace-scope.test.ts` covering both runtime modes via `__setMultiTenantForTests`.
5. **ADR commit**: ADR 0007 lands; ADR 0005 update lands in the same commit for atomicity.

Existing single-user installations:
- See zero filesystem changes.
- See no observable behavior change beyond one trace-level log per request hitting the demo caller (filtered out by default; engineers opt in to see it).

Operators flipping `ROX_MULTI_TENANT=1`:
- Must populate `session.permittedWorkspaces` themselves (not C4's job — slice 6 RBAC).
- Need an existing-data migration tool (out of scope; follow-up slice).
- Should expect the warn-level forgery_rejected events to be alertable.

## Acceptance criteria

- All 8 storage submodule signatures use `BrandedWorkspaceScope`.
- `deriveScopeFromAuth` is the only producer of `kind:'workspace'` scopes (verified by audit on the brand symbol's exports).
- `getConfigDirForScope` resolves `local-single-user` → flat (verified by snapshot test against current layout).
- `getConfigDirForScope` resolves `workspace` → tenant-prefixed if `isMultiTenantActivated()`, else falls back to flat (verified by both runtime modes via `__setMultiTenantForTests`).
- One demo caller (`workspace.ts`) wires `deriveScopeFromAuth` end-to-end.
- All ~30 PR #29-deferred callers migrate to pass `DEFAULT_LOCAL_SCOPE` explicitly.
- ADR 0007 lands documenting the contract; ADR 0005 updated to point to 0007.
- Existing tests stay green; ~15 new unit tests + 1 integration test land green.

## Open questions for implementation plan

- The `session.permittedWorkspaces` field — does it already exist on `AccountSession` (slice 4 hardening) or does C4 need to add the field? If add, what populates it in single-user mode (empty array)?  *Action: implementation plan investigates and decides.*
- The `__setMultiTenantForTests` escape hatch — global mutable or per-test fixture? Bun test isolation suggests per-test fixture is safer. *Action: implementation plan picks based on existing test patterns in the repo.*
- Demo caller choice: `getWorkspaces` (read-only, simplest) vs `getWorkspaceByNameOrId` (more representative of real auth-derived scope). *Action: implementation plan picks; lean read-only unless there's a strong reason otherwise.*

These are tactical, not design questions.
