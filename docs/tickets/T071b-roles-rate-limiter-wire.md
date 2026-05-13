# T071b - Wire TokenBucket into RBAC admin RPC handlers

Status: DONE

## Goal

Plumb the T071 round-2 `TokenBucket` primitive into the RBAC admin RPC
handlers (`roles.grant`, `roles.revoke`) so a single actor cannot
exhaust the system with a burst of grant/revoke requests. The wiring is
optional and backward-compatible: hosts that do not inject a
`rateLimiter` behave identically to the pre-T071b baseline.

## Scope

- Add optional `rateLimiter?: TokenBucket` field to `HandlerDeps`.
- Gate `roles.grant` and `roles.revoke` on `rateLimiter.tryAcquire(1)`
  at the entry of each handler. On failure, return
  `{error: 'rate-limited', reason: 'token-bucket-exhausted'}`.
- The check runs BEFORE permission/validation and BEFORE the audit
  producer, so rate-limited requests leave no grant store mutation and
  no `RoleGranted` / `RoleRevoked` audit record.
- Do NOT modify the T071 `TokenBucket` class.
- Do NOT modify the T246 audit producer wiring.
- Do NOT touch the mission scheduler (deferred to T071c).

## Required Tests

- Burst: 10 grants in quick succession against capacity 3 produces 3
  successes + 7 `rate-limited` responses; only the 3 successful actor
  ids exist in the grant store.
- Refill: after draining capacity-2 / refill-1-per-sec, advancing the
  clock 2000ms restores 2 more grants before the next limit fires.
- Audit silence: with capacity 1 and an `AuditProducer` wired, only
  one `RoleGranted` is emitted across two grant attempts.
- Drain on reject: rate-limit fires before permission/validation, so
  even rejected requests consume tokens.
- Revoke gating: capacity-2 / 3 revokes => the third is rate-limited
  and the unrevoked grant remains.
- Mutual rate-limit: grant and revoke share the same bucket.
- Backward-compat: when `rateLimiter` is undefined, 20 grants and 5
  revokes all succeed.

## Acceptance Criteria

- [x] `HandlerDeps.rateLimiter?: TokenBucket` field present and
      documented.
- [x] `roles.grant` checks `tryAcquire(1)` and returns the typed
      `rate-limited` error on failure.
- [x] `roles.revoke` checks `tryAcquire(1)` and returns the typed
      `rate-limited` error on failure.
- [x] Rate-limited requests do NOT mutate the grant store.
- [x] Rate-limited requests do NOT emit audit events.
- [x] All existing `roles*.test.ts` cases continue to pass.
- [x] `validate:rebrand`, `validate:agent-contract`, `validate:roadmap`
      pass.
- [x] LOC budget respected: source 31 LOC, tests 236 LOC.
- [x] Worklog complete.
- [x] Scoped commits and PR.

## Worklog

- `docs/worklog/T071b-roles-rate-limiter-wire.md`

## Follow-up

- **T071c** — wire `TokenBucket` / `BudgetGuard` into mission scheduler
  expansion paths and the experience-layer abuse surface. Distinct
  module ownership; deferred to keep T071b reviewable.
