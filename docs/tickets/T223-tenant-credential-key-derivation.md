# T223 - Tenant credential key derivation

Status: DONE

## Resolution

The implementation already lives in
`packages/shared/src/credentials/backends/secure-storage.ts`:

- `TENANT_CREDENTIAL_KDF_VERSION = 1` and
  `TENANT_CREDENTIAL_KDF_INFO = Buffer.from('rox.credentials.v1')` constants.
- `getEncryptionKey(salt)` returns the local `masterKey` for `DEFAULT_LOCAL_SCOPE`,
  and for scoped backends derives a tenant-specific key via
  `hkdfSync('sha256', masterKey, Buffer.from(workspaceId), TENANT_CREDENTIAL_KDF_INFO, KEY_SIZE)`.
- `getCredentialsDir()` routes scoped backends to
  `<configDir>/tenants/<workspaceId>/credentials.enc`; flat single-user
  backends keep using `<configDir>/credentials.enc`.
- `loadStore()` tries the tenant key first; for `DEFAULT_LOCAL_SCOPE` only, it
  falls back to the v1 hostname-based legacy key and auto-migrates by re-saving
  under the v2 stable key. Tenant scopes intentionally skip the legacy fallback
  so copied or cross-tenant files cannot decrypt.
- `createEmptyStore` writes `version: 2`, `metadata.kdfVersion: 1`, and
  `metadata.workspaceId` for tenant backends; flat stores remain `version: 1`.
- `emitTenantAudit()` calls `appendStructuredAuditEvent('trace', ...)` with
  `{ workspaceId, event, credentialType, ...meta }` — no credential values
  appear in audit payloads.

Tests live at
`packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts`
and cover every Required Test from this ticket:

| Required Test | Test name |
| --- | --- |
| Tenant A credential store is not readable by tenant B | `does not decrypt another tenant credential file copied onto its path` |
| A tenant B backend cannot decrypt a copied tenant A credential file | same test (copyFileSync + null read) |
| Local single-user credential writes still use the flat config dir | `keeps DEFAULT_LOCAL_SCOPE credentials in the existing flat file` |
| Tenant reads can fall back to pre-existing flat credentials | `reads legacy flat credentials as fallback but writes new tenant credentials separately` |
| New tenant writes produce KDF version metadata | `stores tenant credentials with a KDF versioned envelope` |
| Tenant credential operations emit trace audit events without credential values | `emits trace audit events for tenant credential reads and writes` |
| Scoped credential managers are isolated by branded workspace scope | combined coverage across the suite |

Verification re-run (2026-05-17):
`bun test packages/shared/src/credentials/__tests__/ packages/shared/src/sources/__tests__/credential-manager-{expiry,integration,renew}.test.ts packages/shared/src/config/__tests__/storage-scope{-auth,,-runtime}.test.ts`
→ **68 pass / 0 fail / 117 expect() calls across 7 files**.

This ticket was left in `Status: InProgress` after the work landed because the
ticket file's acceptance-criteria checkboxes were never flipped. Closing now
with the verification re-run as evidence.

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

- [x] Local single-user installs keep the existing credential key behavior.
- [x] Workspace-scoped credential writes use HKDF tenant keys.
- [x] Credential store metadata includes `kdfVersion`.
- [x] Tenant A cannot decrypt tenant B's credential store.
- [x] Legacy flat credentials remain readable after enabling multi-tenant mode.
- [x] Tenant credential read/write/delete operations emit trace-level audit events.
- [x] Targeted credential tests pass.
- [x] Full validation passes or precise blockers are documented.

## Worklog

Update `docs/worklog/T223-tenant-credential-key-derivation.md`.
