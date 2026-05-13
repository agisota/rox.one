# T071b - Wire TokenBucket into RBAC admin RPC handlers

## 1. Task summary

Wire the T071 round-2 `TokenBucket` primitive into the RBAC admin RPC
handlers so a single actor cannot exhaust the `roles.grant` /
`roles.revoke` mutating channels with a burst of requests. The
integration is OPTIONAL — hosts that don't inject a `rateLimiter`
behave identically to the pre-T071b baseline.

## 2. Repo context discovered

- T071 round-2 (PR #133, landed on `main`) shipped pure rate-limit and
  budget primitives at `packages/shared/src/security/`:
  `TokenBucket`, `SlidingWindowCounter`, `BudgetGuard`. RPC integration
  was explicitly deferred to T071b. The package subpath export
  `@rox-one/shared/security` was added at the same time.
- The RBAC admin RPC handlers (T227) are in
  `packages/server-core/src/handlers/rpc/roles.ts` and respond to
  `roles.list`, `roles.create`, `roles.grant`, `roles.revoke`. Failure
  modes use a structured `{error, reason}` shape rather than throws.
- T246 (PR #144) wired an optional `AuditProducer` to the same handler
  pair. The audit emit lives AFTER the grant store mutation on the
  success path, so any new short-circuit (like rate-limiting) must
  sit BEFORE the grant store call to leave no audit trail.
- `HandlerDeps` (`packages/server-core/src/handlers/handler-deps.ts`)
  follows an "all fields optional except sessionManager / platform /
  oauthFlowStore" convention so hosts can adopt features
  incrementally.

## 3. Files inspected

- `packages/shared/src/security/index.ts`
- `packages/shared/src/security/rate-limiter.ts`
- `packages/shared/package.json` (subpath exports)
- `packages/server-core/src/handlers/handler-deps.ts`
- `packages/server-core/src/handlers/rpc/roles.ts`
- `packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`
- `packages/server-core/src/handlers/rpc/__tests__/roles-audit.test.ts`
- `packages/shared/src/auth/rbac-resolver.ts` (InMemoryGrantStore API)
- `packages/shared/src/observability/audit-event.ts` (AuditEvent
  shape for the audit-silence assertion)
- `docs/tickets/T071-security-abuse-hardening.md` (round-2 follow-up
  pointer that named T071b)

## 4. Implementation

### handler-deps.ts (+15 LOC)

- New import: `import type { TokenBucket } from '@rox-one/shared/security'`.
- New optional field `rateLimiter?: TokenBucket` with doc-comment
  describing the contract (optional, runs before audit, host owns
  scoping/lifetime).

### roles.ts (+16 LOC)

Two identical four-line gates added at the very entry of
`roles.grant` and `roles.revoke`:

```ts
if (deps.rateLimiter && !deps.rateLimiter.tryAcquire(1)) {
  return { error: 'rate-limited', reason: 'token-bucket-exhausted' }
}
```

Placement rationale:

- BEFORE argument validation — abuse traffic with malformed payloads
  must still consume bucket tokens, otherwise an attacker can probe
  permission checks for free with junk input.
- BEFORE the permission check — same reason; the limit is the OUTER
  gate.
- BEFORE the grant store mutation — rate-limited requests leave no
  state change.
- BEFORE the audit producer — rate-limited requests leave no audit
  record. This preserves the T246 invariant that every `RoleGranted`
  / `RoleRevoked` corresponds to a real permission change.

The `roles.list` and `roles.create` handlers are intentionally NOT
gated. `roles.list` is a universal read channel; `roles.create` is
already restricted to global owners and is not a hot path. The
mission scheduler is out of scope here (T071c follow-up).

### Tests (`roles-rate-limit.test.ts`, 236 LOC, 8 cases, 59 expect())

Cases:

1. Burst: 10 grants against capacity-3 / refill-0-per-sec → 3 OK + 7
   rate-limited; only u0/u1/u2 reach the grant store.
2. Refill: capacity-2 / refill-1-per-sec → drain, advance clock
   2000ms, 2 more succeed before the next limit.
3. Audit silence: capacity-1 + AuditProducer → exactly one
   `RoleGranted` emit across two grant attempts.
4. Drain on reject: rate-limit fires before permission-denied; the
   bucket drains even on rejected requests.
5. Revoke gating: capacity-2 → 3 revokes, third is rate-limited, the
   un-revoked grant remains in the store.
6. Mutual rate-limit: grant and revoke share the same bucket.
7. Backward-compat: no limiter → 20 grants all succeed.
8. Backward-compat: no limiter → 5 revokes all succeed.

The bucket uses a test-controlled monotonic clock advanced via
`tick(ms)` so the refill case is deterministic.

## 5. Validation

- `bun test packages/server-core/src/handlers/rpc/__tests__/`
  — 214 pass / 0 fail / 484 expect() across 10 files.
- `bun run validate:rebrand` — passes.
- `bun run validate:agent-contract` — `ok: 11 skills, 307 tickets,
  7 required docs`.
- `bun run validate:roadmap` — `OK — 46 phases, 110 tickets across
  detail files`.

## 6. Constraints honoured

- T071 `TokenBucket` class — untouched.
- T246 audit producer — untouched; new rate-limit gate sits BEFORE
  the existing audit emit so audit semantics are unchanged on
  unlimited requests.
- Mission scheduler — untouched (T071c will do that surface).
- `.swarm/master-roadmap-log.md` — untouched.
- Files modified: only `handler-deps.ts`, `roles.ts`, and the new
  test file in `__tests__/`.
- LOC: 31 source / 236 tests (budgets 150 / 250).

## 7. Follow-up

- **T071c** — wire `TokenBucket` and `BudgetGuard` into the mission
  scheduler expansion path and any other abuse-prone surfaces named
  in the T071 round-2 follow-up note. Distinct module ownership and
  larger surface area; deferred to keep T071b small and reviewable.
