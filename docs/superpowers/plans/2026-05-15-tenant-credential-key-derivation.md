# Tenant Credential Key Derivation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt workspace-scoped credential stores with tenant-derived keys while preserving existing local-single-user credentials.

**Architecture:** Add a scope-aware credential manager/backend. Keep the local master key unchanged, derive workspace keys with HKDF, store KDF metadata in the encrypted payload, and read legacy flat credentials as a fallback only when tenant reads miss.

**Tech Stack:** Bun tests, TypeScript, Node `crypto` AES-256-GCM/PBKDF2/HKDF, existing `BrandedWorkspaceScope` storage scope APIs.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/shared/src/credentials/backends/credential-kdf.ts` | Pure key-derivation helpers and KDF version constants. |
| `packages/shared/src/credentials/backends/secure-storage.ts` | Scope-aware credential file resolution, encrypted store metadata, tenant fallback reads, and trace audit events. |
| `packages/shared/src/credentials/manager.ts` | Scoped manager constructor and singleton lookup keyed by branded scope. |
| `packages/shared/src/credentials/index.ts` | Export scoped manager types/helpers needed by callers. |
| `packages/shared/src/config/storage-llm-connections.ts` | Use the scoped credential manager where a storage scope is already passed. |
| `packages/shared/src/config/storage-workspaces.ts` | Use scoped manager for workspace credential cleanup. |
| `packages/shared/src/credentials/__tests__/secure-storage-scope.test.ts` | Tenant KDF, legacy fallback, metadata, and audit tests. |
| `packages/shared/src/credentials/__tests__/manager-scope.test.ts` | Scoped manager isolation tests. |
| `docs/tickets/T223-tenant-credential-key-derivation.md` | Ticket acceptance criteria. |
| `docs/worklog/T223-tenant-credential-key-derivation.md` | Required 11-section worklog and validation evidence. |

## Tasks

### Task 1: Red credential backend tests

- [ ] Create `packages/shared/src/credentials/__tests__/secure-storage-scope.test.ts`.
- [ ] Add tests that set `ROX_CONFIG_DIR` and `HOME` to temp directories before dynamic imports.
- [ ] Cover tenant A writes not readable by tenant B, copied tenant A file rejected by tenant B key, local-single-user writes under the flat config dir, tenant reads falling back to legacy flat credentials, KDF version metadata, and trace audit events.
- [ ] Run:

```bash
bun test packages/shared/src/credentials/__tests__/secure-storage-scope.test.ts
```

Expected before implementation: fail because `SecureStorageBackend` is not scope-aware and has no KDF metadata.

### Task 2: Red scoped manager tests

- [ ] Create `packages/shared/src/credentials/__tests__/manager-scope.test.ts`.
- [ ] Cover `getCredentialManager(DEFAULT_LOCAL_SCOPE)` preserving the local singleton and different workspace scopes receiving isolated managers/backends.
- [ ] Run:

```bash
bun test packages/shared/src/credentials/__tests__/manager-scope.test.ts
```

Expected before implementation: fail because `getCredentialManager` accepts no scope.

### Task 3: Implement KDF helpers

- [ ] Create `packages/shared/src/credentials/backends/credential-kdf.ts`.
- [ ] Export `TENANT_CREDENTIAL_KDF_VERSION = "rox.credentials.v1"`.
- [ ] Export helpers that derive the existing machine master key with PBKDF2 and derive tenant keys with HKDF using workspace id as salt and the version string as info.
- [ ] Re-run the red tests and confirm remaining failures point at backend integration, not missing helper imports.

### Task 4: Make `SecureStorageBackend` scope-aware

- [ ] Add backend options for `scope`, optional test `configDir`, and optional test `machineId`.
- [ ] Resolve credential file paths through the branded scope and scoped config dir.
- [ ] Store encrypted metadata containing KDF version and scope kind.
- [ ] Use the local machine master key unchanged for `DEFAULT_LOCAL_SCOPE`.
- [ ] Use HKDF tenant keys for workspace scopes.
- [ ] Add tenant read fallback to the legacy flat store.
- [ ] Emit trace audit events for tenant read/write/delete/fallback operations.
- [ ] Run:

```bash
bun test packages/shared/src/credentials/__tests__/secure-storage-scope.test.ts
```

Expected after implementation: pass.

### Task 5: Wire scoped credential managers

- [ ] Update `CredentialManager` to accept a scope and pass it to `SecureStorageBackend`.
- [ ] Update `getCredentialManager(scope = DEFAULT_LOCAL_SCOPE)` to return the existing local singleton for local scope and stable scoped managers for workspace scopes.
- [ ] Update scoped storage call sites in `storage-llm-connections.ts` and `storage-workspaces.ts`.
- [ ] Run:

```bash
bun test packages/shared/src/credentials/__tests__/manager-scope.test.ts
```

Expected after implementation: pass.

### Task 6: Compatibility validation

- [ ] Run existing adjacent tests:

```bash
bun test packages/shared/src/sources/__tests__/credential-manager-expiry.test.ts packages/shared/src/sources/__tests__/credential-manager-integration.test.ts packages/shared/src/sources/__tests__/credential-manager-renew.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts
```

- [ ] Run roadmap targeted test command:

```bash
bun test packages/shared/src/credentials/__tests__/*
```

- [ ] Run package and repo gates:

```bash
cd packages/shared && bunx tsc --noEmit
bun run validate:docs
bun run validate:agent-contract
bun run typecheck
bun run lint
bun run build
bun test
```

### Task 7: Docs, commit, PR, and roadmap log

- [ ] Update the ticket and worklog with passing evidence.
- [ ] Commit with the Lore protocol and OmX coauthor trailer.
- [ ] Push and create a PR.
- [ ] Merge once GitHub reports no pending or failing checks.
- [ ] Append Phase 1.4 to `.swarm/master-roadmap-log.md` after the merge SHA is known.
