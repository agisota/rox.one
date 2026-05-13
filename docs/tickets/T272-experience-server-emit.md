# T272 - Experience Layer server-side emit RPC

Status: DONE

## Context

T270 (PR #107) landed the dependency-free Experience Layer kernel at
`packages/shared/src/experience-layer/` — pure reducer, closed `ExperienceState<T>` /
`ExperienceEvent<T>` unions, branded `ExperienceId`, and a `bindExperience(...)`
adapter over a minimal non-rxjs `Observable<T>`. T271 (PR #141) landed the
renderer-side React hook (`useExperience`) so components consume the kernel
without reimplementing the lifecycle plumbing on every surface.

T272 lands the host-side emit path: a small RPC handler module at
`packages/server-core/src/handlers/rpc/experience.ts` that accepts
`ExperienceState<T>` snapshots from server code and fans them out to
subscribed renderers via the WS transport's `push` channel. The handler
is the prerequisite for T273 (ipc-bridge wiring) and T080 (per-spine
registry mapping) — once the server can mint `loaded`/`mutating`/`ready`
snapshots through a shared framing, every surface (sidebar list, session
viewer, workbench, remote workspaces) describes its lifecycle in one
place.

## Goal

Land a standalone RPC module under `packages/server-core/src/handlers/rpc/`
plus a bun:test coverage file:

1. `experience.ts` (≤300 LOC) — registers three handlers:
   - `experience.emit(input)` — owner-gated. Hosts push a fresh
     `ExperienceState<T>` snapshot for an `actorId`; the handler fans it
     out via the in-memory bus and broadcasts an `experience.event`
     push to subscribed renderers through `RpcServer.push`.
   - `experience.subscribe(actorId)` — read-gated. Returns
     `{ok: true, subscriptionId, actorId}`. The subscription is
     per-client and survives until `experience.unsubscribe`.
   - `experience.unsubscribe(id)` — releases a subscription id.
     Idempotent — unknown ids return `{ok: true, released: false}`.
2. `experience-bus.ts` (≤150 LOC) — pure in-memory pub/sub helper. No
   I/O, no timers, no global state — every `createExperienceBus()`
   returns a fresh isolated bus.
3. `__tests__/experience-rpc.test.ts` (≤350 LOC, ≥20 expect calls) —
   bun:test coverage for fan-out, owner-gate rejection, lifecycle,
   validation envelopes, and the rbac-not-configured fallback.

## Required UI

None directly — renderers consume the push channel via the T271 hook
(once T273 wires the channel through the ipc-bridge).

## Required Data/API

None new. The handler uses `RpcServer.push` (existing transport
primitive) and the existing `HandlerDeps.rbacResolver` / `roles.ts`
gating pattern.

## Required Automations

None.

## Required Subagents

None — handler is small enough to author directly and the pure bus
helper is a straightforward Map-of-arrays.

## TDD Requirements

22 bun:test specs in `experience-rpc.test.ts` (69 expects total)
covering:

- Handler registration smoke (3 channels)
- `experience.subscribe`: happy path, anonymous rejection, unrelated
  workspace rejection, invalid envelope cases
- `experience.emit`: no-subscriber happy path, non-owner rejection,
  anonymous rejection, invalid payload, global-owner cross-workspace
- `experience.emit fan-out`: single subscriber, multi-subscriber,
  cross-actor isolation, sequence stability across multiple emits
- `experience.unsubscribe`: release + stop-delivery, idempotent unknown,
  bad input, multi-subscription independence
- `rbac-not-configured`: emit + subscribe fallbacks when no resolver
- `createExperienceBus`: subscriber counts, describe, clear,
  listener exception isolation, injected id generator

## Implementation Requirements

- Re-use `ExperienceState`/`ExperienceEvent` types from
  `@rox-one/shared/experience-layer` (kernel module). Tests use the
  deep relative import pattern (`../../../../../shared/src/...`) per
  the T242b precedent so the test file resolves without depending on
  the workspace's `node_modules` symlink resolution.
- DO NOT modify `packages/shared/src/experience-layer/` (T270 is
  frozen).
- DO NOT modify the React hook (T271 is frozen).
- Channel strings are LOCAL to `experience.ts` (`EXPERIENCE_CHANNELS`
  const) — they do NOT appear in `RPC_CHANNELS` yet. T273 lifts them
  into the protocol routing table.
- Handler is NOT registered through `index.ts` yet — T273 wires it
  into `registerCoreRpcHandlers`.
- Owner-gating mirrors `roles.ts` / `missions.ts`: global owner grants
  pass anywhere; otherwise the caller must hold an owner grant whose
  `scopeKind === 'workspace'` and `scopeId` matches the request scope.
- Read-gating mirrors `missions.assertReadOnScope`.
- LOC budget: 154/300 source + 121/150 bus + 334/350 tests.

## Acceptance Criteria

- `experience.ts`, `experience-bus.ts`, and `experience-rpc.test.ts`
  exist with the documented surface.
- `bun test packages/server-core/src/handlers/rpc/__tests__/experience-rpc.test.ts`
  → 22 pass / 69 expects.
- `bun run validate:rebrand` passes.
- `bun run validate:agent-contract` passes.
- `bun run validate:roadmap` passes.

## Rollout

1. Land the handler module + bus + tests (commit 1, this PR).
2. Land the ticket + worklog (commit 2, this PR).
3. T273 wires `EXPERIENCE_CHANNELS.*` into `RPC_CHANNELS.experience`,
   adds the entries to `LOCAL_ONLY_CHANNELS` / `REMOTE_ELIGIBLE_CHANNELS`,
   and registers the handler through `registerCoreRpcHandlers`.
4. T080 maps the bundled-spine registry surfaces onto bound experiences
   through this handler + the T271 hook.

## Rollback

Standalone module with no caller on `main`. Reverting the two commits
removes the new files cleanly; nothing else changes — `index.ts` and
`channels.ts` are untouched.

## References

- T270 — Experience Layer kernel (`docs/tickets/T270-experience-layer-kernel.md`).
- T271 — renderer hook adapter (`docs/tickets/T271-experience-hook-adapter.md`).
- T273 — ipc-bridge wiring (follow-up).
- T080 — per-spine registry mapping (follow-up).
- M.9 roadmap entry — Experience Layer kernel.
- Worklog: `docs/worklog/T272-experience-server-emit.md`.
