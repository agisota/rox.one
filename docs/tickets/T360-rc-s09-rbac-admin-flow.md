# T360 - RC S09 RBAC Admin Flow Smoke Harness

Status: DONE

## Resolution

`scripts/rc-smoke/s09-rbac-flow.ts` exists and runs cleanly on Linux:
`bun run scripts/rc-smoke/s09-rbac-flow.ts` → **201 pass / 0 fail** across
11 test files (roles RPC, audit, rate-limit, policy engine, scope forgery,
RBAC resolver, auth state, integrity pass, team-management state,
roles-panel state). Acceptance criteria already checked. Worklog populated.
Ticket left in `Status: OPEN` after the work landed; closing now with the
verification re-run on `ab345880` (2026-05-17).

## Context

Phase 20 RC scenarios S01-S08 cover registration, prompt pipeline, mission
checkpoint, arena/swarm VDI, team invite RBAC, file upload, sync conflict, and
share-session shortlink. They are registered in `scripts/e2e-smoke.ts` and
asserted by `scripts/__tests__/e2e-smoke-harness.test.ts`.

S09 extends the RC scenario series with the RBAC admin flow:

```
create role -> grant scope on workspace A -> assert workspace B unreachable
            -> revoke -> assert revoked
```

This path is distinct from S05 (team invite -> shared workspace) because it
exercises admin-side scope grant/revoke and cross-workspace isolation.

## Goal

Ship a standalone S09 smoke harness at `scripts/rc-smoke/s09-rbac-flow.ts`
that mirrors the S04-S08 pattern (`spawn` + explicit test list) and runs the
deterministic RBAC admin coverage already present in shared and server-core
test suites.

## Implementation Requirements

- Add no production dependency.
- Do not change RBAC, role, policy, or scope runtime behavior.
- Do not modify `scripts/e2e-smoke.ts` or
  `scripts/__tests__/e2e-smoke-harness.test.ts` (codex-managed).
- Keep the harness under 300 LOC.

## Validation Commands

```bash
bun run scripts/rc-smoke/s09-rbac-flow.ts
bun run validate:rebrand
bun run validate:agent-contract
bun run validate:roadmap
```

## Acceptance Criteria

- [x] `scripts/rc-smoke/s09-rbac-flow.ts` exists and mirrors the S04-S08
      scenario shape.
- [x] S09 test list covers role create/audit, policy engine, scope forgery,
      RBAC resolver, auth state, integrity pass, and RBAC settings state.
- [x] Harness exits non-zero on test failure and zero on success.
- [x] Existing S01-S08 entries in `scripts/e2e-smoke.ts` remain unchanged.
- [x] Worklog captures smoke and validation evidence.

## Worklog

See `docs/worklog/T360-rc-s09-rbac-admin-flow.md`.
