# T223 - Tenant credential key derivation

## Status

In progress.

## Roadmap Alignment

Phase 1.4 of the master roadmap names this ticket as
`T216-tenant-credential-key-derivation`, but `T216` is already used by
`T216-pi-ipc-scope-propagation`. Phase 1.5 also reserves `T217` through
`T220`, Phase 1.6 reserves `T221`, and Phase 1 closeout reserves `T222`.
This task uses `T223` to avoid duplicate ticket ids while preserving the Phase
1.4 requirements.

## Summary

Add tenant-aware credential encryption so workspace-scoped credential stores use
HKDF-derived keys based on the authenticated workspace id while existing
single-user credentials continue using the current machine-derived key.

## Scope

- Define `tenantKey = HKDF(masterKey, salt=workspaceId, info="rox.credentials.v1")`.
- Keep `local-single-user` credential encryption unchanged.
- Store a KDF version field in the encrypted credential store metadata.
- Route workspace credential files through the scoped config dir.
- Keep existing flat credentials readable when `ROX_MULTI_TENANT=1` is enabled.
- Ensure new workspace writes use tenant keys.
- Emit trace-level audit events for credential read/write/delete under tenant scope.

## Out of Scope

- Bulk migration CLI from flat credentials to tenant-prefixed credentials.
- RBAC policy or permitted workspace population.
- Queryable persistent audit storage.
- Rewriting every credential call site that does not yet receive a branded scope.

## Required Tests

- Tenant A credential store is not readable by tenant B.
- A tenant B backend cannot decrypt a copied tenant A credential file.
- Local single-user credential writes still use the flat config dir.
- Tenant reads can fall back to pre-existing flat credentials.
- New tenant writes produce KDF version metadata.
- Tenant credential operations emit trace audit events without credential values.
- Scoped credential managers are isolated by branded workspace scope.

## Validation Commands

- `bun test packages/shared/src/credentials/__tests__/*`
- `bun test packages/shared/src/sources/__tests__/credential-manager-expiry.test.ts packages/shared/src/sources/__tests__/credential-manager-integration.test.ts packages/shared/src/sources/__tests__/credential-manager-renew.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts`
- `cd packages/shared && bunx tsc --noEmit`
- `bun run validate:docs`
- `bun run validate:agent-contract`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `bun test`

## Acceptance Criteria

- [ ] Local single-user installs keep the existing credential key behavior.
- [ ] Workspace-scoped credential writes use HKDF tenant keys.
- [ ] Credential store metadata includes `kdfVersion`.
- [ ] Tenant A cannot decrypt tenant B's credential store.
- [ ] Legacy flat credentials remain readable after enabling multi-tenant mode.
- [ ] Tenant credential read/write/delete operations emit trace-level audit events.
- [ ] Targeted credential tests pass.
- [ ] Full validation passes or precise blockers are documented.

## Worklog

Update `docs/worklog/T223-tenant-credential-key-derivation.md`.
