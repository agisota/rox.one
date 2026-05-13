# T217 - Tenant credential key derivation

Status: DONE

## Context

We are building a white-label fork of Craft Agents OSS into Agent Workbench
Suite.

Relevant product goals:

- managed web/cloud app
- user/team workspaces
- multi-tenant storage isolation
- validation gates
- TDD-first implementation

Phase 1.4 was originally reserved as `T216-tenant-credential-key-derivation`,
but Phase 1.3 landed as `T216-pi-ipc-scope-propagation` after `T215` was
already occupied by server-core RPC handler migration. This task uses the next
free ticket number, `T217`, and preserves the Phase 1.4 scope.

## Goal

Add tenant-specific credential encryption keys for workspace-scoped credential
stores while preserving the existing flat single-user credential file and key
derivation.

## Required UI

None.

## Required Data/API

- `CredentialManager` accepts an optional `BrandedWorkspaceScope` and defaults
  to `DEFAULT_LOCAL_SCOPE`.
- `getCredentialManager()` keeps existing caller behavior: no argument returns
  the flat local singleton.
- In `ROX_MULTI_TENANT=1`, workspace-scoped credential writes go to
  `<configDir>/tenants/<workspaceId>/credentials.enc`.
- Tenant encryption key is derived as
  `HKDF-SHA256(masterKey, salt=workspaceId, info="rox.credentials.v1")`.
- Tenant credential payloads include `version: 2`, `metadata.kdfVersion: 1`,
  and `metadata.workspaceId`.
- Tenant-scoped reads fall back to the flat credential backend when the tenant
  file has no matching credential, so existing credentials remain readable
  after enabling multi-tenant mode.
- Tenant writes never overwrite the flat credential file.

## Required Automations

Trace-level audit events for tenant credential read, write, delete, and list
operations. Audit payloads must not include credential values.

## Required Subagents

Read-only explorer mapped credential storage and call sites before
implementation.

## TDD Requirements

Before implementation:

1. Add `packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts`.
2. Prove flat credentials stay at `<configDir>/credentials.enc`.
3. Prove tenant manager reads flat fallback, then writes and prefers tenant
   credentials separately.
4. Prove tenant store writes KDF metadata.
5. Prove tenant B cannot decrypt tenant A's copied credential file.
6. Prove audit events emit for tenant reads and writes.
7. Run the targeted test and confirm it fails for the missing implementation.

## Implementation Requirements

- Keep the existing single-user binary file format and local KDF behavior.
- Do not export storage scope brand internals.
- Do not add production dependencies.
- Do not change out-of-scope credential callers beyond adding the optional
  scope-aware API surface.
- Keep credential values out of logs and audit payloads.

## Validation Commands

- `bun test packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts`
- `bun test packages/shared/src/credentials/__tests__/*`
- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] Single-user credential storage remains flat and unchanged.
- [x] Tenant credential writes use tenant-prefixed storage.
- [x] Existing flat credentials remain readable as tenant fallback.
- [x] Tenant payloads include KDF version metadata.
- [x] Tenant A encrypted credentials cannot be decrypted by tenant B.
- [x] Tenant credential read/write audit events emit without secret values.
- [x] Targeted credential tests pass.
- [x] Full relevant validation passes or precise blockers are documented.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T217-tenant-credential-key-derivation.md`.
