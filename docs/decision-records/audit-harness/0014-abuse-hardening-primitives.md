# Decision 0014: Two-Layer Abuse-Hardening Primitives

- Status: accepted
- Date: 2026-05-13
- Implements: T071 (round 2 — pure primitives), T071b (RBAC admin
  rate-limit wire), T071c (mission scheduler rate-limit wire),
  T086 (integration coverage), T086b (BudgetGuard wire).
- Source tickets: `docs/tickets/T071-security-abuse-hardening.md`,
  `docs/tickets/T071b-roles-rate-limiter-wire.md`,
  `docs/tickets/T071c-missions-rate-limiter.md`,
  `docs/tickets/T086-security-abuse-hardening.md`,
  `docs/tickets/T086b-budget-guard-wiring.md`.

## Canonical

Public RPC handlers MUST be guarded by a two-layer abuse defense:
TokenBucket (burst) + BudgetGuard (per-actor cap), wired optionally
so dev environments remain frictionless.

```text
abuse_hardening:
  primitives:
    file:           packages/shared/src/security/
    rate_limiter:   TokenBucket {capacity, refillRatePerSec, clock,
                                  initialTokens?}
                    tryAcquire(n=1): boolean
                    contracts:      continuous refill, clamped capacity,
                                    clock-regression guard
    sliding_window: SlidingWindowCounter {windowMs, clock, maxEvents?}
                    record(): count; count(): peek
                    contracts:      lazy pruning, drop-oldest under cap
    budget_guard:   BudgetGuard<TKey> {budgetPerKey}
                    consume(key, amount): BudgetResult
                    usage(key); remaining(key); reset(key?)
                    error:          BudgetExceededError with telemetry
  wiring:
    deps:           HandlerDeps.rateLimiter?: TokenBucket
                    HandlerDeps.budgetGuard?: BudgetGuard<string>
    guarded:        roles.grant, roles.revoke, missions.dispatchEvent
    order:          rateLimiter.tryAcquire(1)     [layer 1, burst]
                    budgetGuard.consume(actorId)  [layer 2, sustained]
                    permission checks             [next]
                    domain logic + audit emit     [last]
    keys:           BudgetGuard keyed by ctx.userId ?? '__anonymous__'
  error_envelopes:
    burst_reject:    { error: 'rate-limited',  reason: 'token-bucket-exhausted' }
    budget_reject:   { error: 'budget-exceeded', reason: 'per-actor-cap-exhausted' }
  determinism:
    clock_injection: every primitive accepts () => number
                     no internal Date.now() call
```

## Decisions

Five decisions, each with rationale.

### 1. Two layers, in order: TokenBucket first, BudgetGuard second

`tryAcquire(1)` runs at the very entry of the handler, before any
other check. If it fails, the handler returns `rate-limited` and
exits. If it passes, `budgetGuard.consume(actorId, 1)` runs next.
If that fails, the handler returns `budget-exceeded` and exits.
Permission / validation / store mutation / audit emission happen
only after both gates pass.

**Reasons.**

- **Burst and sustained attacks have different shapes.** A
  TokenBucket bounds bursts (capacity per second-refill window).
  A BudgetGuard bounds sustained pace (lifetime per actor). One
  primitive cannot cover both without making sustained budgets
  feel like rate-limit hiccups, or vice versa.
- **Cheap rejection before expensive work.** Both gates are O(1)
  table lookups. Spending two cheap checks before any I/O is
  strictly cheaper than running permission lookups for traffic
  the gate would have killed anyway.
- **Order matters for telemetry.** A flood that exhausts the
  bucket appears in metrics distinct from a single actor that
  exhausts their lifetime budget. Reversing the order would
  conflate the two failure modes.

### 2. Pure primitives in `@rox-one/shared/security`; no I/O

Every primitive (TokenBucket, SlidingWindowCounter, BudgetGuard)
imports zero runtime services: no `fs`, no `node:crypto`, no
`process.env`, no implicit clock. Clocks are injected as
`() => number`. Same inputs always produce the same outputs.

**Reasons.**

- **Testable to the millisecond.** Tests inject a fake clock,
  step it deterministically, and assert exact refill / drain /
  reset behaviour. No `setTimeout` and no real wall clock.
- **Portable.** The same primitives run in renderer, server, or
  edge worker without behaviour drift.
- **Single audit point per concern.** Reviewers reading
  `rate-limiter.ts` see the entire burst-defense surface.

### 3. Optional wiring; absence preserves the pre-T071 baseline

`HandlerDeps.rateLimiter` and `HandlerDeps.budgetGuard` are
`optional`. When both are `undefined`, handlers see no gate and
behave exactly as before T071b/T086b. Dev harnesses, unit tests,
and the Electron single-user runtime opt out by default.

**Reasons.**

- **Single-user runtimes do not pay for tenant defenses.** The
  desktop app has no adversarial caller; gating it slows local
  iteration with no security gain.
- **Production opts in explicitly.** The act of injecting the
  limiter is the activation gate. There is no env-flag toggle
  scattered through the codebase.
- **Tests mix-and-match.** A test that needs to verify gate
  behaviour wires a real `TokenBucket` over a fake clock. A
  test that does not care omits the dep.

### 4. Rate-limited rejects DO consume tokens; permission rejects do NOT

The gate runs BEFORE permission and validation, so an unauthorised
caller still consumes a token. An attacker cannot probe the
permission surface by exhausting it with denied requests.
Conversely, a permission failure (after both gates pass) does not
charge against the actor's budget because the actor never made
a sanctioned-business-action attempt.

**Reasons.**

- **Drain on reject is the canonical anti-probe defense.** Without
  it, an attacker mounts an enumeration attack at full speed
  because each rejection costs them nothing.
- **Symmetry with audit emission.** Rate-limited and
  budget-exhausted requests leave no store mutation and no
  audit row. The audit log stays meaningful — it shows
  successful operator actions, not noise.

### 5. Per-actor key for BudgetGuard; anonymous bucket for unauth

`BudgetGuard<string>` is keyed by `ctx.userId ?? '__anonymous__'`.
Each authenticated user has an isolated budget. Anonymous traffic
shares one bucket so a flood of unauth requests cannot consume
arbitrary memory growing the key table.

**Reasons.**

- **Fairness across users.** One abusive user cannot starve
  another's lifetime capacity.
- **Bounded memory.** The number of keys cannot exceed the
  user count plus the `__anonymous__` sentinel. A flood of
  unauth requests bounds to a single counter, not millions
  of one-off keys.
- **Reset escape hatch.** `BudgetGuard.reset(key)` clears a
  single actor's budget for support flows (a legitimate user
  exhausted their cap and needs a manual restore).

## Invariants

Three invariants the abuse-hardening slice holds.

### 1. Gate runs before any mutation or audit emit

Enforced by structure: `tryAcquire` then `consume` then permission
then store. Tests assert grant-store / scheduler emptiness and
audit-producer silence on rejected paths.

### 2. Backward compat when deps are absent

When `rateLimiter` and `budgetGuard` are both `undefined`, the
pre-T071b/T086b baseline behaviour is preserved exactly.

- `roles.grant` / `roles.revoke` / `missions.dispatchEvent`
  tests verify "20 grants succeed with no limiter".

### 3. Grant and revoke share the per-actor budget

A single actor cannot bypass the cap by alternating
`roles.grant` and `roles.revoke`. Both call
`budgetGuard.consume(actorId, 1)` against the same key.

- `roles-rate-limit.test.ts` — "grant and revoke share budget"
  case.

## Out of scope

- **Experience-layer abuse surfaces.** Beyond
  `roles.{grant,revoke}` and `missions.dispatchEvent`,
  surfaces like automation triggers and renderer flows remain
  candidates for future wiring.
- **Capability sizing per channel.** Hosts decide capacity /
  refill / budget values. The primitive does not opinionate
  the cap.
- **Distributed rate-limiting.** Today the bucket is in-process
  and per-host. Cross-process / cross-region limiting is a
  future concern that imports a different backing store.
