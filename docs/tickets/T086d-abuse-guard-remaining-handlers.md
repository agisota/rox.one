# T086d — abuse-guard remaining mutating RPC handlers

Status: DONE
Phase: M.13

## Summary

Applies the TokenBucket + BudgetGuard abuse-guard pattern (established in T086c
for labels/statuses/skills) to 7 remaining mutating RPC handlers across 5 domains.

The gates run BEFORE input validation and BEFORE any state mutation so a
rate-limited or budget-exhausted call returns the typed `{error, reason}` envelope
without touching credentials, sessions, sources, or workspace storage. When neither
`rateLimiter` nor `budgetGuard` is injected the handlers behave identically to the
pre-T086d baseline (no gate = no change).

## Handlers guarded

| Domain     | Handler                  | File                                                    |
|------------|--------------------------|----------------------------------------------------------|
| auth       | auth.logout              | packages/server-core/src/handlers/rpc/auth.ts           |
| sessions   | sessions.create          | packages/server-core/src/handlers/rpc/sessions.ts       |
| sessions   | sessions.delete          | packages/server-core/src/handlers/rpc/sessions.ts       |
| sessions   | sessions.sendMessage     | packages/server-core/src/handlers/rpc/sessions.ts       |
| sources    | sources.create           | packages/server-core/src/handlers/rpc/sources.ts        |
| sources    | sources.delete           | packages/server-core/src/handlers/rpc/sources.ts        |
| workspace  | workspaces.create        | packages/server-core/src/handlers/rpc/workspace.ts      |

`sessions.create` + `sessions.delete` share the injected bucket and guard so
alternating create/delete bursts cannot bypass either cap. Same shared-gate
pattern applies to `sources.create` + `sources.delete`.

## Tests

New test file (mirroring T086c structure):
`packages/server-core/src/handlers/rpc/__tests__/auth-sessions-sources-workspace-abuse-guard.test.ts`

Covers:
- TokenBucket burst-then-limited for each new handler
- BudgetGuard per-actor cap and isolation for each new handler
- Shared-bucket / shared-budget between create+delete pairs (sessions, sources)
- Backward-compatibility: no gates wired → handlers reach own logic, no envelope returned
- Anonymous sentinel (`__anonymous__`) for null userId

## Reference

Canonical pattern: `labels-statuses-skills-abuse-guard.test.ts` (T086c)
Prior instances: `roles-rate-limit.test.ts` (T071b), `missions-rate-limit.test.ts` (T071c/T086b)
