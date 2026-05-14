# T086c - Wire TokenBucket + BudgetGuard into remaining mutating RPC handlers

Status: DONE

## Goal

Extend the two-layer abuse defense (T071b/T071c TokenBucket +
T086b BudgetGuard) into a representative slice of the remaining
mutating RPC handlers. Each newly-guarded handler gains the SAME
gate pattern that ships in `roles.{grant,revoke}` and
`missions.dispatchEvent`:

1. Optional `rateLimiter.tryAcquire(1)` short-circuit returning
   `{error: 'rate-limited', reason: 'token-bucket-exhausted'}` —
   burst protection.
2. Optional `budgetGuard.consume(ctx.userId ?? '__anonymous__', 1)`
   short-circuit returning
   `{error: 'budget-exceeded', reason: 'per-actor-cap-exhausted'}` —
   per-actor lifetime cap.

The gates run BEFORE input validation and BEFORE the
filesystem/storage write so a rate-limited or budget-exhausted
request leaves no state change. Backward-compatible: hosts that
omit the limiter/guard observe identical behaviour to the
pre-T086c baseline.

## Scope

This ticket lands a 3-handler-file / 4-channel slice. The
remaining unguarded mutating channels are explicitly listed under
**Deferred follow-up (T086d)** so the abuse-hardening backlog
stays visible.

### Handlers guarded by this ticket

- `labels.create` — workspace label CRUD write
  (`packages/server-core/src/handlers/rpc/labels.ts`)
- `labels.delete` — workspace label CRUD delete (same file)
- `statuses.reorder` — workspace status order rewrite
  (`packages/server-core/src/handlers/rpc/statuses.ts`)
- `skills.delete` — workspace skill directory delete
  (`packages/server-core/src/handlers/rpc/skills.ts`)

The `labels.create` + `labels.delete` pair shares the same
injected bucket and budget — an actor cannot bypass the cap by
alternating between create and delete bursts. Same property the
T071b/T086b wiring chose for `roles.{grant,revoke}`.

### Out of scope (deferred to T086d)

The remaining mutating handlers across the server-core RPC surface
that would benefit from the same two-layer guard. They were left
ungated here to stay within the LOC budget and ship a focused PR.
Each is a known follow-up:

- `auth.*` (4 channels)
- `automations.*` (8 channels — write paths only)
- `experience.*` (3 channels — write paths only)
- `files.*` (11 channels — write paths only)
- `llm-connections.*` (24 channels — `SAVE` / `DELETE` paths)
- `messaging.*` (25 channels — write paths only)
- `oauth.*` (4 channels)
- `onboarding.*` (8 channels — write paths only)
- `resources.*` (2 channels — write paths only)
- `sessions.*` (25 channels — write paths only)
- `settings.*` (29 channels — write paths only)
- `sources.*` (9 channels — write paths only)
- `system.*` (14 channels — `open-url` etc.)
- `workspace.*` (23 channels — write paths only)
- `transfer.*` (4 channels — chunked-upload protocol, no
  `HandlerDeps` wiring; would require a separate transport-side
  guard injection)

T086d should triage this list against actual abuse risk
(file-system delete vs read-only metadata vs MFA-gated flows) and
prioritise the high-blast-radius channels.

## Rules

- Backward-compat MANDATORY.
- DO NOT modify `roles.ts` or `missions.ts` (T071b/T071c/T086b frozen).
- DO NOT modify `packages/shared/src/security/` (T071 frozen).
- DO NOT modify `handler-deps.ts` (T086b frozen).
- LOC budget: ≤200 source / ≤500 tests.

## Required Tests

A new test file
`packages/server-core/src/handlers/rpc/__tests__/labels-statuses-skills-abuse-guard.test.ts`
covers each newly-guarded handler:

- **labels.create**: burst rate-limit; gate-before-validation;
  refill timing; budget exhaustion; per-actor isolation.
- **labels.delete**: shared bucket with `labels.create`;
  shared budget with `labels.create`.
- **statuses.reorder**: burst rate-limit; budget exhaustion;
  reset restores budget.
- **skills.delete**: gate-before-validation rate-limit; budget
  per-actor isolation.
- **Backward compatibility**: no limiter + no guard => identical
  to baseline (handler still throws `Workspace not found` for an
  unknown workspace id, never the abuse-guard envelopes).
- **Anonymous fallback**: null `userId` consumes the
  `'__anonymous__'` budget bucket.

≥4 cases per newly-guarded handler. ≥12 expect() total
(actual: 14 tests / 52 expect()).

## Acceptance Criteria

- [x] `labels.create`, `labels.delete`, `statuses.reorder`, and
      `skills.delete` check `rateLimiter.tryAcquire` THEN
      `budgetGuard.consume` at the entry of the handler, BEFORE
      validation and storage writes.
- [x] Rate-limited / budget-exhausted requests do NOT touch the
      workspace filesystem.
- [x] Already-guarded handlers (`roles.ts`, `missions.ts`),
      shared security primitives, and `handler-deps.ts` are
      UNCHANGED.
- [x] All existing RPC tests continue to pass.
- [x] `validate:rebrand`, `validate:agent-contract`,
      `validate:roadmap` pass.
- [x] LOC budget respected (source 78 / tests 327).
- [x] Worklog complete.
- [x] Scoped commits and PR.

## Worklog

- `docs/worklog/T086c-remaining-handlers-abuse-guard.md`

## Follow-up

- T086d: extend the guard to the remaining mutating channels
  listed in the **Out of scope** section above. Triage by abuse
  risk before wiring.
- The `transfer.ts` family registers via the bare
  `RpcServer` (not `HandlerDeps`); guarding that surface needs a
  separate transport-side abuse-guard injection. Tracked here as
  out-of-scope for T086c/T086d and a candidate for a dedicated
  transport-hardening ticket.
- Cap sizing remains a deployment concern (host-side
  `TokenBucket` / `BudgetGuard` construction).
