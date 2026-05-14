# T071c - Wire TokenBucket into missions.dispatchEvent

Status: DONE

## Goal

Mirror T071b for the mission admin RPC surface. Plumb the existing
optional `HandlerDeps.rateLimiter: TokenBucket` into `missions.dispatchEvent`
so a single actor cannot exhaust the mission scheduler with a burst of
state-transition requests. Backward-compatible: hosts that do not inject
a `rateLimiter` behave identically to the pre-T071c baseline.

## Scope

- Add a `tryAcquire(1)` gate at the entry of `missions.dispatchEvent` in
  `packages/server-core/src/handlers/rpc/missions.ts`. On failure, return
  the typed `{error: 'rate-limited', reason: 'token-bucket-exhausted'}`
  envelope.
- The gate sits BEFORE validation, permission checks, and scheduler
  dispatch — abuse traffic with malformed/unauthorised payloads still
  consumes bucket tokens, and rate-limited requests leave no scheduler
  state change.
- `missions.create` is intentionally NOT gated (it is bounded by the
  upstream owner-grant scope check and not a hot per-event path).
  `missions.get` / `missions.list` are read-only and out of scope.
- Do NOT modify `handler-deps.ts` (T071b already added the optional
  `rateLimiter` field).
- Do NOT modify the T071 `TokenBucket` class or any other
  `packages/shared/src/security/` primitive.
- Do NOT modify the T071b `roles.ts` wiring.

## Required Tests

- Burst: 5 dispatchEvent calls against capacity 2 produce 2 successes +
  3 rate-limited responses; the missions that were gated remain in
  their pre-call state in the scheduler store.
- Drain on reject: rate-limit fires before permission/validation; an
  unauthorised caller still consumes tokens, so the third call returns
  rate-limited rather than permission-denied.
- Refill: after draining capacity-1 / refill-1-per-sec, advancing the
  clock 2000ms restores enough budget for one more dispatch.
- Backward-compat: when `rateLimiter` is undefined, 10 dispatches all
  succeed.

## Acceptance Criteria

- [x] `missions.dispatchEvent` checks `tryAcquire(1)` and returns the
      typed `rate-limited` error on failure.
- [x] Rate-limited requests do NOT mutate the scheduler store.
- [x] All existing `missions-rpc.test.ts` cases continue to pass
      (no behaviour change when no limiter is wired).
- [x] `validate:rebrand`, `validate:agent-contract`, `validate:roadmap`
      pass.
- [x] LOC budget respected: source 9 LOC, tests 197 LOC (budgets 80 / 200).
- [x] Worklog complete.
- [x] Scoped commits and PR.

## Worklog

- `docs/worklog/T071c-missions-rate-limiter.md`

## Follow-up

- Surfaces beyond the missions admin RPC (experience-layer abuse
  vectors, automation triggers, etc.) remain candidates for future
  rate-limit / budget integration. Out of scope for T071c.
