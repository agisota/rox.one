# T071 - Security and Abuse Hardening

## 1. Task summary

Add a focused security hardening pass for the integrated mission scheduler and
experience-layer abuse paths before final RC. The pass also incorporated the
read-only security review finding that public share and account billing payloads
were key-redaction-only and did not prove value-pattern redaction inside generic
content or ledger metadata.

## 2. Repo context discovered

- T038 already added shared Experience Layer security guards for tenant access,
  package visibility, ledger spoofing, paid-entitlement gate bypass, package
  permission profiles, and public package publish requirements.
- T066 added durable mission scheduling with budget/capacity/human approval
  gates, but branch-expansion input and scheduler-event cost payloads still need
  explicit fail-closed abuse tests.
- Account session corruption fail-closed coverage already exists in
  `apps/electron/src/main/__tests__/account-session-store.test.ts`.
- Provider output secret-redaction coverage already existed in T067 provider
  gateway tests, but the sanitizer only removed sensitive keys. T071 added a
  shared public payload sanitizer that also redacts secret-looking string
  values.
- Public share upload and account cabinet billing are boundary payloads: they
  can carry user-controlled session content or provider ledger metadata into
  public/account UI surfaces, so they need value redaction in addition to
  sensitive-key handling.

## 3. Files inspected

- `packages/shared/src/workbench/experience-layer-security.ts`
- `packages/shared/src/workbench/__tests__/experience-layer-security.test.ts`
- `packages/server-core/src/mission-scheduler/durable-mission-scheduler.ts`
- `packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts`
- `packages/server-core/src/persistence/agent-workbench-persistence.ts`
- `packages/server-core/src/provider-gateway/provider-gateway.ts`
- `packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts`
- `packages/server-core/src/sessions/share-provider.ts`
- `packages/server-core/src/sessions/share-provider.test.ts`
- `packages/server-core/src/webui/account-cabinet.ts`
- `packages/server-core/src/webui/__tests__/account-cabinet.test.ts`
- `packages/server-core/src/webui/account-events.ts`
- `apps/electron/src/main/account-session-store.ts`
- `apps/electron/src/main/__tests__/account-session-store.test.ts`
- `docs/worklog/T038-security-hardening.md`
- `docs/worklog/T067-real-provider-orchestration.md`
- `docs/worklog/T068-experience-real-state-binding.md`

## 4. Tests added first

- `packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts`
  - `does not let spoofed negative scheduler event costs expand mission budget`
  - `rejects invalid branch expansion values before budget or approval checks`
- `packages/server-core/src/sessions/share-provider.test.ts`
  - `redacts secret-looking values embedded in public content fields`
- `packages/server-core/src/webui/__tests__/account-cabinet.test.ts`
  - `redacts secret-like ledger metadata before exposing billing payloads`

## 5. Expected failing test output

First mission-scheduler red run:

```text
bun test packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts

8 pass
2 fail

Expected reason:
- negative scheduler event cost produced allowed=true with remainingBudgetCredits 1030
- invalid branch expansion values resolved instead of rejecting
```

Second share/account red run:

```text
bun test packages/server-core/src/sessions/share-provider.test.ts \
  packages/server-core/src/webui/__tests__/account-cabinet.test.ts

7 pass
2 fail

Expected reason:
- public share payload still contained Bearer bearer-secret-value,
  OPENAI_API_KEY=sk-publicleak123456, rox_session=session-cookie-secret, and
  DATABASE_PASSWORD=db-secret-value inside generic strings
- account billing payload still exposed ledger metadata strings including bearer
  token, API key, and session cookie values
```

## 6. Implementation changes

- Added branch expansion input guards in
  `packages/server-core/src/mission-scheduler/durable-mission-scheduler.ts`:
  `requestedAgentCount` must be a positive integer, and
  `estimatedCostCredits` must be a positive finite number.
- Hardened scheduler budget accounting so event costs only count when they are
  positive finite numbers. Negative spoofed scheduler events no longer increase
  remaining budget.
- Added `packages/server-core/src/security/public-payload-sanitizer.ts` for
  public/account payload redaction:
  - redacts `Bearer ...` values;
  - redacts env-style `*_API_KEY=...`, `*_TOKEN=...`, `*_PASSWORD=...`,
    `*_SECRET=...`, `*_COOKIE=...`, and `rox_session=...` values;
  - redacts standalone `sk-...` style API keys;
  - optionally drops sensitive object keys for public share/provider artifacts;
  - replaces sensitive object-key values with `[redacted]` for account cabinet
    payloads.
- Routed `sanitizeShareBundleForPublicViewer` and
  `sanitizeProviderPublicPayload` through the shared sanitizer with
  `dropSensitiveKeys: true`.
- Sanitized account billing ledger entry metadata in
  `createAccountCabinetBillingFromLedger` before returning cabinet payloads.

## 7. Validation commands run

```text
bun test packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts
bun test packages/server-core/src/sessions/share-provider.test.ts packages/server-core/src/webui/__tests__/account-cabinet.test.ts packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts packages/shared/src/workbench/__tests__/experience-layer-security.test.ts apps/electron/src/main/__tests__/account-session-store.test.ts
bun run validate:docs
bun run typecheck:all
bun run lint
git diff --check
bun test
```

## 8. Passing test output summary

- Scheduler targeted green: `10 pass`, `0 fail`, `33 expect() calls`.
- Security/account/share/provider targeted green: `35 pass`, `0 fail`,
  `106 expect() calls`.
- Docs validation green:
  - `[agent-contract] ok: 11 skills, 73 tickets, 7 required docs`
  - `[architecture-docs] ok`
  - `[sync-v2-design] validated`
- Typecheck green: `bun run typecheck:all` completed with `tsc --noEmit`.
- Lint green with existing warnings only:
  - `0 errors`, `3 warnings` in existing React hook dependency warnings.
- Full test suite green:
  - `4673 pass`
  - `13 skip`
  - `0 fail`
  - `1 snapshots`
  - `11924 expect() calls`
  - `4686 tests across 392 files`
- `git diff --check` passed.

## 9. Build output summary

No Electron build was required for this server-core/shared security slice.
T070 already validated the Electron/private release build surface, and T072 will
run the final Electron release-candidate build.

## 10. Remaining risks

- Production durable queue/DB adapters must enforce the same positive-cost
  invariant for mission scheduler events; this ticket hardens the current
  in-memory/repository contract path.
- Real provider billing settlement remains behind fake-provider-safe contracts
  until production adapters are enabled.
- Security review found additional release-gate work outside this narrow fix:
  dependency audit currently reports vulnerable transitive packages, and HTTP
  sync conflict no-write boundary coverage should be added before public
  production rollout if that route is exposed beyond the local MVP.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Negative scheduler event costs are rejected or ignored safely | DONE | `does not let spoofed negative scheduler event costs expand mission budget` |
| Branch expansion rejects invalid agent counts and estimated costs | DONE | `rejects invalid branch expansion values before budget or approval checks` |
| Public share payload redacts secret-like values | DONE | `redacts secret-looking values embedded in public content fields` |
| Account billing payload redacts ledger metadata secrets | DONE | `redacts secret-like ledger metadata before exposing billing payloads` |
| Mission budget bypass tests pass | DONE | scheduler targeted suite: `10 pass` |
| Existing security guard tests pass | DONE | targeted security/session suite: `35 pass`; full suite: `4673 pass`, `0 fail` |
| Worklog complete | DONE | this file |
| Scoped commit exists | DONE | T071 scoped Lore commit |

## 12. Round 2 — abuse-hardening primitives (M.13)

### 12.1 Goal

Ship the rate-limit + per-user budget *primitives* expected by the final RC
abuse review. Round 1 closed boundary redaction, scheduler spoof rejection,
and branch-expansion input validation. Round 2 lands the data structures
required to bolt per-IP + per-user limits onto RPC handlers without writing
a one-off limiter inside each handler.

Constraints honored:

- Pure data structures only — zero I/O, no globals, no `Date.now()`
  reachable from the new modules.
- Clock injected as `() => number` (ms) for deterministic tests.
- No new external deps.
- Existing RPC handlers are NOT modified. Handler integration is T071b.

### 12.2 Files added

- `packages/shared/src/security/rate-limiter.ts`
- `packages/shared/src/security/budget-guard.ts`
- `packages/shared/src/security/index.ts`
- `packages/shared/src/security/__tests__/rate-limiter.test.ts`
- `packages/shared/src/security/__tests__/budget-guard.test.ts`
- `packages/shared/package.json` — three new subpath exports.

### 12.3 Primitives

`TokenBucket` — `{capacity, refillRatePerSec, clock, initialTokens?}`. 
`tryAcquire(n=1)` returns `boolean`. Refill is continuous; capacity is
hard-clamped; negative `initialTokens` clamps to 0; clock regression is
treated as zero elapsed (defensive against `performance.now()` /
multi-source clocks). Throws `RangeError` / `TypeError` on construction
with non-finite or non-positive args.

`SlidingWindowCounter` — `{windowMs, clock, maxEvents?}`. `record()`
appends now and returns count inside the rolling window. Events at exactly
`now - windowMs` are considered expired (`<= cutoff`). `maxEvents` provides
a memory ceiling under abuse by dropping the oldest on overflow.

`BudgetGuard<TKey>` — `{budgetPerKey}`. `consume(key, amount)` returns
`{ok:true, remaining}` or `{ok:false, error: BudgetExceededError}`. State
is never mutated on rejection. `BudgetExceededError` carries
`{reason, key, budget, used, requested}` so telemetry can attribute throttles
without parsing strings.

### 12.4 Tests

- `packages/shared/src/security/__tests__/rate-limiter.test.ts` — 18 tests,
  covers initial state, drain/refill math, refill cap, fractional refills,
  clock regression, burst+refill, zero-rate fixed quota, window expiry,
  exact-boundary expiration, `maxEvents` drop-oldest, validation
  (construction + `tryAcquire`), determinism trace.
- `packages/shared/src/security/__tests__/budget-guard.test.ts` — 24 tests,
  covers within-budget acceptance, accumulation, isolation across keys,
  rejection without mutation, exact-remaining acceptance, epsilon exceed,
  `reset(key)` vs `reset()`, invalid-amount (`NaN`, `-1`, `Infinity`),
  zero-amount no-op, `keyCount`, generic key typing, exhausted-then-reset.

### 12.5 Targeted test output

```text
bun test packages/shared/src/security/__tests__/
 42 pass
 0 fail
 138 expect() calls
Ran 42 tests across 2 files.
```

### 12.6 Remaining work — T071b

- Wire `TokenBucket` (per-IP + per-user) into RPC handler middleware.
- Wire `BudgetGuard` into authenticated-user lifetime / window budgets.
- Map `BudgetExceededError` to a 429-equivalent user-facing error with
  `Retry-After` hints derived from `TokenBucket.available()` + refill rate.
- Add integration tests at the RPC boundary proving abuse-resistance
  end-to-end.

