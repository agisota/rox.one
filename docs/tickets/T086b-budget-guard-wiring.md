# T086b - Wire BudgetGuard into roles+missions handlers

Status: DONE

## Goal

Plumb the existing T071 `BudgetGuard<TKey>` into the same RPC entry
points where T071b/T071c wired the `TokenBucket`: `roles.grant`,
`roles.revoke`, and `missions.dispatchEvent`. Per-actor lifetime caps
become a SECOND defense layer alongside the burst-shaped bucket so a
sustained-pace attacker who never trips the token-bucket cannot
indefinitely consume mutating-RPC capacity. Backward-compatible: hosts
that omit the guard behave identically to the pre-T086b baseline.

## Scope

- Extend `HandlerDeps` at
  `packages/server-core/src/handlers/handler-deps.ts` with an optional
  `budgetGuard?: BudgetGuard<string>` field (key is `actorId`).
- In `packages/server-core/src/handlers/rpc/roles.ts` add a
  `budgetGuard.consume(ctx.userId ?? '__anonymous__', 1)` check at the
  entry of `roles.grant` AND `roles.revoke`, AFTER the existing
  `rateLimiter.tryAcquire` gate. On `ok: false` return the typed
  `{error: 'budget-exceeded', reason: 'per-actor-cap-exhausted'}`
  envelope.
- In `packages/server-core/src/handlers/rpc/missions.ts` apply the
  same pattern at the entry of `missions.dispatchEvent`.
- Do NOT modify `packages/shared/src/security/` (T071 frozen).
- Do NOT modify other RPC handlers, T071b roles wiring, or T071c
  missions wiring beyond the appended guard gate.

## Required Tests

Extend `roles-rate-limit.test.ts` and `missions-rate-limit.test.ts`
with budget-guard cases:

- **Budget exhaustion** returns the typed `budget-exceeded` envelope
  and leaves no store/scheduler mutation.
- **Different actor IDs** have isolated budgets (per-actor key
  separation).
- **Reset** restores the budget (`BudgetGuard.reset(key)`).
- **Backward-compat**: no `budgetGuard` => no error; baseline
  unbounded behaviour preserved.
- (roles only) **Grant and revoke share the same per-actor budget**
  so a single actor cannot bypass the cap by alternating channels.

≥10 new `expect()` total across both files.

## Acceptance Criteria

- [x] `HandlerDeps.budgetGuard` declared as optional and typed
      `BudgetGuard<string>`.
- [x] `roles.grant`, `roles.revoke`, and `missions.dispatchEvent`
      check `budgetGuard.consume` AFTER `rateLimiter.tryAcquire`.
- [x] Budget-exhausted requests do NOT mutate the grant store, the
      mission scheduler, or emit audit events.
- [x] All existing `roles-rate-limit.test.ts` / `missions-rate-limit.test.ts`
      cases continue to pass (no behaviour change when no guard wired).
- [x] `validate:rebrand`, `validate:agent-contract`, `validate:roadmap`
      pass.
- [x] LOC budget respected: source 53 LOC, tests 224 LOC
      (budgets 120 / 300).
- [x] Worklog complete.
- [x] Scoped commits and PR.

## Worklog

- `docs/worklog/T086b-budget-guard-wiring.md`

## Follow-up

- The guard is currently injected by hosts; T086b does not opinionate
  the cap size — that lives in the host wiring (Electron / future
  remote transport). Capability sizing per-channel remains a host
  concern.
- Surfaces beyond `roles.{grant,revoke}` and `missions.dispatchEvent`
  remain candidates for future budget integration (experience-layer
  abuse vectors, automation triggers, etc.).
