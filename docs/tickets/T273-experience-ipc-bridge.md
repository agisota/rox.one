# T273 - Experience Layer IPC bridge (renderer ↔ server emit)

Status: DONE

## Context

T270 (PR #107, kernel), T271 (PR #141, `useExperience` renderer hook),
and T272 (PR #188, server-side emit RPC) all landed on `origin/main`.
The three modules form a complete pipeline on paper — the server mints
`ExperienceState<T>` snapshots, pushes them on `experience.event`, and
the renderer hook accepts an `Observable<T>` source. But the WS-side
push and the hook's `source$` parameter have never been joined: a
renderer that calls `useExperience(initial, source$, ...)` today still
needs to construct that observable by hand.

T273 closes the gap with a small renderer-side adapter that turns the
server push channel into an `Observable<ExperienceState<T>>` consumable
by the T271 hook directly. The bridge is standalone — it does NOT yet
get wired into the protocol routing table or registered through
`registerCoreRpcHandlers`. T274 (first consumer) folds the bridge into
the real `window.electronAPI.rpc` adapter and ships the first concrete
surface.

## Goal

Land a single renderer adapter under
`apps/electron/src/renderer/experience-layer/` plus a bun:test coverage
file:

1. `ipc-bridge.ts` (≤200 LOC) — exports
   `createExperienceIpcBridge(rpcClient, {actorId}, options?)`
   returning an `Observable<ExperienceState<T>>` shape that
   `useExperience`'s `source$` parameter accepts. Internally:
   - Holds exactly one upstream `rpcClient.subscribe('experience.event', ...)`
     subscription regardless of how many hook subscribers attach.
   - Filters inbound payloads by `actorId` so one client subscription
     can carry many experiences.
   - Drops structurally-invalid envelopes through an optional
     `onPayloadError` sink (silent swallow when absent).
   - Releases the upstream subscription when the last observer
     unsubscribes; re-acquires it when a new subscriber arrives.
   - Isolates observer exceptions (one throwing handler must not
     break sibling deliveries).
2. `__tests__/ipc-bridge.test.ts` (≤250 LOC, ≥10 expect calls) —
   bun:test coverage for the lifecycle, multiplexing, malformed-
   payload rejection, and observer-error isolation.

## Required UI

None directly — the bridge is consumed by future T274 work that
wires the real `window.electronAPI.rpc` adapter.

## Required Data/API

None new. The bridge consumes the T272 `experience.event` push channel
and the T271 `Observable<T>` shape exposed by
`@rox-one/shared/experience-layer`.

## Required Automations

None.

## Required Subagents

None — the file is small (under the LOC budget) and authored directly.

## TDD Requirements

15 bun:test specs in `ipc-bridge.test.ts` (36 expects total) covering:

- No upstream subscription before the first observer.
- Single upstream subscription on first subscriber + correct channel.
- Custom channel override.
- Inbound payload forwarding as `ExperienceState` emissions.
- ActorId mismatch dropped silently.
- Malformed payloads (null, primitives, missing fields, empty actorId,
  unknown state kind, empty state id) dropped with `invalid-envelope`
  reason.
- Silent swallow when no `onPayloadError` sink is provided.
- Upstream release on last observer unsubscribe.
- Upstream alive while another observer remains.
- Idempotent double-unsubscribe.
- No deliveries to observers after unsubscribe.
- Shared upstream subscription across N observers (multiplexing).
- Re-acquires upstream after release + new subscriber.
- Observer exceptions isolated from sibling handlers.
- Upstream unsubscribe that throws does not break the bridge.

## Implementation Requirements

- Re-use `Observable<T>`, `Observer<T>`, `Unsubscribe`, and
  `ExperienceState<T>` types from `@rox-one/shared/experience-layer`
  (kernel module). Tests use the deep relative import pattern
  (`../../../../../../packages/shared/src/...`) per the T272 precedent
  so the test file resolves without depending on the workspace's
  `node_modules` symlink resolution.
- DO NOT modify `packages/shared/src/experience-layer/` (T270 is frozen).
- DO NOT modify `apps/electron/src/renderer/hooks/useExperience.ts`
  (T271 is frozen).
- DO NOT modify `packages/server-core/src/handlers/rpc/experience*.ts`
  (T272 is frozen).
- The `ExperienceIpcRpcClient` interface is module-local — defined
  inline in `ipc-bridge.ts` so no shared client surface needs to be
  introduced. T274 may extract a shared client surface when it wires
  the real adapter.
- `EXPERIENCE_EVENT_CHANNEL` constant duplicates the T272
  `EXPERIENCE_CHANNELS.EVENT` string. Lifting both into the protocol
  routing table is T274 work.
- LOC budget: 177/200 source + 249/250 tests.

## Acceptance Criteria

- `ipc-bridge.ts` and `__tests__/ipc-bridge.test.ts` exist with the
  documented surface.
- `bun test apps/electron/src/renderer/experience-layer/__tests__/ipc-bridge.test.ts`
  → 15 pass / 36 expects.
- `bun run validate:rebrand` passes.
- `bun run validate:agent-contract` passes.
- `bun run validate:roadmap` passes.

## Rollout

1. Land the bridge module + tests (commit 1, this PR).
2. Land the ticket + worklog (commit 2, this PR).
3. T274 (first consumer) extracts a shared `ExperienceRpcClient`
   surface from the renderer transport, wires the bridge into a real
   feature surface (likely the bundled-spine registry), and lifts
   `EXPERIENCE_EVENT_CHANNEL` plus the three T272 channels into
   `RPC_CHANNELS.experience` + `LOCAL_ONLY_CHANNELS` /
   `REMOTE_ELIGIBLE_CHANNELS`.

## Rollback

Standalone module with no caller on `main`. Reverting the two commits
removes the new files cleanly; nothing else changes — the protocol
routing table, hook, kernel, and server handler are untouched.

## References

- T270 — Experience Layer kernel (`docs/tickets/T270-experience-layer-kernel.md`).
- T271 — renderer hook adapter (`docs/tickets/T271-experience-hook-adapter.md`).
- T272 — server-side emit RPC (`docs/tickets/T272-experience-server-emit.md`).
- T274 — first concrete consumer (follow-up).
- T080 — per-spine registry mapping (follow-up).
- M.9 roadmap entry — Experience Layer kernel.
- Worklog: `docs/worklog/T273-experience-ipc-bridge.md`.
