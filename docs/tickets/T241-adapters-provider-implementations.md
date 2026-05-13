# T241-adapters - Provider Adapter Implementations (Fakes)

Status: DONE

## Context

T240 (PR #89, merged to `main`) shipped the M.7 provider-orchestration
backbone at `packages/shared/src/agent/backend/`:

- `provider-id.ts` — branded `ProviderId` union (`anthropic | openai | google | azure-openai | bedrock | ollama`) plus a `Result<T, E>` envelope.
- `provider-registry.ts` — `ProviderHandler` contract (`id`, `healthy()`, `send`, `stream`) and the `ProviderRegistry` store.
- `routing-policy.ts` — three stateless policies (`RoundRobin`, `Sticky`, `Failover`).
- `orchestrator.ts` — `Orchestrator` class with discriminated `OrchestrationError` union.

The backbone is **pure** — no fs, no fetch, no `process.env`. Real
adapters that wrap LLM SDKs were explicitly deferred. T241-adapters
takes the first step: two **pure fake** adapters that conform to the
`ProviderHandler` contract and prove the orchestration surface composes
end-to-end. The `T241-adapters` hyphenated suffix avoids collision with
the M.8 missions kernel `T241` ticket already on `main` — the
roadmap-coherence validator extracts the `T\d{3}-` prefix and treats the
suffix as scope, mirroring the existing `T243-rpc` pattern.

## Goal

Ship two fake adapter implementations + a barrel + a focused test
suite + a compose-test that drives the registry, the failover policy,
and the orchestrator together through both fakes. The adapters must:

1. Implement the `ProviderHandler` interface from `provider-registry.ts`
   without re-defining any of its types.
2. Reuse the existing `Result<T, E>` envelope from `provider-id.ts`.
3. Surface configurable failure modes that map onto the orchestrator's
   `classifyError` heuristics (`PROVIDER_UNAVAILABLE`, `RATE_LIMITED`).
4. Stay ≤300 LOC each.
5. Have **zero** external dependencies — they are templates first,
   fixtures second.

## Deliverables

- `packages/shared/src/agent/backend/adapters/fake-anthropic-adapter.ts`
- `packages/shared/src/agent/backend/adapters/fake-openai-adapter.ts`
- `packages/shared/src/agent/backend/adapters/index.ts` (barrel)
- `packages/shared/src/agent/backend/__tests__/fake-anthropic-adapter.test.ts` (22 cases, 55 expect() calls)
- `packages/shared/src/agent/backend/__tests__/fake-openai-adapter.test.ts` (22 cases, 53 expect() calls)
- `packages/shared/src/agent/backend/__tests__/fake-adapters-compose.test.ts` (4 cases, 27 expect() calls)
- This ticket + the worklog in `docs/worklog/T241-adapters-provider-implementations.md`.

## Out of scope

- Real SDK adapters wrapping `@anthropic-ai/sdk` or `openai` — those
  land in T242 and will be re-exported from the same barrel.
- Any modification of `provider-id.ts`, `provider-registry.ts`,
  `routing-policy.ts`, or `orchestrator.ts` (the T240 surface).
- Any change to `factory.ts`, `claude-agent.ts`, or `pi-agent.ts` — the
  live agent backends remain on their existing factory path. The
  orchestration backbone is parallel infrastructure.

## Acceptance

- `bun test packages/shared/src/agent/backend/__tests__/fake-*` green.
- The compose-test asserts:
  - happy-path send routes to the primary,
  - primary `healthy: false` triggers failover with both
    `unavailable` + `success` recorded in the attempt trail,
  - streaming honours the same failover and forwards chunk + end events.
- `bun run validate:rebrand`, `bun run validate:agent-contract`, and
  `bun run validate:roadmap` pass.
