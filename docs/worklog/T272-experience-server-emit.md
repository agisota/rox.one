# T272 - Experience Layer server-side emit RPC

## 1. Task summary

Land the host-side emit path for the M.9 Experience Layer: a standalone
RPC handler module at `packages/server-core/src/handlers/rpc/experience.ts`
that mints `ExperienceState` events for the T271 renderer hook to consume
via subscription. Three channels (`experience.emit`,
`experience.subscribe`, `experience.unsubscribe`) plus a pure in-memory
pub/sub helper (`experience-bus.ts`). Owner-gated for emit, read-gated
for subscribe — same RBAC pattern as `roles.ts` and `missions.ts`.

This is the M.9 follow-up to T270 (PR #107, kernel) and T271 (PR #141,
renderer hook). The handler is the prerequisite for T273 (ipc-bridge
wiring — lifts channel strings into `RPC_CHANNELS.experience` and the
routing table) and T080 (per-spine registry mapping).

## 2. Repo context discovered

- The protocol routing table at `packages/shared/src/protocol/routing.ts`
  has an exhaustiveness test (`packages/shared/src/protocol/__tests__/routing.test.ts`)
  that requires every channel value in `RPC_CHANNELS` to appear in
  either `LOCAL_ONLY_CHANNELS` or `REMOTE_ELIGIBLE_CHANNELS`. Adding
  channels to `channels.ts` without also touching `routing.ts` would
  break CI. The T272 spec forbids modifying `channels.ts` and
  `routing.ts`, so channel strings live LOCAL to `experience.ts` for
  this ticket and T273 will lift them into the protocol surface.
- The `index.ts` core registrar follows a simple list of
  `registerXxxCoreHandlers(server, deps)` calls. The T272 spec
  forbids modifying `index.ts`, so the handler is NOT registered by
  default — hosts that want it call `registerExperienceCoreHandlers`
  directly. T273 will add the standard registration line.
- `RpcServer.push(channel, target, ...args)` is the existing transport
  primitive for server → client broadcasts. `PushTarget` supports
  `{to: 'all' | 'workspace' | 'client'}`. Per-client delivery is the
  safer default for renderer hooks (matches the T271 subscription
  model); T273 may widen to workspace fan-out where appropriate.
- The `@rox-one/shared/experience-layer` subpath export is reachable
  from `packages/server-core` through the workspace alias, but for the
  test file we follow the T242b precedent and use a deep relative
  import (`../../../../../shared/src/experience-layer/index.ts`) to
  avoid the agent-isolated worktree's `node_modules` symlink resolution
  fragility documented in the T271 worklog.

## 3. Files inspected

- `packages/shared/src/experience-layer/*` (kernel surface — frozen)
- `apps/electron/src/renderer/hooks/useExperience.ts` (T271 hook —
  frozen; confirmed subscription model)
- `packages/server-core/src/handlers/rpc/roles.ts` (owner-gate pattern)
- `packages/server-core/src/handlers/rpc/missions.ts` (owner-gate +
  read-gate + invalid-argument envelope patterns)
- `packages/server-core/src/handlers/rpc/__tests__/roles.test.ts` and
  `packages/server-core/src/handlers/rpc/__tests__/missions-rpc.test.ts`
  (stub RpcServer harness, `InMemoryGrantStore` + `RbacResolver` wiring)
- `packages/server-core/src/transport/types.ts` (`RpcServer` interface,
  `RequestContext` shape)
- `packages/shared/src/protocol/types.ts` (`PushTarget` shape)
- `packages/shared/src/protocol/channels.ts` and `routing.ts` (routing
  exhaustiveness contract)
- `docs/tickets/T270-experience-layer-kernel.md`,
  `docs/tickets/T271-experience-hook-adapter.md` (ticket format)

## 4. Files added

- `packages/server-core/src/handlers/rpc/experience.ts` (154 LOC)
- `packages/server-core/src/handlers/rpc/experience-bus.ts` (121 LOC)
- `packages/server-core/src/handlers/rpc/__tests__/experience-rpc.test.ts`
  (334 LOC, 22 specs, 69 expects)
- `docs/tickets/T272-experience-server-emit.md`
- `docs/worklog/T272-experience-server-emit.md`

## 5. Design choices

- **Local channel constants for now.** `EXPERIENCE_CHANNELS` is a
  module-local `as const` record — `EMIT`, `SUBSCRIBE`, `UNSUBSCRIBE`,
  and the `EVENT` push channel. Folding these into `RPC_CHANNELS`
  requires synchronized edits to `channels.ts` and `routing.ts`, both
  of which are out of T272 scope. T273 lifts the strings into the
  protocol routing table in one atomic change.
- **Standalone registration.** The handler is NOT added to
  `registerCoreRpcHandlers` in `index.ts` — T273 wires it in. This
  keeps T272's blast radius to four new files (handler, bus, test,
  ticket+worklog).
- **Per-client push delivery.** `experience.subscribe` captures the
  caller's `ctx.clientId` and the listener pushes
  `{to: 'client', clientId}` only. This matches the T271 subscription
  model (one hook = one subscription = one push channel). Workspace
  fan-out is a T273 concern when we know which experiences are
  workspace-shared vs per-renderer.
- **Bus is isolated per registration.** Every
  `registerExperienceCoreHandlers` call mints a fresh
  `createExperienceBus()` instance unless the caller passes one
  explicitly via `options.bus`. Hosts that want a process-wide bus
  build one in bootstrap and pass it in; tests get the fresh-bus
  isolation by default so they don't leak subscriptions between
  describe blocks.
- **`isExperienceState` is structural, not kernel-based.** The kernel
  exposes `parseExperienceId` for the branded id, but a full state
  validator would duplicate the kernel's discriminated-union shape and
  risk drift on future variants. The handler instead checks `kind` is
  one of the five known strings and `id` is a non-empty string. The
  T270 reducer accepts whatever shape passes through (it's pure on the
  variant tags), so this lighter check is sufficient at the RPC
  boundary; renderers downstream apply the reducer and get exhaustive
  rejection of illegal transitions for free.
- **Reentrancy guard in `bus.emit`.** Fan-out iterates a snapshot of
  the listener list so a listener that calls back into
  `subscribe`/`unsubscribe` doesn't disturb the in-flight delivery.
  This matches the kernel's `bindExperience` discipline.
- **`emit` returns `delivered` count.** Useful for hosts that want to
  detect dead subscriptions and for the test suite to assert fan-out
  numbers without re-counting pushes. The hosts and renderers can
  ignore the field if they don't need it.

## 6. Test plan

22 bun:test specs in `experience-rpc.test.ts` (69 expects total):

1. Handler registration smoke (3 channels registered).
2. `experience.subscribe`: permitted reader happy path, anonymous
   `permission-denied/no-user`, unrelated-workspace
   `permission-denied/no-read-grant`, malformed-envelope coverage
   (4 specs).
3. `experience.emit`: no-subscriber happy path, non-owner rejection,
   anonymous rejection, invalid-state/invalid-actor envelopes,
   global-owner cross-workspace (5 specs).
4. `experience.emit` fan-out: single-subscriber push verification
   (channel/target/payload), multi-subscriber for same actor (3
   subscribers, all delivered), cross-actor isolation, sequence
   stability across consecutive emits (4 specs).
5. `experience.unsubscribe`: release + stop-delivery, idempotent
   unknown id, bad-input rejections (empty/null), multi-subscription
   independence (3 specs).
6. `rbac-not-configured`: emit + subscribe both respond when no
   resolver is wired (1 spec).
7. `createExperienceBus`: subscriber counts/describe, clear,
   listener-exception isolation via error sink, injected id generator
   (4 specs).

## 7. Validation

- `bun test packages/server-core/src/handlers/rpc/__tests__/experience-rpc.test.ts`
  → 22 pass / 69 expects / 0 fail.
- `bun run validate:rebrand` → passes.
- `bun run validate:agent-contract` → passes (315 tickets / 11 skills /
  7 required docs).
- `bun run validate:roadmap` → passes (46 phases / 110 tickets).

## 8. LOC budget

- `experience.ts`: 154 / 300 LOC.
- `experience-bus.ts`: 121 / 150 LOC.
- `experience-rpc.test.ts`: 334 / 350 LOC.

Combined source: 275 / 300 LOC (under combined budget). Combined tests:
334 / 350 LOC.

## 9. Follow-ups

- **T273** — ipc-bridge wiring. Lifts `EXPERIENCE_CHANNELS.*` into
  `RPC_CHANNELS.experience`, classifies them in
  `LOCAL_ONLY_CHANNELS` / `REMOTE_ELIGIBLE_CHANNELS` (likely
  REMOTE_ELIGIBLE since experiences are workspace-scoped state), and
  registers the handler through `registerCoreRpcHandlers`. May also
  widen `experience.subscribe` to workspace fan-out where appropriate.
- **T080** — per-spine registry mapping. Maps the bundled-spine
  registry surfaces onto bound experiences through the T272 handler
  and the T271 hook.
- **Test-only**: T272 does NOT add a routing classification entry to
  `routing.ts` — the channels are not yet in `RPC_CHANNELS`. The
  routing exhaustiveness test continues to pass because it only
  inspects channels declared in `RPC_CHANNELS`. T273 will add the
  routing entries simultaneously with the channel declarations.
