# T273 - Experience Layer IPC bridge (renderer ↔ server emit)

## 1. Task summary

Land the renderer-side adapter that joins the T272 server-side emit
push channel to the T271 `useExperience` hook's `Observable<T>` source.
A single standalone file at
`apps/electron/src/renderer/experience-layer/ipc-bridge.ts` (≤200 LOC)
exposes `createExperienceIpcBridge(rpcClient, {actorId}, options?)`
returning a kernel-compatible observable that emits whenever the
server pushes an `experience.event` matching the bound `actorId`.

This is the M.9 closeout for the kernel → emit → bridge trio: T270
(PR #107) shipped the pure reducer, T271 (PR #141) shipped the React
hook, T272 (PR #188) shipped the server emit RPC. T273 lands the
small piece of glue that lets a renderer surface drop into the
pipeline without rebuilding the observable plumbing locally. T274
(first consumer) extracts the shared `ExperienceRpcClient` surface,
wires the bridge into a real feature surface, and lifts the channel
strings into the protocol routing table.

## 2. Repo context discovered

- The T271 hook accepts a minimal `Observable<T>` shape exported by
  the kernel — `subscribe(observer): Unsubscribe` with no rxjs
  dependency. The bridge therefore needs to return that exact shape;
  no adapter glue is needed at the hook side.
- The T272 server handler pushes via
  `server.push('experience.event', {to:'client', clientId}, {actorId, state})`
  — so each delivered envelope carries an `actorId` and an
  `ExperienceState<T>` snapshot. The bridge has to match on
  `actorId` (one client subscription can carry many experiences).
- The renderer does not yet have a shared RPC-client interface for
  push subscriptions. The existing `RolesPanelRpcClient` is
  `invoke`-only. The T273 spec says: "define [the rpcClient
  interface] inline if no shared client interface exists" — so the
  bridge ships a module-local `ExperienceIpcRpcClient` interface
  with a single `subscribe(channel, handler)` method that returns
  an `Unsubscribe` thunk. T274 will extract a shared surface when
  it wires the real adapter.
- The renderer had no existing `experience-layer/` directory; the
  bridge file plus its `__tests__/` folder are the seed of that
  surface, paralleling the kernel's structure under
  `packages/shared/src/experience-layer/`.
- The protocol routing table at `packages/shared/src/protocol/routing.ts`
  has an exhaustiveness test requiring every channel value in
  `RPC_CHANNELS` to appear in either `LOCAL_ONLY_CHANNELS` or
  `REMOTE_ELIGIBLE_CHANNELS`. T273 keeps the channel string LOCAL
  to the bridge file (`EXPERIENCE_EVENT_CHANNEL`) — same pattern as
  T272's `EXPERIENCE_CHANNELS`. T274 lifts both into the routing
  table in one atomic change.

## 3. Files inspected

- `packages/shared/src/experience-layer/*` (kernel surface — frozen).
- `apps/electron/src/renderer/hooks/useExperience.ts` (T271 hook —
  frozen; confirmed source$ observable shape).
- `packages/server-core/src/handlers/rpc/experience.ts` (T272 emit
  RPC — frozen; confirmed push channel + envelope shape).
- `packages/server-core/src/handlers/rpc/experience-bus.ts` (T272
  pub/sub helper — confirmed reentrancy guard pattern).
- `packages/server-core/src/handlers/rpc/__tests__/experience-rpc.test.ts`
  (T272 test format — confirmed bun:test conventions).
- `packages/shared/src/experience-layer/__tests__/experience-bind.test.ts`
  (T270 test format — confirmed `createSubject` + `Observable`
  patterns; informed multiplexing test design).
- `apps/electron/src/renderer/components/settings/rbac/RolesPanelContext.tsx`
  (existing minimal renderer RPC adapter — confirmed `invoke`-only;
  no shared subscription interface available).

## 4. Files added

- `apps/electron/src/renderer/experience-layer/ipc-bridge.ts` (177 LOC).
- `apps/electron/src/renderer/experience-layer/__tests__/ipc-bridge.test.ts`
  (249 LOC, 15 specs, 36 expects).
- `docs/tickets/T273-experience-ipc-bridge.md`.
- `docs/worklog/T273-experience-ipc-bridge.md`.

## 5. Design choices

- **Module-local rpcClient interface.** `ExperienceIpcRpcClient`
  declares the smallest possible push-subscription surface:
  `subscribe(channel, handler): Unsubscribe`. T274 may extract a
  shared interface when it wires the real `window.electronAPI.rpc`
  adapter; for now the inline interface keeps the bridge file
  self-contained and the test harness free of any Electron mock.
- **Single upstream + in-process multiplexing.** The bridge holds
  exactly one `rpcClient.subscribe(...)` call regardless of how many
  hook subscribers attach. This matches the T272 design (server
  per-client push) and avoids waste: many surfaces on one renderer
  share one transport subscription. Upstream is released when the
  last observer unsubscribes and re-acquired on the next subscribe.
- **ActorId filtering at the bridge boundary.** Server pushes carry
  `{actorId, state}`. The bridge drops non-matching deliveries silently
  so a single client subscription can carry many experiences without
  the hook code knowing. T274 may add a higher-level "multi-actor
  bridge" that demuxes by actorId; the single-actor bridge is the
  primitive both layers need.
- **Structural envelope validation.** Inbound payloads are checked
  with the same shape rule the T272 emit handler uses (kind in the
  closed set, non-empty id, non-empty actorId). Bad envelopes are
  dropped through the optional `onPayloadError` sink so a misbehaving
  host doesn't corrupt reducer state downstream. The hook applies the
  reducer and gets exhaustive rejection of illegal transitions for
  free.
- **Reentrancy guard in fan-out.** Observer dispatch iterates a
  snapshot of the set so an observer that mutates the set during
  dispatch doesn't disturb the in-flight delivery. Same discipline as
  the T270 `bindExperience` and the T272 `experience-bus`.
- **Observer-error isolation.** A throwing `next(...)` handler is
  swallowed silently — siblings still receive the same value and the
  upstream subscription stays live. This prevents one bad surface
  from breaking the whole renderer.
- **Idempotent unsubscribe.** Each subscribe returns a thunk that is
  safe to call multiple times. The upstream release thunk is also
  wrapped in a try/catch so a transport that throws on release
  doesn't leave the bridge in an inconsistent state (the upstream
  slot is cleared before the thunk is invoked).
- **Channel constant duplicated, not imported.** The bridge defines
  `EXPERIENCE_EVENT_CHANNEL = 'experience.event'` rather than
  importing from `packages/server-core`. Renderer code must not
  cross the server-core package boundary; T274 will lift both into
  `@rox-one/shared/protocol` once the routing table accepts them.

## 6. Test plan

15 bun:test specs in `ipc-bridge.test.ts` (36 expects total):

1. Subscribe + forwarding (5 specs): no upstream pre-subscribe, single
   upstream on first subscribe, custom channel override, payload
   forwarding as `ExperienceState`, actorId mismatch dropped.
2. Malformed payloads (2 specs): structurally-invalid envelopes
   dropped through the error sink, silent swallow when no sink.
3. Unsubscribe lifecycle (4 specs): upstream release on last observer,
   upstream alive with remaining observer, idempotent double
   unsubscribe, no deliveries post-unsubscribe.
4. Multi-subscriber (4 specs): shared upstream across N observers,
   re-acquires after release + new subscribe, observer exceptions
   isolated, upstream release that throws doesn't break the bridge.

## 7. Validation

- `bun test apps/electron/src/renderer/experience-layer/__tests__/ipc-bridge.test.ts`
  → 15 pass / 36 expects / 0 fail (43 ms).
- `bun run validate:rebrand` → passes.
- `bun run validate:agent-contract` → passes (319 tickets / 11 skills
  / 7 required docs).
- `bun run validate:roadmap` → passes (46 phases / 110 tickets).

## 8. LOC budget

- `ipc-bridge.ts`: 177 / 200 LOC.
- `__tests__/ipc-bridge.test.ts`: 249 / 250 LOC.

## 9. Follow-ups

- **T274 — first consumer**: extracts a shared `ExperienceRpcClient`
  surface from the renderer transport (likely under
  `apps/electron/src/renderer/lib/rpc-client.ts`), wires the bridge
  into a real feature surface (likely the bundled-spine registry or
  the workbench surface registry), and lifts both the T272 channel
  strings and the bridge's `EXPERIENCE_EVENT_CHANNEL` into
  `RPC_CHANNELS.experience` + the routing classification arrays.
- **T080 — per-spine registry mapping**: maps the bundled-spine
  registry surfaces onto bound experiences through the T272 handler,
  the T271 hook, and this bridge.
- **Multi-actor demux** (deferred): if a future surface needs to bind
  many experiences from one transport subscription efficiently, a
  thin "multi-actor bridge" can demux by `actorId` from a single
  upstream subscription. The single-actor bridge in T273 is the
  primitive that demux composes from; no demux is needed yet.
