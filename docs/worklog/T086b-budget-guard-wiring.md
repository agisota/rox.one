# T086b - Wire BudgetGuard into roles+missions handlers

## 1. Task summary

Wire the existing T071 `BudgetGuard<TKey>` into the same handlers that
T071b/T071c wired with the `TokenBucket`: `roles.grant`, `roles.revoke`,
and `missions.dispatchEvent`. Per-actor lifetime caps stack on top of
the burst-shaped bucket so an attacker who paces requests below the
bucket threshold still hits a per-actor ceiling. The integration is
OPTIONAL — hosts that don't inject a guard behave identically to the
pre-T086b baseline.

## 2. Repo context discovered

- T071 round-2 (PR #133) shipped pure rate-limit / budget primitives at
  `packages/shared/src/security/budget-guard.ts`. The `BudgetGuard<TKey>`
  class is generic over key type (defaults to `string`), exposes
  `consume(key, amount): BudgetResult`, `reset(key?)`, `usage(key)`,
  and `remaining(key)`. The `BudgetResult` discriminated union surfaces
  exhaustion as data — never as a thrown error.
- T071b (PR #153) added `HandlerDeps.rateLimiter?: TokenBucket` and
  wired the gate into `roles.grant` and `roles.revoke`.
- T071c (PR #164) wired the same gate into `missions.dispatchEvent`.
  `missions.create`, `missions.get`, `missions.list` were intentionally
  left ungated (low-rate / read-only).
- T086 (PR #148) shipped abuse-hardening integration tests but did not
  wire the BudgetGuard.
- The handler-deps pattern is "all fields optional except sessionManager
  / platform / oauthFlowStore" so hosts can adopt features
  incrementally. `budgetGuard` follows the same pattern.

## 3. Files inspected

- `packages/shared/src/security/budget-guard.ts` (BudgetGuard contract)
- `packages/shared/src/security/index.ts` (verify `BudgetGuard` re-export)
- `packages/server-core/src/handlers/handler-deps.ts` (current dep bag)
- `packages/server-core/src/handlers/rpc/roles.ts` (T071b rate-limit
  wiring reference)
- `packages/server-core/src/handlers/rpc/missions.ts` (T071c rate-limit
  wiring reference)
- `packages/server-core/src/handlers/rpc/__tests__/roles-rate-limit.test.ts`
  (existing T071b test harness)
- `packages/server-core/src/handlers/rpc/__tests__/missions-rate-limit.test.ts`
  (existing T071c test harness)
- `docs/tickets/T071c-missions-rate-limiter.md`,
  `docs/worklog/T071c-missions-rate-limiter.md` (template / format)

## 4. Implementation

### handler-deps.ts (+14 LOC)

Added an optional `budgetGuard?: BudgetGuard<string>` field. The
JSDoc documents the semantics: keyed by `actorId` (from `ctx.userId`),
sits AFTER the rate-limiter gate, surfaces exhaustion as the typed
`{error: 'budget-exceeded', reason: 'per-actor-cap-exhausted'}`
envelope. Backward-compat note explicit: absent => no-op.

### roles.ts (+22 LOC)

Two near-identical gates at the entry of `roles.grant` and
`roles.revoke`, immediately after the existing `rateLimiter.tryAcquire`
gate and BEFORE validation / permission / store-write / audit:

```ts
if (deps.budgetGuard) {
  const key = ctx.userId ?? '__anonymous__'
  const result = deps.budgetGuard.consume(key, 1)
  if (!result.ok) {
    return { error: 'budget-exceeded', reason: 'per-actor-cap-exhausted' }
  }
}
```

Placement rationale:

- AFTER the rate-limit gate so a single actor's bucket can still
  throttle bursts before they consume budget. (Conceptually: rate
  limits the short window; budget limits the lifetime tail.)
- BEFORE validation/permission/store-write/audit so a budget-exhausted
  request leaves no state change and no audit record — identical
  contract to the T071b/T071c gate.

Grant and revoke share the same `BudgetGuard` instance, mirroring the
T071b token-bucket choice — an actor cannot bypass the cap by
alternating channels.

### missions.ts (+12 LOC)

The same gate added to `missions.dispatchEvent` only, immediately after
the existing rate-limiter gate. `missions.create`, `missions.get`, and
`missions.list` remain ungated for the same reasons as T071c.

### Tests (+224 LOC, 9 new cases, 67 new expect())

**roles-rate-limit.test.ts** — 5 budget-guard cases under a new
`describe('roles.{grant,revoke} — BudgetGuard per-actor cap (T086b)')`:

1. **Budget exhaustion** — cap 2 / no token-bucket. Two grants from
   `admin` succeed; third returns `budget-exceeded`. The rejected
   grant is asserted absent from the store; `usage('admin') === 2`.
2. **Different actor IDs have isolated budgets** — two global owners
   `admin1` / `admin2` with cap 1 each. Each lands one grant before
   the others are gated, proving per-key isolation.
3. **Grant and revoke share the same per-actor budget** — cap 2.
   `admin` issues 1 grant + 1 revoke, then the next mutation
   (grant or revoke) is gated regardless of channel.
4. **Reset restores the per-actor budget** — cap 1, exhaust, call
   `BudgetGuard.reset('admin')`, next grant succeeds.
5. **Backward-compat** — no guard wired; 20 grants + 5 revokes all
   succeed.

**missions-rate-limit.test.ts** — 4 budget-guard cases under a new
`describe('missions.dispatchEvent — BudgetGuard per-actor cap (T086b)')`:

1. **Budget exhaustion** — cap 2 / no token-bucket. Three missions
   created; first two dispatches succeed, third returns
   `budget-exceeded`. Mission #3 remains `Pending` in the scheduler.
2. **Different actor IDs have isolated budgets** — `admin1` /
   `admin2` cap 1 each; both land one dispatch, then both gated.
3. **Reset restores the per-actor budget** — cap 1, exhaust, reset,
   dispatch succeeds.
4. **Backward-compat** — no guard wired; 10 create+dispatch cycles
   all succeed.

The harness was extended with `budgetGuard` plumbing exposed on the
`Harness` interface so tests can call `usage(key)` / `reset(key)`
directly for assertion and recovery.

## 5. Validation

- `bun test packages/server-core/src/handlers/rpc/__tests__/`
  — 227 pass / 0 fail / 580 expect() across 11 files
  (was 218 / 509 / 11 files; +9 cases / +71 expect()).
- `bun test packages/server-core/src/handlers/rpc/__tests__/roles-rate-limit.test.ts packages/server-core/src/handlers/rpc/__tests__/missions-rate-limit.test.ts`
  — 21 pass / 0 fail / 155 expect().
- `bun run validate:rebrand` — passes.
- `bun run validate:agent-contract` — `ok: 11 skills, 315 tickets,
  7 required docs`.
- `bun run validate:roadmap` — `OK — 46 phases, 110 tickets`.

## 6. Constraints honoured

- T071 `BudgetGuard` / `TokenBucket` — untouched.
- `packages/shared/src/security/` — untouched.
- T071b `roles.ts` rate-limit gate — untouched (the budget gate is
  appended after it).
- T071c `missions.ts` rate-limit gate — untouched.
- T243-rpc audit / observability hooks — untouched (budget exhaustion
  short-circuits BEFORE audit emission, identical to rate-limit).
- `.swarm/master-roadmap-log.md` — untouched.
- Files modified: only `handler-deps.ts`, `roles.ts`, `missions.ts`,
  and the two existing rate-limit test files. Plus this ticket and
  worklog under `docs/`.
- LOC: 53 source / 224 tests (budgets 120 / 300).

## 7. Follow-up

- Cap sizing is host-driven (`BudgetGuardOptions.budgetPerKey` is set
  at construction). T086b does not opinionate on the right cap for
  RBAC admin / mission dispatch; that's a deployment concern.
- The guard is per-process — distributed deployments need a shared
  store before this becomes a cluster-wide cap. Out of scope here.
- Additional surfaces (experience-layer abuse vectors, automation
  triggers, OAuth flows) remain candidates for future budget
  integration.
