# PRD: C4 Multi-Tenant Storage Isolation

## Objective

Implement the `kind: 'workspace'` arm of `WorkspaceScope` progressively while preserving the current single-user storage layout and making multi-tenant storage opt-in via `ROX_MULTI_TENANT=1`.

## Scope

- Runtime mode detector for `ROX_MULTI_TENANT`.
- Private branded scope type and auth-derived scope factory.
- Storage root resolver that maps branded scopes to flat or tenant-prefixed paths.
- Storage submodule signatures narrowed to branded scopes.
- Mechanical caller migration to `DEFAULT_LOCAL_SCOPE`.
- One RPC workspace demo caller wired through `deriveScopeFromAuth`.
- ADR 0007 plus ADR 0005 update.

## Non-Goals

- Electron main handler migration under `apps/electron/src/main/handlers/*`.
- Pi-agent-server IPC scope propagation.
- Per-tenant credential key derivation.
- RBAC slice 6.
- Data migration tooling.
- Audit-event storage backend.

## Success Criteria

- Single-user `DEFAULT_LOCAL_SCOPE` resolves to the existing flat config directory.
- Workspace scopes downgrade to flat unless `ROX_MULTI_TENANT=1`.
- Multi-tenant permitted workspace scopes resolve to `<configDir>/tenants/<workspaceId>`.
- Forged workspace access is rejected by `deriveScopeFromAuth` and audited.
- Unsafe unbranded casts reaching storage fail at runtime and are audited.
- Unbranded scope literals fail to typecheck at storage submodule call sites.
- One workspace RPC handler uses `deriveScopeFromAuth(ctx.session, ctx.workspaceId)`.

## Execution Lane

Autopilot phase `ralplan` is satisfied by this PRD plus `test-spec-c4-multi-tenant-storage-isolation.md`, both derived from the merged design/plan. Phase `ralph` implements by ticket and commits each logical slice. Phase `code-review` reviews the final diff and either approves or returns findings to planning.
