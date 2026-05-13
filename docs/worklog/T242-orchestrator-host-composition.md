# T242-orchestrator-host-composition - Orchestrator Host Composition

Status: DONE

## 1. Task summary

Land the host-side composition root for the M.7 provider-orchestration
backbone that T240 shipped (`packages/shared/src/agent/backend/`) and
T241-adapters extended with two pure fake adapters. The composition root
lives in `@rox-one/server-core` and exposes a single factory that:

- accepts a runtime list of constructed `ProviderHandler` instances
- validates the list (≥ 1 handler, unique ids)
- materialises a `RoutingPolicy` from a serialisable spec
  (`round-robin | sticky | failover`)
- cross-checks failover primary + fallbacks against the registered set
- returns a `Result<HostOrchestratorHandle, HostOrchestratorError>` so
  callers can branch without `try/catch`

A sibling `parseHostConfig(json)` entry point validates an incoming
data-only payload (policy spec + optional budget knobs) and returns a
typed result on the same `Result<T, E>` envelope.

## 2. Repo context discovered

- T240 (PR #89) landed the backbone on `main`. The four modules are
  intact:
  - `provider-id.ts` — branded `ProviderId`, `parseProviderId`,
    `unsafeProviderId`, `Result<T, E>`.
  - `provider-registry.ts` — `ProviderHandler` (`id`, `healthy`,
    `send`, `stream`) + `ProviderRegistry` store.
  - `routing-policy.ts` — `createRoundRobinPolicy`,
    `createStickyPolicy`, `createFailoverPolicy({ primary, fallbacks })`.
  - `orchestrator.ts` — `Orchestrator` class with
    `OrchestrationError` discriminated union and an `OrchestratorClock`
    injection point.
- T241-adapters (PR #128) shipped `FakeAnthropicAdapter` +
  `FakeOpenAiAdapter` at
  `packages/shared/src/agent/backend/adapters/`. They expose canned
  responses, failure modes that map onto the orchestrator's
  `classifyError`, and observation counters. They are the only
  `ProviderHandler` implementations available on `main` today and are
  the natural fixtures for T242's tests.
- `@rox-one/server-core` already depends on `@rox-one/shared` and
  resolves subpaths via the tsconfig `paths` map
  (`"@rox-one/shared/*": ["../shared/src/*"]`), so importing the
  backbone files directly is the established pattern (used by
  `model-fetchers/*`, `sessions/*`, `handlers/rpc/llm-connections.ts`).
- Two `T242-` tickets coexisting in `docs/tickets/` is fine: the
  roadmap-coherence validator extracts the `T\d{3}-` prefix and treats
  the rest of the slug as scope (matching the pattern set by
  `T243-rpc-missions-handlers.md` / `T243-rbac-...`).
- `bun:test` is the established harness across `packages/server-core`
  (`provider-gateway`, `audit`, `bootstrap`, etc.).
- `validate:agent-contract` and `validate:roadmap` both fail on
  `main` at the latest commit (`2a27f5f8`) for unrelated reasons
  (`T223-tenant-credential-key-derivation.md` uses `## Status` instead
  of `Status:` and the spine ledger references phase `M.1.3b` that has
  no matching heading in its owner file). Those pre-existing failures
  are not introduced by T242 and are out of scope for this branch.

## 3. Files inspected

- `packages/shared/src/agent/backend/provider-id.ts`
- `packages/shared/src/agent/backend/provider-registry.ts`
- `packages/shared/src/agent/backend/routing-policy.ts`
- `packages/shared/src/agent/backend/orchestrator.ts`
- `packages/shared/src/agent/backend/adapters/index.ts`
- `packages/shared/src/agent/backend/adapters/fake-anthropic-adapter.ts`
- `packages/server-core/package.json`
- `packages/server-core/tsconfig.json`
- `packages/server-core/src/provider-gateway/provider-gateway.ts` (style ref)
- `packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts` (style ref)
- `docs/tickets/T241-adapters-provider-implementations.md`
- `docs/worklog/T241-adapters-provider-implementations.md`

## 4. Files created

- `packages/server-core/src/orchestrator/host.ts` (131 LOC)
- `packages/server-core/src/orchestrator/host-config.ts` (134 LOC)
- `packages/server-core/src/orchestrator/index.ts` (30 LOC)
- `packages/server-core/src/orchestrator/__tests__/host.test.ts`
  (345 LOC, 27 `it` cases, 57 `expect()` calls)
- `docs/tickets/T242-orchestrator-host-composition.md`
- `docs/worklog/T242-orchestrator-host-composition.md` (this file)

Source: 295 LOC (within the ≤300 budget). Tests: 345 LOC (within the
≤350 budget).

## 5. Files modified

None outside the new ticket + worklog. The T240 backbone and the
T241-adapters fakes are frozen as instructed.

## 6. Test surface

`__tests__/host.test.ts` covers:

1. **Validation path**
   - empty providers → `NoProviders` error
   - duplicate ids → `DuplicateProvider` error
   - failover primary not registered → `FailoverPrimaryMissing`
   - failover fallback not registered → `FailoverFallbackMissing`
2. **Single provider dispatch**
   - canned-response round trip via `Orchestrator.send`
   - clock injection observable in `attempt.at` values
3. **Failover policy end-to-end**
   - primary healthy → primary serves the request
   - primary throws `unavailable` → fallback serves; both `sendCalls`
     counters increment; failed attempt is recorded
4. **Sticky / round-robin policy**
   - sticky pins the same `routingKey` to the same provider across calls
   - round-robin spreads consecutive calls across the two providers
5. **`createHostOrchestratorOrThrow`**
   - returns a handle on success
   - throws a descriptive `Error` on misconfig (matches `/NoProviders/`)
6. **`createHostOrchestratorFromConfig`**
   - reads `HostBudgetConfig` from the parsed config and surfaces it on
     the handle
   - threads the optional clock through the config path
7. **`parseHostConfig`**
   - minimal round-robin config
   - failover config with two fallbacks + full budget
   - non-object input → `NotAnObject`
   - missing policy → `MissingPolicy`
   - unknown policy kind → `UnknownPolicyKind` with `received` +
     `allowed` populated
   - missing failover primary → `InvalidProviderId`
   - non-array fallbacks → `InvalidPolicyShape`
   - unknown provider id in fallbacks → `InvalidProviderId` with
     `field === 'policy.fallbacks[0]'`
   - negative / non-finite budget values → `InvalidBudget`
   - sticky policy spec accepted
8. **`describeHostError`** formats every variant
9. **Composition with a custom (non-adapter) handler** — proves the
   factory is adapter-agnostic; only the `ProviderHandler` contract
   matters

Run:

```bash
bun test packages/server-core/src/orchestrator/__tests__/host.test.ts
# bun test v1.3.13
#  27 pass
#  0 fail
#  57 expect() calls
```

## 7. Validation

- `bun test packages/server-core/src/orchestrator/__tests__/host.test.ts`
  → 27 pass / 0 fail / 57 expect() calls.
- `cd packages/server-core && bun run tsc --noEmit` → clean.
- `bun run validate:rebrand` → passes (no forbidden tokens).
- `bun run validate:agent-contract` → fails on `T223` pre-existing
  contract drift (`## Status` vs `Status:`) unrelated to T242.
- `bun run validate:roadmap` → fails on pre-existing M.1.3b heading
  drift in the spine ledger unrelated to T242.

The two pre-existing validator failures predate this branch (latest
`main` HEAD `2a27f5f8`); they are tracked as separate repair tickets in
`docs/worklog/`.

## 8. Pure-module invariants

- No `fs`, no `fetch`, no `process.env` access in either source file.
- No `Date.now()` directly — the optional `OrchestratorClock` flows
  straight through to the T240 `Orchestrator`.
- No new external dependencies. The composition root re-uses the
  `Result<T, E>` envelope from `provider-id.ts` rather than defining a
  parallel error type.
- The factory itself never imports adapter modules. Providers are
  constructed by the host and handed in as an opaque
  `readonly ProviderHandler[]`.

## 9. Rollback plan

Delete `packages/server-core/src/orchestrator/`. No other file is
modified. The T240 + T241-adapters source trees remain untouched.

## 10. Follow-up — T242b

The follow-up renderer wiring (T242b) plugs constructed real Anthropic
/ OpenAI / Bedrock adapters into `createHostOrchestrator` from the
server-core bootstrap layer and surfaces the orchestrator over IPC for
the renderer. Out of scope here.
