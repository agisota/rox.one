# T241-adapters - Provider Adapter Implementations (Fakes)

Status: DONE

## 1. Task summary

Land two pure fake provider adapters that conform to the
`ProviderHandler` contract shipped by T240's orchestration backbone
(`packages/shared/src/agent/backend/`). The adapters are
**fixtures + templates**: they never touch the network, the filesystem,
or `process.env`. A compose-test wires both fakes into a
`ProviderRegistry` with a `Failover` policy and dispatches one request
through `Orchestrator` end-to-end so the integration is provable from
the existing public surface alone.

## 2. Repo context discovered

- T240 (PR #89) landed the backbone on `main` at commit
  `de1c124a` (latest `main` HEAD when this branch was forked). The four
  modules are intact:
  - `provider-id.ts` — branded `ProviderId` + reusable `Result<T, E>`.
  - `provider-registry.ts` — `ProviderHandler` contract + registry.
  - `routing-policy.ts` — `RoundRobin`, `Sticky`, `Failover` factories.
  - `orchestrator.ts` — `Orchestrator` class with discriminated
    `OrchestrationError` union and a `primeStream` helper.
- T240's own `__tests__/orchestrator.test.ts` defines an in-test
  `makeFakeProvider` helper. The new T241-adapters fakes are
  intentionally **richer** (canned-response lookup, observation
  counters, failure modes that map onto the orchestrator's
  `classifyError`) so callers downstream of T241 can use them as
  fixtures without re-inventing the test scaffolding.
- The orchestrator's `classifyError` recognises `error.code === 'RATE_LIMITED'`,
  `error.code === 'PROVIDER_UNAVAILABLE'`, and message-pattern fallbacks.
  The fake adapters set those `code` properties when their respective
  failure modes are configured, so the orchestrator classifies them
  correctly without any wiring changes.
- `T241` (no suffix) is already taken on `main` by the M.8 missions
  kernel ticket. The `validate:roadmap` script extracts `T\d{3}-`
  prefixes and treats the rest of the slug as scope (this is how the
  existing `T243-rpc-missions-handlers.md` coexists with
  `T243-rbac-property-based-scope-forgery-tests.md`). Naming this
  ticket `T241-adapters-provider-implementations.md` matches that
  precedent.
- `factory.test.ts` and `read-patterns.test.ts` in the same `__tests__/`
  directory already fail in this worktree because of unrelated package
  resolution gaps (`bash-parser`, `pino`). The new adapter tests are
  isolated — they import only the T240 backbone + the new adapter
  files — so they are not affected.

## 3. Files inspected

- `packages/shared/src/agent/backend/provider-id.ts`
- `packages/shared/src/agent/backend/provider-registry.ts`
- `packages/shared/src/agent/backend/routing-policy.ts`
- `packages/shared/src/agent/backend/orchestrator.ts`
- `packages/shared/src/agent/backend/__tests__/orchestrator.test.ts`
- `docs/tickets/T240-provider-orchestration-backbone.md`
- `docs/worklog/T240-provider-orchestration-backbone.md`

## 4. Files created

- `packages/shared/src/agent/backend/adapters/fake-anthropic-adapter.ts`
- `packages/shared/src/agent/backend/adapters/fake-openai-adapter.ts`
- `packages/shared/src/agent/backend/adapters/index.ts`
- `packages/shared/src/agent/backend/__tests__/fake-anthropic-adapter.test.ts`
- `packages/shared/src/agent/backend/__tests__/fake-openai-adapter.test.ts`
- `packages/shared/src/agent/backend/__tests__/fake-adapters-compose.test.ts`
- `docs/tickets/T241-adapters-provider-implementations.md`
- `docs/worklog/T241-adapters-provider-implementations.md` (this file)

## 5. Design notes

### 5.1 Why two adapters, not one parameterised fake

The two fakes share a near-identical implementation. They are kept
separate because:

1. They are **templates** for the real T242 adapters, which will not
   share code (one wraps `@anthropic-ai/sdk`, the other wraps `openai`).
   DRYing the templates would obscure that contract.
2. They expose deliberately different defaults — chunk count (3 vs 4),
   echo prefix (`[fake-anthropic]` vs `[fake-openai]`), default token
   usage shape — so registry-level tests can tell the two apart by
   inspecting outputs without referencing brand metadata.
3. The OpenAI fake exposes a `setHealthy(boolean)` toggle the Anthropic
   fake omits, mirroring the real-world asymmetry where rate-limit
   recovery cadence differs per provider. Tests that need a runtime
   flip can use the OpenAI fake; tests that want immutable construction
   semantics use the Anthropic one.

### 5.2 Failure-mode mapping

The fake adapters expose three failure kinds:

| `FakeFailureMode.kind` | Error `code` set | Orchestrator classification |
| --- | --- | --- |
| `unavailable` | `PROVIDER_UNAVAILABLE` | `ProviderUnavailableError` |
| `rate-limited` | `RATE_LIMITED` (with optional `retryAfterMs`) | `RateLimitedError` |
| `error` | (none) | generic `error` outcome → terminal `ProviderUnavailableError` after attempts exhausted |

These map directly onto `classifyError` in `orchestrator.ts:131-143` so
no orchestrator changes are needed.

### 5.3 Result<T, E> reuse

The `replay(prompt)` helper on each adapter returns a `Result<Canned,
NotFound>` value imported from `../provider-id.ts`. The instruction was
explicit: do not redefine `Result`. Verified by `grep -n "type Result"
packages/shared/src/agent/backend/adapters/*.ts` returning no hits.

## 6. Test counts

- `fake-anthropic-adapter.test.ts` — 22 cases, **55** expect() calls.
- `fake-openai-adapter.test.ts` — 22 cases, **53** expect() calls.
- `fake-adapters-compose.test.ts` — 4 cases, **27** expect() calls.

Each adapter test file exceeds the ≥30 expect() floor by a wide margin.

## 7. Validation

- `bun test packages/shared/src/agent/backend/__tests__/fake-*` — **green** (3 files, 48 cases, 135 expect() calls total: 55 + 53 + 27).
- `bun run validate:rebrand` — **green** ("no forbidden tokens outside the allowlist").
- `bun run validate:agent-contract` — **fails on `T223-tenant-credential-key-derivation.md` (missing single-line `Status:` directive — uses `## Status` h2 instead)**. Reproduced on bare `origin/main` HEAD `de1c124a` before any T241-adapters change was applied, so this is **pre-existing on `main`**, not introduced by T241-adapters. Fix is out of scope here (touches a different ticket file).
- `bun run validate:roadmap` — **fails on `docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md` (phase `M.1.3b` referenced in ledger but no matching `# Phase` heading in lane M)**. Reproduced on bare `origin/main` HEAD `de1c124a` before any T241-adapters change was applied, so this is **pre-existing on `main`**, not introduced by T241-adapters. Fix is out of scope here (touches the goal file, not adapters).

## 8. Follow-ups

- T242: real Anthropic adapter wrapping `@anthropic-ai/sdk`. Re-export
  from `adapters/index.ts`. Reuse the fake's canned-response shape for
  cassette-style tests.
- T242: real OpenAI adapter wrapping `openai`. Same re-export pattern.
- T243: wire the orchestrator + real adapters into the renderer
  message-send path, behind a feature flag, so the live agent backends
  can opt into multi-provider routing without a hard cutover.

## 9. LOC accounting

- `fake-anthropic-adapter.ts` — ~200 LOC including comments.
- `fake-openai-adapter.ts` — ~200 LOC including comments.
- `adapters/index.ts` — 20 LOC barrel.

Both adapter files comfortably under the ≤300 LOC ceiling.
