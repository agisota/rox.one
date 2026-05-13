# T240 - Provider Orchestration Backbone

Status: DONE

## Context

M.7 (multi-provider runtime) needs a pure-function orchestration layer that
the rest of the agent backend can grow into. Today
`packages/shared/src/agent/backend/` ships a Claude / Pi factory plus the
single-provider `factory.ts`. There is no shared abstraction for routing
between providers, no failover policy, and the existing
`internal/drivers/*` adapters are wired directly into the factory.

T240 lands the missing seam: a branded `ProviderId`, a `ProviderRegistry`,
three stateless routing policies (`RoundRobin`, `Sticky`, `Failover`), and
an `Orchestrator` that ties them together via a typed
`OrchestrationRequest` -> `OrchestrationResponse` surface with a
discriminated `OrchestrationError` union.

Real adapters that wrap LLM SDKs are explicitly out of scope — those land
in T241. The backbone here is pure: no fs, no fetch, no `process.env`.

## Goal

Ship the four pure modules above plus a `bun:test` suite that drives them
end-to-end through a `FakeProvider`. The orchestrator must:

1. Resolve candidates from the registry (defaulting to every registered id).
2. Consult the routing policy for each attempt, skipping providers in
   `recentFailures` and providers whose `healthy()` returns false.
3. Surface errors via a discriminated union — never throw across the API
   boundary.
4. Forward streaming events from the chosen handler unchanged, while still
   catching synchronous errors raised inside the generator body.

## Required Modules

- `packages/shared/src/agent/backend/provider-id.ts` — branded
  `ProviderId` (`anthropic | openai | google | azure-openai | bedrock |
  ollama`), `parseProviderId`, `isProviderId`, `unsafeProviderId`,
  `providerIdToString`, plus a `Result<T, E>` envelope reused across the
  backbone.
- `packages/shared/src/agent/backend/provider-registry.ts` —
  `ProviderHandler` contract, request/response types
  (`ProviderRequest`, `ProviderMessage`, `ProviderUsage`,
  `ProviderResponseChunk`, `ProviderResponseEnd`,
  `ProviderStreamEvent`, `ProviderNonStreamingResponse`), and the
  `ProviderRegistry` class (`register`, `resolve`, `listIds`,
  `listHandlers`, `has`, `size`, `unregister`, `clear`).
- `packages/shared/src/agent/backend/routing-policy.ts` —
  `createRoundRobinPolicy()`, `createStickyPolicy(byHash?)`,
  `createFailoverPolicy({primary, fallbacks})`, and `defaultStickyHash`.
- `packages/shared/src/agent/backend/orchestrator.ts` — `Orchestrator`
  class with `send` + `stream` methods, `OrchestrationError` discriminated
  union (`ProviderUnavailableError`, `BudgetExceededError`,
  `RateLimitedError`, `RouteUnresolvedError`), `OrchestrationAttempt`
  trail, and a `primeStream` helper that surfaces synchronous generator
  errors before reporting `'stream'` success.

## Required Tests

Single test file:
`packages/shared/src/agent/backend/__tests__/orchestrator.test.ts`.

- 35 `bun:test` cases (>=40 `expect()` calls target — current 91).
- One `FakeProvider` helper covers every test (no real-provider mocks).
- Empty-registry, unknown-provider, and 3-chunk streaming paths are all
  exercised end-to-end.

## Required Data/API

No persistence, no IPC. Registry is in-memory and bounded by the
provider-id closed set. Failure trail is returned in the
`OrchestrationResponse`; callers can log it however they like.

## Required UI

None.

## Required Automations

None. Adapter implementations (T241) will register handlers on startup.

## Required Subagents

None — pure backbone surface.

## Implementation Requirements

- No `any`; `satisfies` on discriminated unions.
- `Result<T, E>` envelope on every fallible boundary (`parseProviderId`,
  `Orchestrator.send`, `Orchestrator.stream`, `selectProvider`).
- Pure modules: no fs, no fetch, no `process.env`. Clock is injectable.
- Source budget ~700 LOC; test budget ~400 LOC (current: 715 / 484).
- Only `FakeProvider` lives in tests — no real-SDK mocking.

## Validation Commands

- `bun test packages/shared/src/agent/backend/__tests__/orchestrator.test.ts`
- `bun run validate:rebrand`
- `bun run validate:agent-contract`
- `bun run validate:roadmap`

## Acceptance Criteria

- [x] All four modules ship with no `any` and no `process.env` access.
- [x] 35 bun:test cases green; 91 `expect()` calls.
- [x] Streaming path yields three chunks plus an `'end'` event via the
      `FakeProvider`.
- [x] Discriminated `OrchestrationError` union has all four named cases.
- [x] `validate:rebrand` exit 0.
- [x] `validate:agent-contract` exit 0.
- [x] `validate:roadmap` exit 0.
- [x] No `.swarm/master-roadmap-log.md` touch.
- [x] Worklog at `docs/worklog/T240-provider-orchestration-backbone.md`.

## Worklog

See `docs/worklog/T240-provider-orchestration-backbone.md`.
