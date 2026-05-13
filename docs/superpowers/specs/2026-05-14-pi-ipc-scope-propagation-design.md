# Pi IPC Scope Propagation Design

- **Status:** implemented
- **Date:** 2026-05-14
- **Extends:** ADR 0007 multi-tenant storage isolation
- **Roadmap phase:** 1.3, implemented as ticket `T216`

## Goal

Close the C.4 Pi IPC gap by carrying authenticated workspace-scope inputs into
the Pi subprocess and re-minting branded storage scope inside that process. The
Pi process must resolve the same tenant storage root as the parent for the
session workspace and reject roxed cross-workspace envelopes in multi-tenant
mode.

## Non-goals

- Do not serialize `BrandedWorkspaceScope`.
- Do not persist scope auth envelopes in session storage.
- Do not implement Phase 2 RBAC production of permission sets.
- Do not migrate credentials or storage files.
- Do not change single-user storage layout.

## Locked Decisions

1. **Serialize inputs, not scopes.** The branded scope stays opaque and
   process-local. IPC carries only `requestedWorkspaceId`,
   `permittedWorkspaces`, optional `userId`, optional `reqId`, and an
   integrity token.
2. **Parent mints a one-time IPC integrity token per Pi spawn.** The token is
   delivered to the child in the environment and in the init envelope. The Pi
   helper rejects a mismatch before deriving scope.
3. **Pi reuses the C.4 factory.** `bootstrapScope(sessionEnvelope)` validates
   the envelope and calls `deriveScopeFromAuth()` from shared config code.
4. **Phase 1.3 uses the session workspace as the minimum permission set.** The
   parent starts Pi for one managed workspace, so it can safely send
   `permittedWorkspaces: [workspace.id]` until Phase 2 RBAC supplies richer
   lists.
5. **Envelope is additive.** Older Pi bootstraps without the envelope continue
   to run in single-user mode; multi-tenant tests cover the new envelope path.

## Data Contract

```ts
interface PiStorageScopeAuthEnvelope {
  requestedWorkspaceId: string | null;
  permittedWorkspaces: readonly string[];
  userId?: string;
  reqId?: string;
  integrityToken: string;
}
```

Rules:

- `requestedWorkspaceId` must be `null` or a non-empty string.
- `permittedWorkspaces` must be an array of non-empty strings.
- `integrityToken` must match the per-spawn token exposed to the Pi process.
- In `ROX_MULTI_TENANT=1`, `deriveScopeFromAuth()` rejects when
  `requestedWorkspaceId` is not permitted.
- When multi-tenant mode is disabled, the factory downgrades to
  `DEFAULT_LOCAL_SCOPE`, preserving current behavior.

## Data Flow

```text
SessionManager.getOrCreateAgent()
  -> builds backend config with storageScopeAuth inputs
  -> createBackendFromResolvedContext()
  -> piDriver.buildRuntime()
  -> PiAgent.spawnSubprocess()
     - creates one-time integrity token
     - passes token in child env
     - sends storageScopeAuth in JSONL init
  -> pi-agent-server handleInit()
  -> bootstrapScope(storageScopeAuth)
  -> deriveScopeFromAuth()
  -> getConfigDirForScope()
```

## Security Properties

- A forged workspace id outside `permittedWorkspaces` rejects through
  `MultiTenantForgeryError` and inherits the existing C.4 audit emission.
- A missing or mismatched integrity token rejects before scope derivation.
- Pi-side code never accepts a parent-sent filesystem path as authority for the
  tenant root; it resolves the root locally from the re-minted branded scope.
- The parent-side permitted list is intentionally minimal for Phase 1.3 and can
  be widened later by RBAC without changing the Pi IPC contract.

## Compatibility

- Single-user installs remain flat because `deriveScopeFromAuth()` returns
  `DEFAULT_LOCAL_SCOPE` unless `ROX_MULTI_TENANT=1`.
- The IPC field is optional in the TypeScript init shape while the migration is
  in progress. Pi code treats missing scope auth as local single-user scope.
- No session persistence format changes are required.

## Testing

- Unit: Pi bootstrap helper resolves tenant scope and config root.
- Security: Pi bootstrap helper rejects workspace forgery.
- Security: Pi bootstrap helper rejects integrity-token mismatch.
- Serialization: PiAgent init message includes the envelope and generated
  token when backend runtime has storage-scope auth inputs.
- Driver: Pi backend runtime forwards `storageScopeAuth` from core config.
- Regression: full suite proves single-user behavior and existing Pi tests are
  unchanged.

## Acceptance Criteria

- Pi init carries scope auth inputs.
- Pi re-mints scope with `deriveScopeFromAuth()`.
- Parent and Pi resolve the same tenant config root for a permitted workspace.
- Roxed cross-workspace envelopes reject.
- Integrity-token mismatch rejects before derivation.
- Validation evidence is recorded in the T216 worklog.
