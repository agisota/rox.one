# T242c-composer-orchestrator-wire - Composer Orchestrator Wiring

Status: DONE (audit-only — wiring blocked, see audit doc)

## Context

T240 (PR #89) shipped the M.7 provider-orchestration backbone at
`packages/shared/src/agent/backend/`. T241-adapters (PR #128) added
pure fakes. T242 landed `createHostOrchestrator` at
`packages/server-core/src/orchestrator/`. T242b shipped the renderer
React hook `useOrchestrator(orchestrator)` at
`apps/electron/src/renderer/hooks/useOrchestrator.ts`.

T242c is the *smallest possible* integration: identify one composer
call site in `FreeFormInput.tsx` that constructs a provider/agent
inline and route it through `useOrchestrator`.

## Goal

1. Audit `FreeFormInput.tsx` (3334 LOC) for every inline provider /
   agent construction.
2. Publish an audit doc at
   `docs/release/m7-composer-orchestrator-audit.md` listing call sites
   and recommending the safest migration candidate.
3. Migrate **one** call site through `useOrchestrator` if safe;
   otherwise document the blocker and ship audit-only.

## Outcome

**Audit shipped. Wiring blocked.** Two inline call sites exist
(lines 1912–1919 of `FreeFormInput.tsx`):

- `createPromptRewriteService({ provider: createDeterministicPromptRewriteProvider() })`
- `createThinkingPartnerService({ provider: createDeterministicThinkingPartnerProvider() })`

Both are deterministic, in-process, domain-shaped (operate on
`PromptRewriteRequest` / `ThinkingPartnerRequest`, not the kernel
`ProviderRequest` the orchestrator multiplexes). Migrating either
requires an adapter layer that does not exist on `main` and would blow
T242c's "≤80 LOC source changes" budget. Full rationale lives in
`docs/release/m7-composer-orchestrator-audit.md`.

The chat-session submit path (`submitMessage`, lines 1487–1532) does
**not** construct a provider — it forwards through the `onSubmit`
prop. Not a wiring candidate for T242c.

## Out of scope

- Modifying `packages/shared/src/agent/backend/`,
  `packages/server-core/src/orchestrator/`, or
  `apps/electron/src/renderer/hooks/useOrchestrator.ts` (T240 / T242 /
  T242b remain frozen).
- Building the renderer-side domain-shaped client (`rewritePrompt`,
  `thinkPartner`, `chat`) — that is T242d's scope.
- Refactoring the deterministic composer providers off the in-process
  synthesizer path.

## Follow-up: T242d

The audit recommends T242d land **one** of:

- A higher-level renderer hook (e.g. `useOrchestratorAgentClient`) that
  exposes domain-shaped methods and internally adapts to the kernel
  `ProviderRequest`.
- A non-deterministic prompt-rewrite / thinking-partner provider that
  round-trips through an LLM — at which point the existing inline call
  sites become natural `useOrchestrator.dispatch` consumers.

## Rollback plan

Delete `docs/release/m7-composer-orchestrator-audit.md`,
`docs/tickets/T242c-composer-orchestrator-wire.md`, and the associated
worklog at `docs/worklog/T242c-composer-orchestrator-wire.md`. No
source files are modified.
