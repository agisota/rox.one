# T216 - Pi IPC scope propagation

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench
Suite.

Relevant product goals:

- managed web/cloud app
- user/team workspaces
- multi-tenant storage isolation
- validation gates
- TDD-first implementation

Phase 1.3 of the master roadmap names this ticket as
`T215-pi-ipc-scope-propagation`, but `T215` is already used by the server-core
RPC handler scope migration. This task uses the next free ticket number,
`T216`, and preserves the Phase 1.3 scope.

## Goal

Propagate workspace auth-scope inputs from the host runtime into the Pi
subprocess so the Pi side re-mints the authenticated branded scope, resolves
the same tenant storage root, and rejects roxed cross-workspace envelopes in
multi-tenant mode.

## Required UI

None.

## Required Data/API

- Add an IPC-safe storage-scope auth envelope to the Pi bootstrap path.
- Keep `BrandedWorkspaceScope` process-local and opaque.
- Propagate only the inputs needed to re-mint scope:
  `requestedWorkspaceId`, `permittedWorkspaces`, optional `userId`, optional
  `reqId`, and a one-time IPC integrity token.
- Keep single-user behavior unchanged when `ROX_MULTI_TENANT` is disabled.
- In multi-tenant mode, Pi bootstrap must reject forged envelopes before any
  tenant storage root is accepted.

## Required Automations

None.

## Required Subagents

Read-only explorer subagents already mapped:

- Pi IPC bootstrap path from server-core session manager to Pi subprocess.
- Current Pi and storage-scope test harnesses.

## TDD Requirements

Before implementation:

1. Add a Pi-side bootstrap helper test that proves a tenant envelope resolves
   to the same tenant config root as `deriveScopeFromAuth()`.
2. Add a Pi-side forgery test that proves a roxed workspace id outside
   `permittedWorkspaces` rejects.
3. Add an IPC serialization test that proves `PiAgent` sends the scope auth
   envelope in the init message.
4. Run tests and confirm expected failure for the missing helper/envelope.

## Implementation Requirements

- Add the smallest shared backend type surface needed for the storage-scope
  auth envelope.
- Thread the envelope through the Pi backend runtime and Pi init message.
- Generate a per-spawn one-time integrity token in the parent and pass it to
  the child through the environment and init payload.
- Add a Pi-side `bootstrapScope(sessionEnvelope)` helper that validates token
  and envelope shape, then calls `deriveScopeFromAuth()`.
- Call the helper during Pi init so the child records the resolved storage
  root for the current session.
- Do not persist the auth envelope in session storage.
- Do not add RBAC production in this ticket; Phase 2 remains the producer of
  full `permittedWorkspaces`.

## Validation Commands

- `bun test packages/pi-agent-server/src/__tests__/storage-scope-bootstrap.test.ts`
- `bun test packages/shared/src/agent/__tests__/pi-agent-scope-init.test.ts`
- `bun test packages/shared/src/agent/backend/internal/drivers/pi.test.ts`
- `cd packages/shared && bunx tsc --noEmit`
- `cd packages/server-core && bunx tsc --noEmit`
- `cd packages/pi-agent-server && bun run build`
- `cd packages/pi-agent-server && bunx tsc --noEmit`
- `ROX_MULTI_TENANT=1 bun test packages/shared/src/agent/__tests__/pi-agent-scope-init.test.ts packages/pi-agent-server/src/__tests__/storage-scope-bootstrap.test.ts`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`
- `bun run build`
- `bun test`

Manual smoke:

- Start a Pi-backed agent session with `ROX_MULTI_TENANT=1` and confirm the
  session initializes under the tenant storage root. If credentials or local Pi
  runtime requirements block this smoke, document the exact blocker in the
  worklog.

## Acceptance Criteria

- [x] Pi init carries a storage-scope auth envelope.
- [x] The Pi side re-mints scope with `deriveScopeFromAuth()`.
- [x] The parent scope inputs and Pi bootstrap resolve the same tenant config
      root under `ROX_MULTI_TENANT=1`.
- [x] Roxed cross-workspace envelopes reject with `MultiTenantForgeryError`.
- [x] Integrity-token mismatch rejects before scope derivation.
- [x] Single-user runtime remains unchanged.
- [x] Targeted tests pass.
- [x] Full relevant validation passes or blockers are documented.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T216-pi-ipc-scope-propagation.md`.
