# T086c - Wire TokenBucket + BudgetGuard into remaining mutating RPC handlers

## 1. Task summary

Extend the two-layer abuse defense (T071b/T071c TokenBucket plus
T086b BudgetGuard) into a focused slice of the remaining mutating
RPC handlers in `packages/server-core/src/handlers/rpc/`. The
ticket lands the same envelope-returning gate pattern in
`labels.create`, `labels.delete`, `statuses.reorder`, and
`skills.delete` while documenting the remaining channels as
follow-up work for T086d.

The integration is OPTIONAL — hosts that don't inject a limiter
or a guard observe identical behaviour to the pre-T086c baseline.

## 2. Repo context discovered

- T071 round-2 (PR #133) shipped pure rate-limit / budget
  primitives at `packages/shared/src/security/`.
- T071b (PR #153) wired `TokenBucket` into `roles.grant` and
  `roles.revoke`.
- T071c (PR #164) wired the same gate into
  `missions.dispatchEvent`.
- T086b (PR #184) added `BudgetGuard<string>` to the same two
  handler files (`roles.ts` + `missions.ts`) and declared
  `HandlerDeps.budgetGuard` as optional alongside
  `HandlerDeps.rateLimiter`.
- The handler-deps contract is "all fields optional except
  `sessionManager`, `platform`, and `oauthFlowStore`" — so an
  unguarded handler simply omits the gate and the deps surface
  stays backwards-compatible.

The same envelope shape is reused here:
- `{error: 'rate-limited', reason: 'token-bucket-exhausted'}`
- `{error: 'budget-exceeded', reason: 'per-actor-cap-exhausted'}`

This keeps client-side abuse-handling code uniform across every
guarded channel.

## 3. Files inspected

- `packages/server-core/src/handlers/handler-deps.ts` (already
  carries `rateLimiter?` and `budgetGuard?` since T086b).
- `packages/server-core/src/handlers/rpc/roles.ts` (T071b/T086b
  gate reference).
- `packages/server-core/src/handlers/rpc/missions.ts` (T071c/T086b
  gate reference).
- `packages/server-core/src/handlers/rpc/__tests__/roles-rate-limit.test.ts`
  and `missions-rate-limit.test.ts` (test patterns).
- `packages/server-core/src/handlers/rpc/labels.ts`,
  `statuses.ts`, `skills.ts` (candidate handlers).
- `packages/server-core/src/handlers/rpc/transfer.ts` (registers
  via bare `RpcServer`; no `HandlerDeps` plumbing — explicitly
  deferred).
- `packages/shared/src/security/budget-guard.ts` and
  `rate-limiter.ts` (gate contracts).

## 4. Audit — handlers selected for this slice

Selection criteria:
- Mutating (writes workspace storage or filesystem state).
- Currently UNGUARDED by rate-limit / budget gates.
- Small / self-contained — minimal surface area for backward-
  compat regressions.

Handlers guarded:

| File | Channel | Mutation kind |
|------|---------|---------------|
| `labels.ts` | `labels.create` | append to workspace labels config |
| `labels.ts` | `labels.delete` | remove from workspace labels config |
| `statuses.ts` | `statuses.reorder` | rewrite workspace status order file |
| `skills.ts` | `skills.delete` | remove a skill directory from disk |

The deferred surface is enumerated in the ticket under
**Out of scope (T086d)**.

## 5. Implementation

### labels.ts (+39 LOC)

- Captured `deps` instead of `_deps` so handlers can read the
  optional limiter / guard.
- `labels.create` and `labels.delete` each prepend the two-gate
  block. Gates fire BEFORE `parseId` / `parseCreateLabelInput` /
  `getWorkspaceByNameOrId` so an exhausted bucket or budget never
  reaches the filesystem.
- The two channels share the same injected bucket / guard so an
  actor cannot bypass the cap by alternating create / delete
  bursts (mirrors the T071b/T086b decision for roles.grant +
  roles.revoke).

### statuses.ts (+19 LOC)

- Same `deps` rename.
- `statuses.reorder` (the only mutating channel in this file)
  picks up the two-gate block at handler entry.
- `statuses.list` (read-only) is intentionally left ungated.

### skills.ts (+20 LOC)

- `skills.delete` picks up the two-gate block at handler entry.
  This is the only filesystem-destructive channel in this file.
- `skills.get`, `skills.getFiles`, `skills.openEditor`,
  `skills.openFinder` are intentionally left ungated — they are
  read / launch-only.

### Tests (+327 LOC, 14 cases, 52 expect())

New test file
`packages/server-core/src/handlers/rpc/__tests__/labels-statuses-skills-abuse-guard.test.ts`
mirrors the harness pattern in `missions-rate-limit.test.ts`:

- `createHarness({ ... })` builds a stub `RpcServer`, injects an
  optional `TokenBucket` and / or `BudgetGuard<string>`, and
  registers all three target handlers via the existing
  `registerLabelsHandlers` / `registerStatusesHandlers` /
  `registerSkillsHandlers` entry points.
- A clock closure (`nowMs += ms`) drives `TokenBucket` refill so
  the suite runs in milliseconds.

Test groupings:

1. **labels.create — TokenBucket rate-limit** (3 cases):
   - burst then rate-limit;
   - rate-limit fires BEFORE validation (malformed input still
     drains the bucket);
   - refill restores throughput after a clock tick.
2. **labels.create — BudgetGuard per-actor cap** (2 cases):
   - exhaustion returns the typed envelope and stops at the
     gate (no filesystem touch);
   - different actor IDs have isolated budgets.
3. **labels.delete — TokenBucket + BudgetGuard** (2 cases):
   - shared bucket with `labels.create`;
   - shared budget with `labels.create`.
4. **statuses.reorder — TokenBucket** (1 case): burst then
   rate-limit.
5. **statuses.reorder — BudgetGuard** (2 cases): exhaustion
   envelope; reset restores budget.
6. **skills.delete — TokenBucket** (1 case): rate-limit fires
   before validation.
7. **skills.delete — BudgetGuard** (1 case): exhaustion and
   per-actor isolation.
8. **Backward compatibility** (2 cases):
   - no limiter + no guard => all four handlers proceed past the
     (absent) gate and surface the original `Workspace not found`
     error (proves the gate is invisible);
   - null `ctx.userId` falls back to the `'__anonymous__'`
     sentinel for per-actor budgets.

The "rejected calls do not touch the filesystem" property is
established by the gate placement: the gates run before
`getWorkspaceByNameOrId`, so a rejected call literally cannot
reach the storage write paths in `@rox-one/shared/labels/crud`,
`@rox-one/shared/statuses`, or `@rox-one/shared/skills`. The
tests rely on the same property by using a known-bad workspace
id (`'ws-x'`) — calls that pass the gate throw
`Workspace not found` from the existing handler body, while
gated calls return the typed envelope.

## 6. Validation

- `bun test packages/server-core/src/handlers/rpc/__tests__/labels-statuses-skills-abuse-guard.test.ts`
  — 14 pass / 0 fail / 52 expect() across 1 file.
- `bun test packages/server-core/src/handlers/rpc/__tests__/`
  — 337 pass / 0 fail / 864 expect() across 14 files
  (was 323 / 812 / 13 files before T086c; +14 cases / +52 expect()
  / +1 file).
- `bun run validate:rebrand` — passes (no forbidden tokens).
- `bun run validate:agent-contract` — `ok: 11 skills, 322
  tickets, 7 required docs`.
- `bun run validate:roadmap` — `OK — 46 phases, 110 tickets`.

## 7. Constraints honoured

- T071 `TokenBucket` / `BudgetGuard` — UNTOUCHED.
- `packages/shared/src/security/` — UNTOUCHED.
- T071b/T086b `roles.ts` gate — UNTOUCHED.
- T071c/T086b `missions.ts` gate — UNTOUCHED.
- `handler-deps.ts` — UNTOUCHED (T086b's optional
  `rateLimiter` / `budgetGuard` fields are reused as-is).
- `.swarm/master-roadmap-log.md` — UNTOUCHED.
- Files modified / added (source side): only `labels.ts`,
  `statuses.ts`, `skills.ts`.
- Test files added: one new
  `labels-statuses-skills-abuse-guard.test.ts`.
- Docs: ticket + worklog under `docs/`.
- LOC: 78 source / 327 tests (budgets 200 / 500).

## 8. Follow-up

- T086d should triage and wire the remaining mutating channels
  enumerated under **Out of scope (T086d)** in the ticket. The
  high-value targets (in order of estimated abuse blast radius):
  - `automations.*` write paths (can mint scheduled jobs).
  - `sessions.*` write paths (mutates session state).
  - `sources.*` / `llm-connections.*` write paths (mutates
    credentials / connections).
  - `workspace.*` write paths (workspace CRUD).
- `transfer.ts` registers via the bare `RpcServer` without
  `HandlerDeps`; guarding it requires a separate transport-side
  injection. Track as a dedicated transport-hardening ticket.
- Cap sizing remains a deployment concern (host-side
  `TokenBucket` / `BudgetGuard` construction).
