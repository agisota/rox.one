# M.7 T242c — Composer Orchestrator Wiring Audit

Status: AUDIT-ONLY (wiring blocked by shape mismatch — see "Decision")
Author: T242c agent
Date: 2026-05-14
Branch: `feat/M7-T242c-composer-orchestrator-wire`

## Scope

T240 (backbone) + T241-adapters + T242 (host composition) + T242b
(`useOrchestrator` hook) are all on `main`. T242c is the **smallest
possible** integration: locate one composer call site that constructs a
provider/agent inline and route it through `useOrchestrator`.

This audit covers `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
(3334 LOC). The component is the chat composer and the only renderer
surface where the composer agent dispatches today.

## Call sites that construct a provider/agent inline

Two — and only two — call sites in `FreeFormInput.tsx` instantiate a
provider/service pair directly inside the component body. Both are
domain-specific composer features, not the LLM provider path:

| # | Line(s) | Call expression | Domain |
|---|---------|------------------|--------|
| 1 | 1912–1915 | `createPromptRewriteService({ provider: createDeterministicPromptRewriteProvider() })` | Prompt rewrite (in-composer) |
| 2 | 1916–1919 | `createThinkingPartnerService({ provider: createDeterministicThinkingPartnerProvider() })` | Thinking-partner round-table |

Both providers live in `@rox-one/shared/workbench/` and are built around
`createDeterministic*Provider` factories — pure, in-process,
deterministic synthesizers (no network, no LLM call). The services they
return expose domain-shaped methods:

- `PromptRewriteService.rewrite(request: PromptRewriteRequest): Promise<PromptRewriteOutput>`
- `ThinkingPartnerService.think(request: ThinkingPartnerRequest): Promise<ThinkingPartnerOutput>`

`FreeFormInput.tsx`'s submit path (`submitMessage`, lines 1487–1532)
does **not** construct a provider — it forwards through the `onSubmit`
prop to the chat session backbone. The submit path is not a candidate
for T242c.

## Decision: migration is blocked at T242c

The two inline call sites cannot be safely migrated through
`useOrchestrator(orchestrator)` today. Rationale:

1. **Shape mismatch.** `useOrchestrator.dispatch(req)` accepts
   `OrchestrationRequest`, which wraps a kernel `ProviderRequest`
   (`{ model, messages, ... }` — LLM-shaped). The composer providers
   accept `PromptRewriteRequest` / `ThinkingPartnerRequest`
   (domain-shaped, no `model` or `messages`). Bridging them requires an
   adapter layer that does not yet exist on `main`.
2. **No LLM round-trip.** The current composer providers are
   *deterministic synthesizers* — they never reach an LLM. Routing them
   through the orchestrator (which exists to multiplex LLM provider
   handlers) would add ceremony without product value.
3. **Frozen-source constraint.** T242c forbids edits to
   `packages/shared/src/agent/backend/`,
   `packages/server-core/src/orchestrator/`, and `useOrchestrator.ts` —
   so a `PromptRewriteProvider → ProviderHandler` adapter would have to
   live outside the backbone and would still need a domain-→
   `ProviderRequest` transformer the backbone never sees.
4. **Budget overrun risk.** Wiring even one call site requires (a) a
   new adapter file, (b) a wrapping `ProviderHandler` for the
   deterministic provider, and (c) a request-shape transformer — far
   outside the "≤80 LOC source changes" budget for a surgical wire.

## What unblocks T242d (recommended follow-up)

A future ticket should land **one** of:

- **(A)** A renderer-side `useOrchestratorAgentClient` higher-level
  hook that exposes domain-shaped methods (`rewritePrompt`,
  `thinkPartner`, `chat`) and internally adapts them to
  `OrchestrationRequest`. Composer consumers depend only on the
  domain-shaped surface; provider construction moves to the host
  composition root.
- **(B)** A non-deterministic prompt-rewrite/thinking-partner provider
  that *does* round-trip through an LLM (still injected at the host
  level, never inline in the composer), at which point the call site
  becomes a natural `useOrchestrator.dispatch` consumer.

Both unblock a meaningful T242c-style wire. Until either lands, the
composer call sites stay on the inline-deterministic-provider path; the
hook stays available for the chat-session dispatch surface, which is
already domain-aligned with `OrchestrationRequest` (LLM-shaped) and is
the natural next migration target.

## Files inspected

- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
  (3334 LOC)
- `apps/electron/src/renderer/hooks/useOrchestrator.ts` (T242b, frozen)
- `packages/shared/src/workbench/prompt-rewrite-engine.ts`
- `packages/shared/src/workbench/thinking-partner.ts`
- `packages/shared/src/agent/backend/orchestrator.ts` (T240, frozen)
- `packages/shared/src/agent/backend/provider-registry.ts` (T240, frozen)
- `docs/tickets/T242b-renderer-orchestrator-hook.md`

## Outcome

Audit ships. **No wiring change in this PR.** T242c remains "DONE" as
an audit-only deliverable; a follow-up ticket (T242d) should land the
domain-shaped client hook or move composer providers off the
deterministic in-process path before a real wire is attempted.
