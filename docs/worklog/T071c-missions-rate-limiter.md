# T071c - Wire TokenBucket into missions.dispatchEvent

## 1. Task summary

Mirror the T071b RBAC rate-limit wiring for the M.8 mission admin RPC
surface. Plumb the existing optional `HandlerDeps.rateLimiter: TokenBucket`
into `missions.dispatchEvent` so a single actor cannot exhaust the
mission scheduler with a burst of state-transition requests. The
integration is OPTIONAL — hosts that don't inject a `rateLimiter`
behave identically to the pre-T071c baseline.

## 2. Repo context discovered

- T071 round-2 (PR #133) shipped pure rate-limit / budget primitives at
  `packages/shared/src/security/`. RPC integration was deferred.
- T071b (PR #153) added `HandlerDeps.rateLimiter?: TokenBucket` to
  `packages/server-core/src/handlers/handler-deps.ts` and wired the
  gate into `roles.grant` and `roles.revoke`. The handler-deps field
  is reused as-is here; no schema change in T071c.
- T243-rpc (PR #125) shipped the missions admin RPC at
  `packages/server-core/src/handlers/rpc/missions.ts`. Four channels:
  `create`, `dispatchEvent`, `get`, `list`. `dispatchEvent` is the only
  mutating per-event handler that benefits from per-actor throttling —
  `create` is bounded by upstream owner-grant scope checks; `get` and
  `list` are read-only.
- The handler-deps pattern is "all fields optional except sessionManager
  / platform / oauthFlowStore" so hosts can adopt features
  incrementally — true for `missionScheduler` and `rateLimiter` alike.

## 3. Files inspected

- `packages/server-core/src/handlers/rpc/roles.ts` (T071b wiring
  reference)
- `packages/server-core/src/handlers/rpc/__tests__/roles-rate-limit.test.ts`
  (T071b test harness reference)
- `packages/server-core/src/handlers/rpc/missions.ts`
- `packages/server-core/src/handlers/rpc/__tests__/missions-rpc.test.ts`
  (mission harness pattern, fakeClock, fakeUuidGen)
- `packages/server-core/src/handlers/handler-deps.ts` (confirm
  `rateLimiter` field already present)
- `packages/shared/src/security/rate-limiter.ts` (TokenBucket contract)
- `docs/tickets/T071b-roles-rate-limiter-wire.md` (acceptance criteria
  template + T071c follow-up pointer)
- `docs/worklog/T071b-roles-rate-limiter-wire.md` (worklog format)

## 4. Implementation

### missions.ts (+9 LOC)

A single four-line gate added at the very entry of `missions.dispatchEvent`,
identical to the T071b pattern in `roles.ts`:

```ts
if (deps.rateLimiter && !deps.rateLimiter.tryAcquire(1)) {
  return { error: 'rate-limited', reason: 'token-bucket-exhausted' }
}
```

Placement rationale:

- BEFORE input validation — abuse traffic with malformed envelopes
  must still consume bucket tokens, otherwise an attacker can probe
  validation/permission paths for free with junk input.
- BEFORE the permission check — same rationale; the limit is the
  OUTER gate.
- BEFORE the scheduler call — rate-limited requests leave no mission
  state change.

`missions.create`, `missions.get`, `missions.list` are intentionally
NOT gated:

- `create` is bounded by the upstream owner-grant scope check and is
  not a hot per-event path.
- `get` / `list` are read-only; throttling reads has no abuse-mitigation
  benefit at this layer.

### Tests (`missions-rate-limit.test.ts`, 197 LOC, 4 cases, 25 expect())

1. **Burst**: capacity 2 / refill 0. Mint 5 missions, dispatch Start
   on each. First 2 succeed, last 3 return `rate-limited`. The gated
   missions (#3, #5) remain `Pending` in the scheduler store, proving
   the gate sits BEFORE the scheduler call.
2. **Drain on reject**: caller has no owner grant. Bucket capacity 2.
   First two calls return `permission-denied` AND drain a token each.
   Third call returns `rate-limited`, proving the gate sits BEFORE
   the permission check.
3. **Refill**: capacity 1 / refill 1-per-sec. Drain via one dispatch,
   second dispatch rate-limited, `tick(2000)`, third dispatch succeeds.
4. **Backward-compat**: no limiter → 10 create+dispatch cycles all
   succeed. Asserts `h.bucket === undefined`.

The bucket uses a test-controlled monotonic clock advanced via
`tick(ms)` so the refill case is deterministic.

## 5. Validation

- `bun test packages/server-core/src/handlers/rpc/__tests__/`
  — 218 pass / 0 fail / 509 expect() across 11 files
  (was 214 / 484 / 10 files; +4 cases / +25 expect / +1 file).
- `bun run validate:rebrand` — passes.
- `bun run validate:agent-contract` — `ok: 11 skills, 309 tickets,
  7 required docs`.
- `bun run validate:roadmap` — `OK — 46 phases, 110 tickets`.

## 6. Constraints honoured

- T071 `TokenBucket` class — untouched.
- T071b `roles.ts` — untouched.
- `handler-deps.ts` — untouched (`rateLimiter` field already present
  from T071b).
- `packages/shared/src/security/` — untouched.
- T243-rpc audit / observability hooks — untouched.
- `.swarm/master-roadmap-log.md` — untouched.
- Files modified: only `missions.ts` and the new test file in
  `__tests__/`. Plus this ticket and worklog under `docs/`.
- LOC: 9 source / 197 tests (budgets 80 / 200).

## 7. Follow-up

- Surfaces beyond the missions admin RPC (experience-layer abuse
  vectors, automation triggers, etc.) remain candidates for future
  rate-limit / budget integration. Out of scope for T071c.
