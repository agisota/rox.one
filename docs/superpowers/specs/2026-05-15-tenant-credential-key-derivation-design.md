# Tenant Credential Key Derivation Design

- **Status:** implemented
- **Date:** 2026-05-15
- **Extends:** ADR 0007 multi-tenant storage isolation
- **Roadmap phase:** 1.4, ticket `T217`

## Goal

Close the C.4 credential encryption gap by giving workspace-scoped credential
stores tenant-specific encryption keys while preserving the existing flat
single-user credential file and existing flat key derivation.

## Non-goals

- Do not change default single-user credential layout or encryption behavior.
- Do not serialize `BrandedWorkspaceScope`.
- Do not implement Phase 2 RBAC policy.
- Do not migrate every credential caller to tenant scope in this slice.
- Do not add a production dependency.
- Do not rewrite or bulk-migrate existing flat credentials.

## Locked Decisions

1. **Scope stays branded and process-local.** `CredentialManager` and
   `SecureStorageBackend` may accept `BrandedWorkspaceScope`, but callers still
   obtain it only from `DEFAULT_LOCAL_SCOPE` or `deriveScopeFromAuth()`.
2. **Single-user stays flat.** `DEFAULT_LOCAL_SCOPE` writes
   `<configDir>/credentials.enc`, which remains `~/.rox/credentials.enc` for
   normal installs. The current PBKDF2 key and legacy fallback remain unchanged.
3. **Tenant files live under the C.4 tenant root.** In
   `ROX_MULTI_TENANT=1`, workspace-scoped managers write
   `<configDir>/tenants/<workspaceId>/credentials.enc`.
4. **Tenant key derives from the existing master key.** The existing PBKDF2
   output is the master key. Tenant encryption uses
   `HKDF-SHA256(masterKey, salt=workspaceId, info="rox.credentials.v1")`.
5. **Tenant stores are versioned.** New tenant payloads write
   `version: 2` plus `metadata.kdfVersion: 1` and `metadata.workspaceId` so
   future rotation can distinguish the tenant KDF envelope.
6. **Existing credentials remain readable.** A tenant-scoped manager first
   reads the tenant file, then falls back to the flat local backend when the
   tenant file does not contain the credential. Writes go only to the tenant
   backend.
7. **Audit is trace-level.** Tenant credential read/write/delete/list
   operations emit structured debug events without credential values.

## Data Flow

```text
deriveScopeFromAuth(session, requestedWorkspaceId)
  -> CredentialManager(scope)
  -> SecureStorageBackend(scope)
  -> resolve credentials.enc path
  -> derive local PBKDF2 master key
  -> derive tenant HKDF key when scope is kind:workspace and ROX_MULTI_TENANT=1
  -> AES-256-GCM read/write
```

## Store Formats

Local flat credentials keep the existing payload shape:

```ts
interface LocalCredentialStore {
  version: 1;
  credentials: Record<string, StoredCredential>;
  metadata: { createdAt: number; updatedAt: number };
}
```

Tenant credentials use the additive versioned envelope:

```ts
interface TenantCredentialStore {
  version: 2;
  credentials: Record<string, StoredCredential>;
  metadata: {
    createdAt: number;
    updatedAt: number;
    kdfVersion: 1;
    workspaceId: string;
  };
}
```

The binary header and AES-GCM frame stay compatible with the existing
`CRAFT01\0` file format. The new version is inside the encrypted JSON payload,
not a new cleartext header.

## Security Properties

- Copying tenant A's encrypted `credentials.enc` onto tenant B's path does not
  decrypt because tenant B derives a different HKDF key from its workspace id.
- A tenant-scoped write cannot overwrite the flat credential file.
- Existing flat credentials are readable only through the fallback backend and
  are not silently copied into a tenant file.
- Credential audit events include operation, workspace id, and credential type,
  but never include credential values or tokens.

## Compatibility

- Existing `getCredentialManager()` callers continue to receive the local flat
  singleton.
- New tenant-aware callers use `new CredentialManager(scope)` or
  `getCredentialManager(scope)` after scope derivation.
- `ROX_MULTI_TENANT` remains the runtime gate. A workspace scope used while the
  gate is inactive resolves to the flat local credential file and local key.

## Testing

- Unit: `DEFAULT_LOCAL_SCOPE` writes only `<configDir>/credentials.enc`.
- Unit: tenant manager reads flat fallback, then writes and prefers tenant file.
- Unit: tenant store writes `version: 2` and KDF metadata.
- Security: tenant B cannot decrypt a copied tenant A credential file.
- Audit: tenant read and write emit trace events.
- Regression: root typecheck, lint, full test suite, and build stay green.
