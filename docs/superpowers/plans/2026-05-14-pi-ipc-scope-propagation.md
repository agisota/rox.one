# Pi IPC Scope Propagation - Implementation Plan

> **For agentic workers:** Follow the repository TDD loop. Update
> `docs/worklog/T216-pi-ipc-scope-propagation.md` after each evidence-bearing
> step.

**Goal:** Propagate storage-scope auth inputs into the Pi subprocess and
re-mint authenticated scope on the Pi side without serializing branded scope.

**Spec:** `docs/superpowers/specs/2026-05-14-pi-ipc-scope-propagation-design.md`

**Ticket:** `docs/tickets/T216-pi-ipc-scope-propagation.md`

**Branch:** `feat/phase-1-3-pi-ipc-scope-propagation`

## Files Created

| Path | Responsibility |
| --- | --- |
| `packages/pi-agent-server/src/storage-scope-bootstrap.ts` | Validate Pi storage-scope auth envelope, re-mint scope, and resolve config root. |
| `packages/pi-agent-server/src/__tests__/storage-scope-bootstrap.test.ts` | Tenant round-trip, forgery rejection, and integrity-token rejection coverage. |
| `packages/shared/src/agent/__tests__/pi-agent-scope-init.test.ts` | Proves PiAgent sends the auth envelope in the init message. |

## Files Modified

| Path | Change |
| --- | --- |
| `packages/shared/src/agent/backend/types.ts` | Add the shared storage-scope auth envelope type and optional backend config field. |
| `packages/shared/src/agent/backend/internal/drivers/pi.ts` | Forward backend `storageScopeAuth` into the Pi runtime. |
| `packages/shared/src/agent/backend/internal/drivers/pi.test.ts` | Add runtime forwarding coverage. |
| `packages/shared/src/agent/pi-agent.ts` | Generate one-time token, pass it in env, and include the envelope in Pi init. |
| `packages/pi-agent-server/src/index.ts` | Extend init message and call the bootstrap helper during initialization. |
| `packages/server-core/src/sessions/SessionManager.ts` | Provide minimal workspace-scoped envelope inputs for Pi sessions. |

## Tasks

- [x] **Task 1: Write Pi bootstrap red tests**
  - Create `storage-scope-bootstrap.test.ts`.
  - Cover permitted tenant scope resolving to `<configDir>/tenants/<workspaceId>`.
  - Cover forged requested workspace rejection.
  - Cover integrity-token mismatch rejection.
  - Expected first failure: helper module does not exist.

- [x] **Task 2: Write Pi runtime and init serialization red tests**
  - Add Pi driver test proving `coreConfig.storageScopeAuth` reaches runtime.
  - Add PiAgent init test with a fake JSONL Pi server that records the init
    message.
  - Expected failure: `storageScopeAuth` is absent from runtime/init.

- [x] **Task 3: Implement shared backend envelope type**
  - Add `PiStorageScopeAuthEnvelope` input type without importing Pi server
    code into shared runtime.
  - Keep the field optional for additive compatibility.

- [x] **Task 4: Thread envelope to PiAgent**
  - Forward `coreConfig.storageScopeAuth` from the Pi driver into runtime.
  - Generate a per-spawn token in `PiAgent`.
  - Send token via environment and init envelope.

- [x] **Task 5: Implement Pi bootstrap helper**
  - Validate envelope shape.
  - Validate token against child environment.
  - Call `deriveScopeFromAuth()`.
  - Resolve config root through `getConfigDirForScope()`.

- [x] **Task 6: Wire Pi server init**
  - Extend `InitMessage` with optional `storageScopeAuth`.
  - Call bootstrap helper in `handleInit()`.
  - Store only the resolved bootstrap result in memory for the running process.

- [x] **Task 7: Provide parent envelope inputs**
  - In `SessionManager`, set `requestedWorkspaceId` and
    `permittedWorkspaces: [workspace.id]` for Pi sessions.
  - Do not persist the envelope in session metadata.

- [x] **Task 8: Validate and close**
  - Run targeted tests.
  - Run shared and Pi typechecks.
  - Run docs and agent contract validation.
  - Run lint, build, full suite, and diff check.
  - Attempt manual Pi smoke under `ROX_MULTI_TENANT=1`; document any credential
    or local-runtime blocker.
  - Update ticket/worklog to DONE, commit, push branch, open PR, and merge after
    green.

## Validation Matrix

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

## Stop Condition

Stop only when T216 has passing validation evidence, a complete 11-section
worklog, a Lore commit, a PR merged to `main`, and the roadmap can continue to
the next free ticket number.
