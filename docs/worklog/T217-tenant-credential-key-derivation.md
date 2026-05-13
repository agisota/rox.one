# T217 - Tenant credential key derivation

## 1. Task summary

Add tenant-specific credential key derivation and tenant credential storage
while preserving the existing flat single-user credential file.

## 2. Repo context discovered

- `T216` is already landed as `T216-pi-ipc-scope-propagation`, so Phase 1.4
  must use the next free ticket number, `T217`.
- `CredentialManager` currently creates exactly one backend:
  `new SecureStorageBackend()`.
- `SecureStorageBackend` currently stores credentials in
  `<configDir>/credentials.enc` for normal installs because `<configDir>` is
  `~/.rox`, but it has no tenant-aware path or tenant-aware KDF.
- Current encryption uses AES-256-GCM with a `ROX01\0` header and PBKDF2 key
  derived from a stable machine id plus `rox-agent-v2`.
- A legacy PBKDF2 key using hostname, username, homedir, and `rox-agent-v1`
  remains as flat single-user migration fallback.
- ADR 0007 explicitly deferred per-tenant credential key derivation from C4.

## 3. Files inspected

- `AGENTS.md`
- `.swarm/master-roadmap-log.md`
- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/decision-records/audit-harness/0005-storage-tenancy-contract.md`
- `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
- `docs/superpowers/specs/2026-05-10-c4-multi-tenant-storage-isolation-design.md`
- `packages/shared/src/credentials/manager.ts`
- `packages/shared/src/credentials/backends/secure-storage.ts`
- `packages/shared/src/credentials/backends/types.ts`
- `packages/shared/src/credentials/types.ts`
- `packages/shared/src/config/storage-scope-auth.ts`
- `packages/shared/src/config/storage-scope-runtime.ts`
- `packages/shared/src/config/storage-internal.ts`
- `packages/shared/src/config/paths.ts`

## 4. Tests added first

- Added
  `packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts`.
  It covers flat compatibility, tenant fallback reads, tenant-only writes,
  tenant KDF metadata, copied-file decrypt rejection, and trace audit events.

## 5. Expected failing test output

Initial red run before implementation:

```text
bun test packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts
0 pass
5 fail
8 expect() calls
```

Representative failures:

- `DEFAULT_LOCAL_SCOPE` did not write under the test `ROX_CONFIG_DIR`
  because `SecureStorageBackend` still used the hard-coded homedir path.
- Tenant manager writes did not create
  `<configDir>/tenants/<workspaceId>/credentials.enc`.
- Tenant store payload still reported `version: 1` with no KDF metadata.
- Cross-tenant copied-file test could not find the tenant A file.
- Audit output lacked `credential.scope.write` and `credential.scope.read`.

## 6. Implementation changes

- Updated the roadmap reservations after the landed `T216` Pi IPC ticket:
  Phase 1.4 is now `T217`, Phase 1.5 is `T218`-`T221`, Phase 1.6 is `T222`,
  Phase 1 closeout is `T223`, and unstarted future reservations shift by one
  where needed.
- Added the Phase 1.4 design, implementation plan, ticket, and this worklog.
- Added `CredentialManager(scope = DEFAULT_LOCAL_SCOPE)`.
- Kept the default `getCredentialManager()` behavior on the flat local
  singleton and added scoped manager caching for callers that pass a branded
  workspace scope.
- In active multi-tenant mode, a scoped manager creates a tenant primary
  backend and a low-priority flat fallback backend. Writes use the tenant
  primary; reads can still find existing flat credentials.
- Changed `SecureStorageBackend` to resolve credential files from the current
  config root: local scope uses `<configDir>/credentials.enc`, active workspace
  scope uses `<configDir>/tenants/<workspaceId>/credentials.enc`.
- Preserved the existing local PBKDF2 substrate and legacy flat fallback.
- Added tenant HKDF key derivation from the local master key using
  `salt=workspaceId` and `info="rox.credentials.v1"`.
- Skipped local legacy-key fallback for active tenant files so copied flat or
  foreign tenant files cannot decrypt under a tenant scope.
- Added tenant payload `version: 2`, `metadata.kdfVersion: 1`, and
  `metadata.workspaceId`.
- Added trace-level structured audit events for tenant credential read, write,
  delete, and list operations without credential values.

## 7. Validation commands run

- `bun test packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts`
- `bun test packages/shared/src/credentials/__tests__/*`
- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun test`
- `bun run build`

## 8. Passing test output summary

- Targeted credential test:

```text
bun test packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts
5 pass
0 fail
16 expect() calls
```

- Credential test glob:

```text
bun test packages/shared/src/credentials/__tests__/*
5 pass
0 fail
16 expect() calls
```

- Adjacent C4 storage/auth/runtime regressions:

```text
30 pass
0 fail
53 expect() calls
```

- Full suite:

```text
bun test
5068 pass
13 skip
0 fail
1 snapshots
12699 expect() calls
5081 tests
454 files
```

- `bun run typecheck`, `bun run lint`, `bun run validate:agent-contract`,
  `bun run validate:docs`, and `git diff --check` completed with exit code 0.

## 9. Build output summary

`bun run build` completed with exit code 0. The Electron build completed main,
preload, renderer, resources, and assets. Vite emitted the existing large-chunk
warnings, with no build failure.

## 10. Remaining risks

- This ticket provides the scoped credential manager and backend substrate.
  Migrating every credential caller to pass a tenant scope remains incremental
  follow-up work, because most current callers still use the default singleton.
- The fallback backend keeps existing flat credentials readable; it does not
  copy credentials into tenant files.
- The red test run exposed that the pre-existing backend ignored
  `ROX_CONFIG_DIR`; the implementation now routes through `getConfigDir()`,
  so future tests use isolated temp roots.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Single-user credential storage remains flat and unchanged | Pass | Targeted test asserts only `<configDir>/credentials.enc` exists for `DEFAULT_LOCAL_SCOPE` |
| Tenant credential writes use tenant-prefixed storage | Pass | Targeted fallback/write test asserts tenant file exists and flat secret is unchanged |
| Existing flat credentials remain readable as tenant fallback | Pass | Tenant manager reads `legacy-flat-secret` before tenant write |
| Tenant payloads include KDF version metadata | Pass | Targeted test inspects decrypted store: `version: 2`, `kdfVersion: 1`, `workspaceId` |
| Tenant A encrypted credentials cannot be decrypted by tenant B | Pass | Copied tenant A file returns `null` under tenant B and tenant A remains readable |
| Tenant credential read/write audit events emit without secret values | Pass | Targeted stderr capture contains `credential.scope.write`, `credential.scope.read`, and workspace id |
| Targeted credential tests pass | Pass | `5 pass`, `0 fail` |
| Full relevant validation passes or blocker documented | Pass | Typecheck, lint, docs, diff check, full `bun test`, and build pass |
| Worklog complete | Pass | All 11 required sections filled |
| Commit created | Pass | This task will be committed with the T217 changes |
