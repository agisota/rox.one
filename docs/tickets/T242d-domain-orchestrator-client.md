# T242d-domain-orchestrator-client - Domain-Shape Orchestrator Client Hook

Status: DONE

## Context

T240 (PR #89) shipped the M.7 provider-orchestration backbone at
`packages/shared/src/agent/backend/`. T241-adapters (PR #128) added
pure fakes. T242 landed `createHostOrchestrator` at
`packages/server-core/src/orchestrator/`. T242b shipped the renderer
React hook `useOrchestrator(orchestrator)` at
`apps/electron/src/renderer/hooks/useOrchestrator.ts`.

T242c (PR #194) audited the composer surfaces in
`apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
and concluded that the two inline service constructions
(`createPromptRewriteService`, `createThinkingPartnerService`) cannot
be migrated through `useOrchestrator.dispatch` today: composer
providers accept domain-shaped requests (`PromptRewriteRequest`,
`ThinkingPartnerInput`), not kernel `ProviderRequest`. T242d ships the
adapter-aware bridge hook the audit recommended as Option (A).

## Goal

Ship `useDomainOrchestratorClient<TDomainRequest, TDomainResponse>` —
a renderer-side hook layered on top of `useOrchestrator` that accepts
a `DomainOrchestratorAdapter` and exposes a domain-shaped
`dispatch(domain) -> Promise<TDomainResponse>`. Composer call sites
can then keep their domain-shape API while their requests flow through
the T240/T242 backbone.

The new hook composes ON TOP of `useOrchestrator` (frozen by T242b)
and the T240/T241-adapters/T242 backbone — no modifications to any of
those files.

## Outcome

Hook + RTL coverage shipped at:

- `apps/electron/src/renderer/hooks/useDomainOrchestratorClient.ts`
  (143 LOC source, under the 200-LOC budget)
- `apps/electron/src/renderer/hooks/__tests__/use-domain-orchestrator-client.rtl.test.tsx`
  (300 LOC, under the 300-LOC budget)

API surface:

```ts
export interface DomainOrchestratorAdapter<TDomainRequest, TDomainResponse> {
  toProviderRequest(domain: TDomainRequest): ProviderRequest
  fromProviderResponse(response: ProviderNonStreamingResponse): TDomainResponse
}

export function useDomainOrchestratorClient<TDomainRequest, TDomainResponse>(
  options: { adapter: ...; orchestrator: Orchestrator },
): {
  dispatch(request: TDomainRequest): Promise<TDomainResponse>
  pending: boolean
  lastError: OrchestrationError | null
}
```

Error model:

- Orchestrator failures: thrown as `DomainOrchestratorError` (`.cause`
  carries the typed kernel `OrchestrationError`); `lastError` is set
  via the inner `useOrchestrator`.
- Adapter (pre-dispatch / post-response) failures: bubble up raw —
  those are wiring bugs, not orchestration errors. `lastError` stays
  clean.
- Defensive non-`send` orchestration responses synthesize a typed
  `RouteUnresolvedError` rather than letting an untyped Error escape.

## Test plan

Seven RTL cases:

1. Round-trip: domain request -> provider request -> provider response
   -> domain response.
2. Provider failure surfaces `DomainOrchestratorError` with a
   `ProviderUnavailableError` cause and populated `lastError`.
3. `pending` toggle while in-flight, then false on resolve.
4. Pre-dispatch adapter throw bubbles up raw; `lastError` stays null.
5. Post-response adapter throw bubbles up raw; `lastError` stays null.
6. Successful dispatch after a failure clears `lastError`.
7. Two back-to-back dispatches each transform independently.

## Out of scope

- Modifying `useOrchestrator.ts`, `packages/shared/src/agent/backend/`,
  or `packages/server-core/src/orchestrator/` (all frozen).
- Wiring an actual composer call site through the new hook — that is
  T242e's scope.
- Streaming support — composer domains today are non-streaming,
  deterministic synthesizers. The hook deliberately rejects unexpected
  stream responses with a typed `RouteUnresolvedError`.

## Follow-up: T242e

T242e should migrate one composer call site (likely
`createPromptRewriteService` first — simpler shape) onto
`useDomainOrchestratorClient`, providing the adapter implementation
that maps `PromptRewriteRequest` to a `ProviderRequest` whose
`messages` carry the rewrite prompt and `metadata` carries the
`audience` / `style` knobs. This unblocks the audit's "real wire"
follow-up.

## Rollback plan

Delete `apps/electron/src/renderer/hooks/useDomainOrchestratorClient.ts`,
`apps/electron/src/renderer/hooks/__tests__/use-domain-orchestrator-client.rtl.test.tsx`,
`docs/tickets/T242d-domain-orchestrator-client.md`, and the associated
worklog at `docs/worklog/T242d-domain-orchestrator-client.md`. The
backbone and existing `useOrchestrator` hook are untouched.
