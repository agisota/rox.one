# T242-orchestrator-host-composition - Orchestrator Host Composition

Status: DONE

## Context

T240 (PR #89, merged to `main`) shipped the M.7 provider-orchestration
backbone at `packages/shared/src/agent/backend/`:

- `provider-id.ts` — branded `ProviderId` + reusable `Result<T, E>`.
- `provider-registry.ts` — `ProviderHandler` contract + `ProviderRegistry`.
- `routing-policy.ts` — `RoundRobin`, `Sticky`, `Failover` factories.
- `orchestrator.ts` — `Orchestrator` class with a discriminated
  `OrchestrationError` union.

T241-adapters (PR #128) followed with two pure fake adapters
(`FakeAnthropicAdapter`, `FakeOpenAiAdapter`) that conform to the
`ProviderHandler` contract — fixtures + templates for tests and for the
real LLM-SDK adapters that land in later milestones.

The backbone is pure (no fs, no fetch, no `process.env`). What is still
missing is the **composition root**: a host-side factory that pulls a
runtime list of providers + a policy config together, validates them,
constructs the registry, materialises the policy, and exposes a single
ready-to-use `Orchestrator` instance for the rest of the server-core
runtime to dispatch through.

The `T242-orchestrator-host-composition` hyphenated slug coexists with
the existing `T242-shiki-migration-plan.md` ticket on `main` — the
roadmap-coherence validator extracts the `T\d{3}-` prefix and treats the
suffix as scope. This mirrors the precedent set by
`T241-adapters-provider-implementations.md` alongside the M.8
`T241-durable-mission-scheduler.md` and the `T243-rpc-...` / `T243-rbac-...`
pair already on `main`.

## Goal

Ship the composition root for the M.7 backbone in `@rox-one/server-core`,
backed by a parser for a serialisable config payload and a focused
`bun:test` suite that exercises empty / single / multi-provider paths +
the parser's full error surface. The factory must:

1. Accept a runtime list of constructed `ProviderHandler` instances
   (provider construction stays a host concern — adapters carry
   credentials/clients which are not serialisable).
2. Validate the list: ≥ 1 handler, unique ids.
3. Construct the `ProviderRegistry` and register every handler.
4. Materialise the `RoutingPolicy` from a `RoutingPolicySpec` (data —
   `round-robin | sticky | failover`).
5. Cross-check `failover.primary` and every `failover.fallbacks[i]` are
   registered; report typed errors when they are not.
6. Return a `Result<HostOrchestratorHandle, HostOrchestratorError>` so
   callers can branch without `try/catch`.

A second entry point, `parseHostConfig(json)`, validates an incoming
config payload (an already-JS-parsed object) and returns
`Result<HostOrchestratorConfig, HostConfigParseError>`. The host may
hand-roll the config, load it from disk, or receive it over IPC; the
parser is the gate.

## Required UI

None. Pure server-side composition layer.

## Required Data/API

- New package internal surface in `@rox-one/server-core`:
  - `packages/server-core/src/orchestrator/host.ts`
  - `packages/server-core/src/orchestrator/host-config.ts`
  - `packages/server-core/src/orchestrator/index.ts`
  - `packages/server-core/src/orchestrator/__tests__/host.test.ts`
- Imports only the T240 backbone types from
  `@rox-one/shared/agent/backend/*`. The T240 / T241-adapters source
  remains **frozen** — no edits.

## Public surface

```ts
import {
  createHostOrchestrator,
  createHostOrchestratorOrThrow,
  createHostOrchestratorFromConfig,
  parseHostConfig,
  ROUTING_POLICY_KINDS,
  describeHostError,
  type HostOrchestratorHandle,
  type HostOrchestratorError,
  type HostOrchestratorConfig,
  type RoutingPolicySpec,
} from '@rox-one/server-core/src/orchestrator'
```

The handle exposes `{ orchestrator, registry, policy, budget? }` so
tests and observability can introspect the assembled host.

## Out of scope

- Real LLM-SDK adapter wiring (Anthropic / OpenAI / Bedrock / etc.) —
  follow-up T242b will plug constructed real adapters into this factory
  from the bootstrap layer.
- Renderer-side wiring (T242b will surface the orchestrator over IPC).
- Mutation of `packages/shared/src/agent/backend/` (T240 + T241-adapters
  remain frozen by contract).

## Rollback plan

Delete `packages/server-core/src/orchestrator/`. No other file is
modified — the rollback is a single directory removal. The T240
backbone and the T241-adapters fakes are untouched.
