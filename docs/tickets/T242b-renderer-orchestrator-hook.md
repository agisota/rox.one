# T242b-renderer-orchestrator-hook - Renderer Orchestrator React Hook

Status: DONE

## Context

T240 (PR #89, merged to `main`) shipped the M.7 provider-orchestration
backbone at `packages/shared/src/agent/backend/`:

- `provider-id.ts` — branded `ProviderId` + reusable `Result<T, E>`.
- `provider-registry.ts` — `ProviderHandler` contract + `ProviderRegistry`.
- `routing-policy.ts` — `RoundRobin`, `Sticky`, `Failover` factories.
- `orchestrator.ts` — `Orchestrator` class with a discriminated
  `OrchestrationError` union and a streaming + non-streaming dispatch
  surface.

T241-adapters (PR #128) followed with two pure fake adapters
(`FakeAnthropicAdapter`, `FakeOpenAiAdapter`) that conform to the
`ProviderHandler` contract.

T242 (PR #*) added the host-side composition root at
`packages/server-core/src/orchestrator/` — a factory that validates a
runtime provider list + a `RoutingPolicySpec` and returns a ready-to-use
`Orchestrator` instance plus the underlying `registry`, `policy`, and
optional `budget` knobs.

What is still missing is the **renderer-side React hook** that wraps a
constructed `Orchestrator` so React components can dispatch
non-streaming requests, consume streaming chunks via
`for await`, and observe a single canonical `pending` flag + a typed
`lastError` snapshot. Every renderer surface that wants to talk to the
orchestration backbone today has to hand-roll lifecycle accounting,
which is exactly the kind of repeated wiring a thin renderer adapter
should absorb.

## Goal

Ship the renderer-side React hook for the M.7 backbone in
`@rox-one/electron`. The hook must:

1. Accept a constructed `Orchestrator` instance.
2. Expose `dispatch(request) → Promise<OrchestrationResponse>` for the
   non-streaming `send` path. The full response object is returned so
   callers can introspect `.ok` / `.mode` / `.value` / `.error` exactly
   like they would when calling the orchestrator directly.
3. Expose `stream(request) → AsyncIterableIterator<OrchestrationChunk>`
   for the streaming `stream` path. Each chunk re-uses the kernel
   `ProviderStreamEvent` type so consumers do not have to invent a
   parallel chunk shape.
4. Surface a `pending: boolean` flag that stays true for the lifetime
   of every in-flight `dispatch` *or* `stream` call (including overlapping
   calls — a counter, not a boolean toggle).
5. Surface `lastError: OrchestrationError | null` — populated on every
   non-`ok` outcome, cleared at the start of every new call, stable
   typed across the discriminated union.
6. Clean up any in-flight subscriptions on unmount and never call
   `setState` after the host component has gone away.

## Required UI

None. The hook is a pure renderer-side adapter. T242c (composer wiring)
plugs the hook into the chat composer and the workbench dispatch
surfaces.

## Required Data/API

- New package-internal surface in `@rox-one/electron`:
  - `apps/electron/src/renderer/hooks/useOrchestrator.ts`
  - `apps/electron/src/renderer/hooks/__tests__/use-orchestrator.rtl.test.tsx`
- Imports only the T240 backbone types from
  `packages/shared/src/agent/backend/*` via deep relative paths — the
  `./agent/backend/*` subpaths are not yet re-exported through the
  package's `./agent` barrel, so the relative path keeps the renderer's
  vite resolver and the shared `tsconfig` happy without modifying the
  frozen T240 / T241-adapters / T242 source trees.

## Public surface

```ts
import { useOrchestrator, type OrchestrationChunk } from '@/hooks/useOrchestrator'

const r = useOrchestrator(orchestrator)

const response = await r.dispatch({ request })           // OrchestrationResponse (mode === 'send')
for await (const chunk of r.stream({ request })) { ... } // ProviderStreamEvent
r.pending                                                  // boolean
r.lastError                                                // OrchestrationError | null
```

`OrchestrationChunk` is a type alias for the kernel `ProviderStreamEvent`,
re-exported from the hook module so renderer consumers don't have to
reach across subpaths.

## Out of scope

- Composer wiring (T242c will mount the hook from the chat composer +
  workbench experiences).
- Real LLM-SDK adapter wiring — orchestration of constructed real
  adapters from the bootstrap layer is owned by T242 (host composition)
  and any follow-up bootstrap tickets.
- IPC plumbing for cross-process orchestrators — the hook accepts an
  in-process `Orchestrator` and does not assume an IPC envelope.
- Mutation of `packages/shared/src/agent/backend/` (T240 / T241-adapters
  remain frozen) or `packages/server-core/src/orchestrator/` (T242
  remains frozen).

## Rollback plan

Delete `apps/electron/src/renderer/hooks/useOrchestrator.ts` and
`apps/electron/src/renderer/hooks/__tests__/use-orchestrator.rtl.test.tsx`.
No other file is modified. The T240 backbone, the T241-adapters fakes,
and the T242 host composition are untouched.
