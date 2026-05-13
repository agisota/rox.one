# Tenant Credential Key Derivation Design

## Status

In progress under ticket `T223-tenant-credential-key-derivation`.

## Goal

Add per-tenant cryptographic isolation to credential storage so workspace-scoped
credentials are encrypted with a key derived from both the existing machine
master key and the authenticated workspace id.

## Roadmap Numbering Note

The master roadmap labels this phase as `T216-tenant-credential-key-derivation`,
but `T216` is already used by `T216-pi-ipc-scope-propagation`. Phase 1.5 also
reserves `T217` through `T220`, Phase 1.6 reserves `T221`, and Phase 1 closeout
reserves `T222`. This work therefore uses `T223` to avoid duplicate ticket ids
while preserving the Phase 1.4 scope.

## Current State

`SecureStorageBackend` encrypts one credential store with AES-256-GCM. Its
current key is derived from stable machine identity with PBKDF2 and the file
header salt. Credential ids can include workspace ids for source and workspace
credentials, but the encrypted store key itself does not include tenant scope.

The storage tenancy layer already has branded workspace scopes and
`getConfigDirForScope()`. Credential storage has not consumed that scope yet.

## Design

### Scope-aware backend

`CredentialManager` accepts an optional `BrandedWorkspaceScope`. The default
manager remains `DEFAULT_LOCAL_SCOPE`, preserving existing callers. A scoped
manager creates a `SecureStorageBackend` bound to the same scope.

The backend resolves its credential file from the scoped config dir:

- `local-single-user` -> `<configDir>/credentials.enc`
- `workspace` with `ROX_MULTI_TENANT=1` -> `<configDir>/tenants/<workspaceId>/credentials.enc`
- `workspace` while multi-tenant is disabled -> the existing flat config dir
  through the storage runtime downgrade path

### Key derivation

The existing PBKDF2 machine key remains the master key. Local-single-user
credential stores use that master key unchanged.

Workspace credential stores derive a tenant key with:

```text
tenantKey = HKDF(masterKey, salt=workspaceId, info="rox.credentials.v1")
```

The HKDF info string is the KDF version and is stored in the encrypted store
metadata for future rotation.

### Migration behavior

When a workspace-scoped backend reads a credential:

1. Read from the tenant credential file with the tenant key.
2. If the tenant file has no matching credential, read the legacy flat
   credential file with the existing local key.

Writes always go to the tenant file when the scope resolves to a workspace.
This keeps existing single-user installs unchanged, keeps pre-existing
credentials readable after `ROX_MULTI_TENANT=1`, and ensures new tenant writes
do not share a decryptable credential file with other tenants.

Deletes under a tenant scope remove the tenant entry and also remove a matching
legacy flat entry so a deleted migrated credential does not reappear through
fallback.

### Audit

Tenant credential reads, writes, deletes, and legacy fallback reads emit
trace-level structured debug events. Events include the workspace id, operation,
credential type, and KDF version; they do not include credential values.

## Testing

- Add credential backend tests for tenant isolation, copied-file decrypt
  rejection, legacy fallback readability, local-single-user compatibility, KDF
  version metadata, and trace audit emission.
- Add manager tests proving `getCredentialManager(scope)` returns isolated
  managers for different workspace scopes.
- Re-run existing source credential and storage-scope tests to guard
  compatibility.

## Non-goals

- Do not build the Phase 1.6 bulk migration CLI.
- Do not change RBAC or permitted workspace population.
- Do not migrate every credential call site to a non-default scope in this
  phase; expose the scoped manager and update call sites that already receive a
  `BrandedWorkspaceScope`.
