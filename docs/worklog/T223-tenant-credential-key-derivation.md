# T223 - Tenant credential key derivation

## 1. Task summary

Add per-tenant credential key derivation for Phase 1.4 of the master roadmap.
Workspace-scoped credential stores must use HKDF-derived keys keyed by
workspace id, while local-single-user credential behavior remains unchanged.

## 2. Repo context discovered

- `SecureStorageBackend` currently derives one AES-256-GCM key from machine
  identity and file salt, then stores all credentials in one encrypted JSON
  payload.
- Credential ids can include workspace ids, connection slugs, source ids, and
  names, but the encryption key itself is not tenant-scoped.
- There was no `packages/shared/src/credentials/__tests__` directory before
  this task. The roadmap credential test command found no files.
- Storage scope branding and tenant config-dir routing already exist in
  `storage-scope-auth.ts`, `storage-scope-runtime.ts`, and
  `storage-internal.ts`.
- Phase 1.4 is labeled `T216` in the roadmap, but `T216` is already used by the
  merged Pi IPC scope propagation ticket. This task uses `T223` to avoid
  colliding with `T217`-`T222`, which the roadmap reserves for later Phase 1
  tickets.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
- `.swarm/master-roadmap-log.md`
- `docs/decision-records/audit-harness/0005-storage-tenancy-contract.md`
- `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
- `packages/shared/src/credentials/backends/secure-storage.ts`
- `packages/shared/src/credentials/backends/types.ts`
- `packages/shared/src/credentials/backends/env.ts`
- `packages/shared/src/credentials/manager.ts`
- `packages/shared/src/credentials/types.ts`
- `packages/shared/src/credentials/index.ts`
- `packages/shared/src/config/storage-scope.ts`
- `packages/shared/src/config/storage-scope-auth.ts`
- `packages/shared/src/config/storage-scope-runtime.ts`
- `packages/shared/src/config/storage-internal.ts`
- `packages/shared/src/config/storage-llm-connections.ts`
- `packages/shared/src/config/storage-workspaces.ts`
- `packages/shared/src/sources/credential-manager.ts`
- `packages/shared/src/sources/__tests__/credential-manager-expiry.test.ts`
- `packages/shared/src/sources/__tests__/credential-manager-integration.test.ts`
- `packages/shared/src/sources/__tests__/credential-manager-renew.test.ts`

## 4. Tests added first

Pending.

Planned tests:

- `packages/shared/src/credentials/__tests__/secure-storage-scope.test.ts`
- `packages/shared/src/credentials/__tests__/manager-scope.test.ts`

## 5. Expected failing test output

Baseline command from the roadmap before adding tests:

```text
bun test packages/shared/src/credentials/__tests__/*
The following filters did not match any test files:
 packages/shared/src/credentials/__tests__/*
```

Red test output will be recorded after adding the credential tests and before
production implementation.

## 6. Implementation changes

Pending.

## 7. Validation commands run

Baseline adjacent tests:

```bash
bun test packages/shared/src/sources/__tests__/credential-manager-expiry.test.ts packages/shared/src/sources/__tests__/credential-manager-integration.test.ts packages/shared/src/sources/__tests__/credential-manager-renew.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts
```

## 8. Passing test output summary

Baseline adjacent tests:

```text
62 pass
0 fail
99 expect() calls
Ran 62 tests across 6 files.
```

## 9. Build output summary

Pending.

## 10. Remaining risks

- Legacy flat credential fallback necessarily treats pre-tenancy credentials as
  shared local credentials until a future migration copies or rewrites them into
  tenant stores.
- Call sites that do not yet receive a `BrandedWorkspaceScope` continue to use
  the local credential manager. This task exposes scoped managers and updates
  scoped storage call sites; later auth/RBAC phases can migrate additional
  request-specific callers.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Local single-user installs keep existing credential key behavior | Pending | Planned local flat-store test |
| Workspace-scoped credential writes use HKDF tenant keys | Pending | Planned tenant write/decrypt test |
| Credential store metadata includes `kdfVersion` | Pending | Planned metadata test |
| Tenant A cannot decrypt tenant B credential store | Pending | Planned copied-file decrypt rejection test |
| Legacy flat credentials remain readable after enabling multi-tenant mode | Pending | Planned legacy fallback test |
| Tenant credential operations emit trace audit events | Pending | Planned stderr capture test |
| Targeted credential tests pass | Pending | Not run after implementation yet |
| Full validation passes or blockers are documented | Pending | Not run yet |
