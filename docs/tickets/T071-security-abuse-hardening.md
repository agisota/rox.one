# T071 - Security and Abuse Hardening

Status: DONE

## Goal

Close the remaining deny-by-default abuse paths before final release candidate.

## Scope

- Harden mission budget accounting against spoofed scheduler events.
- Harden branch expansion input validation before any expensive swarm expansion.
- Harden public share payload redaction for secret-like values embedded in
  ordinary content strings.
- Harden account billing payloads so ledger metadata cannot expose provider
  secrets, cookies, or bearer tokens through the cabinet API.
- Preserve deterministic fake-provider tests.
- Do not call real external providers.
- Do not modify account/share/session behavior unless a security regression is
  directly proven by tests.

## Required Tests

- Mission scheduler event cost spoofing cannot increase remaining budget.
- Negative, non-finite, or zero branch expansion inputs fail closed.
- Public share sanitizer redacts bearer tokens, env-style API keys, cookies,
  passwords, and session values embedded in content fields.
- Account cabinet billing sanitizer redacts ledger metadata keys and
  secret-looking string values while preserving harmless references.
- Budget/capacity/human approval gates continue to block expansion.
- Existing tenant/RBAC/package/entitlement/security tests continue to pass.

## Acceptance Criteria

- [x] Negative scheduler event costs are rejected or ignored safely.
- [x] Branch expansion rejects invalid agent counts and estimated costs.
- [x] Public share payload redacts secret-like values.
- [x] Account billing payload redacts ledger metadata secrets.
- [x] Mission budget bypass tests pass.
- [x] Existing security guard tests pass.
- [x] Worklog is complete.
- [x] Scoped commit exists.

## Worklog

- `docs/worklog/T071-security-abuse-hardening.md`

## Completion (Round 2 — abuse-hardening primitives)

Round 2 (M.13) ships pure rate-limit + budget primitives under
`@rox-one/shared/security`. RPC handler integration is deferred to T071b so
this slice is reviewable and reverts cleanly. No existing RPC handler is
modified by this round.

Primitives shipped:

- `TokenBucket` — `{capacity, refillRatePerSec, clock, initialTokens?}` with
  `tryAcquire(n=1): boolean`, continuous refill, clamped capacity, clock
  regression guard.
- `SlidingWindowCounter` — `{windowMs, clock, maxEvents?}` with `record():
  count` and `count()` peek, lazy pruning, drop-oldest under `maxEvents` cap.
- `BudgetGuard<TKey>` — `{budgetPerKey}` with `consume(key, amount):
  BudgetResult`, `usage(key)`, `remaining(key)`, `reset(key?)`. Discriminated
  result union (`{ok:true, remaining}` or `{ok:false, error}`) with
  `BudgetExceededError` carrying structured telemetry fields.

Files added:

- `packages/shared/src/security/rate-limiter.ts`
- `packages/shared/src/security/budget-guard.ts`
- `packages/shared/src/security/index.ts`
- `packages/shared/src/security/__tests__/rate-limiter.test.ts`
- `packages/shared/src/security/__tests__/budget-guard.test.ts`
- `packages/shared/package.json` — new subpath exports
  `@rox-one/shared/security`, `…/security/rate-limiter`,
  `…/security/budget-guard`.
- `docs/worklog/T071-security-abuse-hardening.md` — round-2 section appended.

Tests:

- 42 pass / 0 fail / 138 expect() calls across the two new test files.
- Determinism: every test injects a fake `() => number` clock. No
  `Date.now()` is reachable from the new modules.

Follow-up:

- **T071b** — wire `TokenBucket` (per-IP + per-user) and `BudgetGuard` into
  RPC handlers + propagate `BudgetExceededError` to a 429-equivalent
  user-facing error. Out of scope for this slice.
