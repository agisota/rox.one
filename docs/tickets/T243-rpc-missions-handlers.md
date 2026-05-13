# T243-rpc - Mission admin RPC handlers (create / dispatchEvent / get / list)

Status: DONE

## Context

We are building a white-label fork of ROX.ONE OSS into the
ROX.ONE Agent Workbench Suite.

T241 (PR #88) shipped the pure mission kernel at
`packages/server-core/src/missions/` — branded `MissionId`, the
exhaustive `MissionState` discriminated union, the pure
`transition(state, event)` algebra, and the
`MissionScheduler` + `InMemoryMissionStore` references. T246 (PR #99)
then plugged the `AuditProducer` into the scheduler so mission
lifecycle transitions hit the audit log.

T243-rpc layers the admin RPC surface on top: four channels
(`missions.create`, `missions.dispatchEvent`, `missions.get`,
`missions.list`) that let renderer code drive the scheduler over the
WS-based IPC transport. M.13's existing T243 (RBAC scope-forgery
property tests) and M.0's T244 (schema reservation) already own those
ticket ids, so this slice uses the hyphenated `T243-rpc` suffix to
keep numbering clean.

## Scope

Source changes (≤350 LOC source + ≤500 LOC tests):

1. `packages/shared/src/protocol/channels.ts` — add
   `RPC_CHANNELS.missions.{CREATE,DISPATCH_EVENT,GET,LIST}`.
2. `packages/shared/src/protocol/routing.ts` — classify the four
   new channels as REMOTE_ELIGIBLE (the scheduler runs on whichever
   server owns the workspace).
3. `packages/server-core/src/handlers/handler-deps.ts` — add an
   optional `missionScheduler?: MissionScheduler` field. Hosts that
   have not adopted the M.8 surface may omit it; the handlers then
   respond with `{error: 'missions-not-configured'}`.
4. `packages/server-core/src/handlers/rpc/missions.ts` — new
   `registerMissionsCoreHandlers(server, deps)` factory.
   - `missions.create` — owner-on-workspace (or global owner) gated.
     Mints a `MissionId`, calls `scheduler.create()`, returns the
     fresh `MissionRecord`.
   - `missions.dispatchEvent` — owner-on-workspace gated.
     Forwards a `SchedulerInputEvent` to the scheduler. Validates the
     envelope (`id`, `event.kind`) before the permission check.
     Returns `{ok, mission}` on success, structured `{error, reason}`
     on validation / not-found / illegal-transition.
   - `missions.get` — read-permission gated. Returns the record or
     `{error: 'mission-not-found', reason: id}`.
   - `missions.list` — read-permission gated. Returns the records
     filtered by optional `MissionListFilter.kinds`.
5. `packages/server-core/src/handlers/rpc/index.ts` — register
   the new factory inside `registerCoreRpcHandlers`.

Test changes:

6. `packages/server-core/src/handlers/rpc/__tests__/missions-rpc.test.ts`
   — 37 tests / 58 expect() calls covering every handler's happy
   path, owner-gate rejection, read-permission rejection across
   workspaces, error-envelope shape, the `missions-not-configured`
   fallback, and the registration smoke check.

## Owner-gating

The handler module includes a small local `assertOwnerOnScope`
helper that mirrors the `roles.ts` T227 pattern (the upstream helper
is not exported; the constraint `DO NOT modify roles.ts beyond reading
the assertOwnerOnScope import` is honoured — we read the *pattern*,
not the symbol, and keep `roles.ts` untouched).

For mutating channels, the caller must hold either:

- a `global` owner grant, OR
- a `workspace`-scoped owner grant whose `scopeId` matches
  `ctx.workspaceId`.

For read channels, `permittedWorkspacesForUser(userId)` must include
either the global sentinel `'*'` or the request's `workspaceId`.

## Out of scope

- Renderer IPC client wiring. Tracked as **T244-rpc** (mission IPC
  client wrapper + types) in the M.8 follow-up lane.
- Persistent stores. The handlers operate on whatever scheduler is
  injected — `InMemoryMissionStore` today; sqlite / PG come later.
- Workspace-aware mission storage. The current scheduler is keyed by
  id alone; multi-workspace bucketing lives downstream of this slice.

## Rules followed

- `missionScheduler` is OPTIONAL — hosts that have not adopted M.8
  work unchanged.
- No mutation of `packages/server-core/src/missions/` (frozen by
  T241/T246).
- No edits to `packages/server-core/src/handlers/rpc/roles.ts`
  beyond reading the gating pattern.
- All four handlers return structured `{error, reason}` objects on
  failure — no exceptions thrown.
- No `any`.

## Validation gates

- `bun test packages/server-core/src/handlers/rpc/__tests__/missions-rpc.test.ts`
  — 37 / 37 pass, 58 expect() calls.
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pass.
- `bun run validate:roadmap` — pass.

## Follow-ups

- **T244-rpc** — renderer mission IPC client wrapper + typed
  invocation helpers.
- **Persistent MissionStore** — sqlite or PG-backed implementation
  for durability across restarts (T242 territory).
- **Audit emission per channel** — already lands via T246 inside the
  scheduler; the RPC layer remains a thin pass-through.
