# Decision 0012: RBAC and RPC Input Validation at the Boundary

- Status: accepted
- Date: 2026-05-13
- Implements: T038 (security-hardening pass) and T303 (RPC input-validation
  hardening). Companion to ADR 0009 (RBAC policy) and ADR 0013 (RBAC
  property tests + schema reservation).
- Source tickets: `docs/tickets/T038-security-hardening.md`,
  `docs/tickets/T303-rpc-input-validation-hardening.md`,
  `docs/release/rpc-input-validation-audit.md`.

## Canonical

All RPC handlers MUST validate input at the boundary using Zod or
equivalent; rejection happens before any business logic touches the
payload.

```text
input_validation:
  surface:
    files: packages/server-core/src/handlers/rpc/*.ts
    entrypoint: server.handle(channel, handler)
  validator_module:
    file: packages/server-core/src/handlers/rpc/_validators.ts
    primitives:
      parseId:             non-empty trimmable string, <=256 chars,
                           rejects control chars (NUL / ANSI / DEL)
      parseSlug:            parseId + rejects '..', leading '/', '\\',
                           '*'/'.' meta tokens; safe for path.join
      parseOptionalString: undefined/null pass through, else parseId
      parseStringArray:    array discriminator + per-item parse + cap
      parseEnum:           allow-list discriminator
      parseCreateLabelInput: narrow object schema mirroring shared DTO
  error_shape:
    type:    Error & { code: 'INVALID_INPUT' }
    contract: thrown synchronously, surfaced to caller without leaking
              internal payload details
  audit_doc:
    file: docs/release/rpc-input-validation-audit.md
    coverage: every handler file with server.handle(...),
              risk-classified (HIGH | MED | LOW), remediation status
```

## Decisions

Five decisions, each with rationale.

### 1. Validate at the boundary, never inside business logic

Every public RPC handler that registers via `server.handle(channel, fn)`
runs its input through a `_validators.ts` primitive at the first line
of the handler body. Normalization, defaulting, and domain coercion
never happen before the parse step. If the input fails the parser the
handler returns the typed error envelope and never touches the store,
the producer, or any other side-effecting dependency.

**Reasons.**

- **One audit point per handler.** Reviewers scan the first ~5 lines
  of each handler and confirm the boundary check is present. No
  hunting through helpers to find late-running guards.
- **Defence in depth without duplication.** Storage adapters,
  schedulers, and producers are written assuming their inputs were
  already validated. Re-validating at every internal boundary buys
  little and costs maintenance.
- **Tampering produces a clean rejection.** A malformed payload — from
  a forged client, a fuzz harness, or an upstream bug — never reaches
  the audit producer, so audit logs never carry spurious
  "validation-failed" rows that pollute the trail.

### 2. Single shared validator module; no per-handler ad-hoc parsing

`packages/server-core/src/handlers/rpc/_validators.ts` is the only home
for primitives. Handlers import (`parseId`, `parseSlug`,
`parseStringArray`, `parseEnum`, `parseCreateLabelInput`,
`parseOptionalString`). No handler implements its own check inline.
New handlers extend the validator module rather than open-coding.

**Reasons.**

- **Consistent rules across surfaces.** "Reject NUL bytes",
  "reject path-traversal tokens", and "trim then bound to 256 chars"
  apply uniformly. A new handler cannot accidentally relax the rule.
- **Property-test scale.** A single module of pure parsers can be
  exhaustively property-tested (every parser × every malformed
  payload class). Per-handler bespoke parsing forces per-handler
  property suites that drift out of sync.
- **Zero-dep posture preserved for `server-core`.** Today the
  parsers are hand-rolled TypeScript. When/if a Zod edge is approved
  for `server-core`, the migration replaces the primitives in one
  module — handlers are unchanged.

### 3. Typed `INVALID_INPUT` error code; never throw raw strings

Every parser throws `Error & { code: 'INVALID_INPUT' }`. The handler
catches at the entry seam and returns the typed envelope
`{ error: 'invalid-input', reason: <validator-code> }`. The
`code` discriminator is the only contract — error messages may
change for human readability without breaking clients.

**Reasons.**

- **Clients branch on `code`, not on prose.** Telemetry pipelines
  count `INVALID_INPUT` by code and dimension; UI flows surface
  "your input was rejected" without parsing English.
- **No PII leakage in logs.** The error never echoes the offending
  payload (e.g. a leaked path fragment, a session token mistaken
  for an id). The reason names the rule, not the input.
- **Mirrors existing handler error contract.** RBAC and missions
  already returned `{ error, reason }` envelopes; input validation
  reuses the same shape so callers do not learn a second pattern.

### 4. HIGH-risk handlers hardened first; audit doc tracks the rest

T303's first slice hardened the three HIGH-risk handlers (`labels`,
`statuses`, `skills`) because they accept free-form strings that flow
into filesystem paths or unbounded arrays. MED- and LOW-risk handlers
are tracked in `docs/release/rpc-input-validation-audit.md` with an
explicit remediation owner (T052 for MED-risk batch, T071 for
mature-domain handlers like `llm-connections` and `workspace`).

**Reasons.**

- **Risk-proportionate effort.** A handler that only reads a
  workspace id from `ctx.session` and does no filesystem traversal
  carries a different threat profile than `skills.installFromSlug`.
  We do not pay equal hardening cost for unequal risk.
- **Visibility into incomplete coverage.** The audit doc is
  append-only; a reviewer sees at a glance which surfaces are
  parsed and which still rely on type-system gates alone.
- **Concurrent agent safety.** `roles.ts` and `missions.ts` were
  not touched by T303 because parallel RBAC work was landing.
  Tracked as `T303-roles` follow-up; the audit doc records that.

### 5. No new external dependency on `server-core` for T303

`server-core` does not depend on Zod today. T303 declines to
introduce the edge in this slice; the hand-rolled primitives are
strictly sufficient for the threats they catch (control chars,
path-traversal tokens, length caps, type discriminators). T071
extends the validator module to formal Zod schemas once the dep
edge is approved.

**Reasons.**

- **Reviewable diff.** Adding a runtime dep on Zod is a separate
  concern from the validation contract itself; mixing them
  inflates the review surface and complicates rollback.
- **Equivalent threat coverage today.** The hand-rolled parsers
  catch every malformed-input class the audit doc enumerates.
- **Forward-compatible.** When Zod lands, the module's exported
  function names stay constant. Handlers do not change.

## Invariants

Three invariants the input-validation slice holds.

### 1. Every handler with `server.handle(...)` parses inputs at the boundary

Enforced by:

- `docs/release/rpc-input-validation-audit.md` — explicit row per
  handler file with the validation state and remediation status.
- `packages/server-core/src/handlers/rpc/__tests__/input-validation-hardening.test.ts`
  — for every parser: rejects empty payload, rejects malformed type,
  rejects unknown discriminator, accepts valid payload.

### 2. Control characters and path-traversal tokens cannot reach domain logic

Enforced by:

- `parseId` (rejects NUL / ANSI / DEL) at every id-shaped input.
- `parseSlug` (rejects `..`, `/`, `\`, `*`, `.` meta tokens) at every
  filesystem-bound slug input (skills.ts).
- Tests: `skills` handler rejects path-traversal slugs before
  reaching `path.join`.

### 3. Rejected inputs leave no side effect

Enforced by structure: parser throws at entry, handler catches at
entry, no store / producer / scheduler is reachable on the throw
path. Tests assert grant-store and scheduler emptiness after
malformed-input rejection.

## Out of scope

- **Zod adoption for `server-core`** — deferred to T071. The
  primitive surface is named to match Zod's schema API so the
  migration is mechanical.
- **`roles.ts` and `missions.ts` parsing pass** — concurrent RBAC
  work landed first; remediation tracked under `T303-roles`.
- **Client-side input shaping** — renderer code may pre-validate
  for UX but the server MUST not trust it.
