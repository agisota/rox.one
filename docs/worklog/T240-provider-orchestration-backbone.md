# T240 - Provider Orchestration Backbone

Status: DONE

## 1. Task summary

Land the M.7 provider-orchestration backbone in
`packages/shared/src/agent/backend/`. Four pure modules — branded
`ProviderId`, `ProviderRegistry`, three routing policies (`RoundRobin`,
`Sticky`, `Failover`), and an `Orchestrator` that ties them together via
a typed request/response with a discriminated `OrchestrationError` union.
Tests drive everything through a single `FakeProvider` helper, including
a 3-chunk streaming path. Real LLM-adapter implementations are deferred
to T241; renderer wiring is deferred to T242.

## 2. Repo context discovered

- `packages/shared/src/agent/backend/` already has a Claude/Pi factory
  (`factory.ts`) and `internal/drivers/{anthropic,pi}.ts`. The new
  backbone sits beside them with zero imports back into the factory —
  this keeps the abstraction pure and lets T241 register adapters
  without disturbing the existing call sites.
- `bun:test` is the canonical unit-test runner in the shared package
  (see `read-patterns.test.ts`, `factory.test.ts`). Test files live in
  `__tests__/` adjacent to the modules they cover.
- The repo does not have a pre-existing `Result<T, E>` helper —
  `grep -rln "type Result<" packages/shared/src` returns nothing — so
  the backbone exports its own envelope from `provider-id.ts` and reuses
  it across the orchestrator.
- `validate:rebrand` allowlists everything under `docs/tickets/T*.md`
  and `docs/worklog/T*.md`; the new doc files therefore do not require
  separate exemptions.
- The pre-existing `read-patterns.test.ts` errors with `Cannot find
  package 'bash-parser'` on this worktree. The new orchestrator suite is
  not affected — it imports only the four new modules.

## 3. Files inspected

- `packages/shared/src/agent/backend/index.ts`
- `packages/shared/src/agent/backend/types.ts`
- `packages/shared/src/agent/backend/factory.ts`
- `packages/shared/src/agent/backend/__tests__/factory.test.ts`
- `packages/shared/src/agent/backend/__tests__/read-patterns.test.ts`
- `scripts/validate-rebrand.cjs`
- `scripts/validate-agent-contract.ts`
- `package.json`
- `docs/tickets/T234-composer-pillar-4-history.md` (for ticket shape)
- `docs/worklog/T234-composer-pillar-4-history.md` (for worklog shape)

## 4. Tests added first

Single colocated suite: `__tests__/orchestrator.test.ts`. Written before
the implementations were filled in. First run failed with
`Cannot find module '../provider-id'` etc.; once each source file landed
the relevant block went green. Final run: 35 cases, 91 `expect()` calls,
0 failures.

## 5. Expected failing test output

```
$ bun test packages/shared/src/agent/backend/__tests__/orchestrator.test.ts
error: Cannot find module '../provider-id' from
  '.../__tests__/orchestrator.test.ts'

 0 pass
 1 fail
```

Two iteration loops were needed after the first all-green run:

- `Orchestrator.send` with `budget.maxAttempts: 0` initially fell through
  to `ProviderUnavailableError` because the outer loop also defaults
  `maxAttempts ?? candidates.length`. Fixed by short-circuiting to
  `BudgetExceededError { metric: 'attempts', used: 0 }` before the loop.
- `Orchestrator.stream` initially returned `ok: true` for a generator
  that threw on first iteration. Fixed by adding a `primeStream` helper
  that consumes the first `next()` and replays it on the returned
  iterable, surfacing synchronous errors before the success report.

## 6. Implementation changes

### New: `provider-id.ts` (63 LOC)

- Closed set `PROVIDER_IDS = ['anthropic', 'openai', 'google',
  'azure-openai', 'bedrock', 'ollama']`.
- Brand symbol is local so callers cannot synthesise a `ProviderId`
  without going through `parseProviderId` / `unsafeProviderId`.
- `parseProviderId(input)` returns
  `Result<ProviderId, ProviderIdParseError>` and normalises case +
  whitespace.
- `Result<T, E>` envelope (`{ ok: true, value } | { ok: false, error }`)
  is exported from this module and reused by the orchestrator.

### New: `provider-registry.ts` (113 LOC)

- `ProviderHandler` contract: `id`, `healthy()`, `send(request)`,
  `stream(request)`.
- `ProviderRegistry` class: `register`, `resolve`, `listIds`,
  `listHandlers`, `has`, `size`, `unregister`, `clear`. Throws on
  duplicate registration unless `{ replace: true }` is passed.

### New: `routing-policy.ts` (139 LOC)

- `createRoundRobinPolicy()` — captures a per-instance counter; advances
  by one per `decide` call; skips providers in `recentFailures`.
- `createStickyPolicy(byHash?)` — hashes a routing key (default
  `defaultStickyHash` is FNV-1a-inspired) and picks
  `eligible[hash % eligible.length]`. Returns `unresolved` if no key.
- `createFailoverPolicy({primary, fallbacks})` — primary first, then
  fallbacks in order; intersected with the candidate set and minus
  `recentFailures`.

### New: `orchestrator.ts` (400 LOC)

- `Orchestrator(opts)` takes `{ registry, policy, clock? }`.
- `send(req)` -> `OrchestrationResponse` with `mode: 'send'`. Walks the
  policy up to `min(candidates.length, budget.maxAttempts)`; classifies
  errors into `unavailable | rate-limited | error`; surfaces
  `RateLimitedError` on the final attempt and
  `ProviderUnavailableError` if the loop exhausts. Enforces
  `budget.maxTokens` on successful response.
- `stream(req)` -> `OrchestrationResponse` with `mode: 'stream'`. Calls
  `primeStream` to consume the first generator event, then replays it
  on the iterable returned to callers. Synchronous generator errors are
  classified and surface as `RateLimitedError` or
  `ProviderUnavailableError`.
- `OrchestrationError` union has all four named cases. Each carries the
  full `attempts: readonly OrchestrationAttempt[]` trail so callers can
  log or display the failure history without re-running.

### New: `__tests__/orchestrator.test.ts` (484 LOC)

- 35 `bun:test` cases covering every public API of the four modules.
- Single `makeFakeProvider({...})` helper drives all suites — no real
  SDK mocking. Streaming default emits three chunks then an `'end'`
  event with usage.
- Coverage highlights: empty-registry path, unknown-provider candidate
  set, unhealthy-skip fallthrough, token-budget exceed, zero-attempts
  short-circuit, rate-limit recognition (by code and by message),
  stream error propagation, sticky policy consistency across two stream
  calls, and Failover + send end-to-end with one primary failure.

## 7. Validation commands run

```bash
bun test packages/shared/src/agent/backend/__tests__/orchestrator.test.ts
bun run validate:rebrand
bun run validate:agent-contract
bun run validate:roadmap
```

## 8. Passing test output summary

```
$ bun test packages/shared/src/agent/backend/__tests__/orchestrator.test.ts
 35 pass
 0 fail
 91 expect() calls
Ran 35 tests across 1 file. [40ms]
```

```
$ bun run validate:rebrand
rebrand validation passed: no forbidden tokens outside the allowlist
```

```
$ bun run validate:agent-contract
[agent-contract] ok: 11 skills, 248 tickets, 7 required docs
```

```
$ bun run validate:roadmap
validate:roadmap OK -- 46 phases, 111 tickets across detail files
```

The pre-existing `read-patterns.test.ts` failure (`Cannot find package
'bash-parser'`) is unrelated to this ticket — `bash-parser` is missing
from `node_modules` on both this worktree and `origin/main` HEAD.

## 9. Build output summary

No production build run. The backbone is additive and pure; no IPC,
packaging, or main-process code is touched.

## 10. Remaining risks

- **Adapter wiring lives in T241.** Real Anthropic / OpenAI / Google /
  Azure / Bedrock / Ollama drivers will register handlers via
  `ProviderRegistry.register(...)`. The brand keeps the contract honest
  but does not validate handler implementations at compile time beyond
  the `ProviderHandler` interface.
- **`Sticky` policy does not detect handler drift.** If a registered
  provider goes unhealthy between two sticky-routed calls, the policy
  still picks it; only the orchestrator's `healthy()` check skips it.
  Callers that need automatic re-sticking should fold a `Failover`
  policy in around the sticky one.
- **`OrchestrationAttempt[]` grows unbounded per request.** Acceptable
  here because retries are bounded by `min(candidates, maxAttempts)`,
  but consumers that log the trail to disk should be aware.
- **No metrics emission.** The orchestrator returns the attempt trail
  but does not yet emit OpenTelemetry / Prometheus events. T242 +
  follow-up can layer instrumentation on top.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Four modules with no `any` and no `process.env` | PASS | `grep -n 'any\\b' packages/shared/src/agent/backend/{provider-id,provider-registry,routing-policy,orchestrator}.ts` -- no hits |
| 35 bun:test cases green; >=40 expect() calls | PASS | `35 pass / 0 fail / 91 expect() calls` |
| Streaming path yields 3 chunks + `'end'` | PASS | `streams three chunks from a FakeProvider then ends` |
| Discriminated `OrchestrationError` union has 4 named cases | PASS | `ProviderUnavailableError`, `BudgetExceededError`, `RateLimitedError`, `RouteUnresolvedError` in `orchestrator.ts` |
| `validate:rebrand` exit 0 | PASS | Output above |
| `validate:agent-contract` exit 0 | PASS | Output above |
| `validate:roadmap` exit 0 | PASS | Output above |
| `.swarm/master-roadmap-log.md` not touched | PASS | `git status` does not list it |
| Worklog complete | PASS | This file |
