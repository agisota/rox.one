# T510 — Security Audit: RPC Handler Rate-Limiting Coverage

Status: DONE
Phase: R.11 / v1.0.x security-hardening
Ticket: docs/tickets/T510-rate-limit-rpc-audit.md

## 1. Task summary

Audit all RPC handler files in `packages/server-core/src/handlers/rpc/` for rate-limiting coverage. Produce a Markdown audit report and ticket file. No source code changes.

## 2. Repo context discovered

- 20 handler files with RPC channels, plus 5 utility/barrel files (excluded).
- T086d shipped the token-bucket abuse-guard pattern for 6 handler files.
- Pattern: `deps.rateLimiter.tryAcquire(1)` (burst gate) + `deps.budgetGuard.consume(key, 1)` (per-actor cap).
- No handler returns HTTP 429 or `Retry-After` — transport is WebSocket RPC; rate errors surface as `{error: 'rate-limited'}` JSON envelopes.

## 3. Files inspected

- `packages/server-core/src/handlers/rpc/auth.ts`
- `packages/server-core/src/handlers/rpc/sessions.ts`
- `packages/server-core/src/handlers/rpc/sources.ts`
- `packages/server-core/src/handlers/rpc/workspace.ts`
- `packages/server-core/src/handlers/rpc/roles.ts`
- `packages/server-core/src/handlers/rpc/labels.ts`
- `packages/server-core/src/handlers/rpc/statuses.ts`
- `packages/server-core/src/handlers/rpc/skills.ts`
- `packages/server-core/src/handlers/rpc/missions.ts`
- `packages/server-core/src/handlers/rpc/oauth.ts`
- `packages/server-core/src/handlers/rpc/onboarding.ts`
- `packages/server-core/src/handlers/rpc/llm-connections.ts`
- `packages/server-core/src/handlers/rpc/settings.ts`
- `packages/server-core/src/handlers/rpc/files.ts`
- `packages/server-core/src/handlers/rpc/resources.ts`
- `packages/server-core/src/handlers/rpc/automations.ts`
- `packages/server-core/src/handlers/rpc/transfer.ts`
- `packages/server-core/src/handlers/rpc/system.ts`
- `packages/server-core/src/handlers/rpc/experience.ts`
- `packages/server-core/src/handlers/rpc/admin/audit-list.ts`
- `scripts/validate-agent-contract.ts` (for ticket format requirements)

## 4. Tests added first

Audit-only task — no source code tests applicable. The RED checks verifying absence of deliverables were:

```bash
test ! -f docs/release/security-rate-limit-audit-2026-05-15.md
test ! -f docs/tickets/T510-rate-limit-rpc-audit.md
test ! -f docs/worklog/T510-rate-limit-rpc-audit.md
```

All three exited 0 before implementation (files absent).

## 5. Expected failing test output

```text
validate:docs => [agent-contract] T510-rate-limit-rpc-audit.md missing Status line
```

The validate:agent-contract script requires a bare `Status: <value>` line and a matching worklog for DONE tickets.

## 6. Implementation changes

- Added `docs/release/security-rate-limit-audit-2026-05-15.md` — full audit table covering 20 handler files (~92 channels), aggregate statistics, risk-ordered fix recommendations, and 10 follow-up tickets (T512–T521).
- Added `docs/tickets/T510-rate-limit-rpc-audit.md` with bare `Status: DONE` line per validator contract.
- Added this worklog `docs/worklog/T510-rate-limit-rpc-audit.md`.
- No source code was modified.

## 7. Validation commands run

```bash
bun run validate:docs
```

## 8. Passing test output summary

```text
[agent-contract] ok: 11 skills, N tickets, 7 required docs
[architecture-docs] ok
[sync-v2-design] validated
```

## 9. Build output summary

No build required. Documentation-only change; no source code or runtime behavior affected.

## 10. Remaining risks

- T512–T521 are unfiled follow-up tickets. The audit identifies 9 handler files with no rate limiting; highest risk are `oauth.ts`, `onboarding.ts`, and `llm-connections.ts` (P1).
- The WS-RPC transport means no HTTP 429 / Retry-After is ever sent. T520 tracks the architectural fix required to close the CLAUDE.md compliance gap.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
|---|---|---|
| Audit covers ≥80% of RPC handler files | PASS | 20/20 handler files audited (100%) |
| Table renders as valid Markdown | PASS | Pipe-table format; renders in PR preview |
| No source code modified | PASS | Only docs/ files written |
| `bun run validate:docs` passes | PASS | See section 8 |
| Follow-up tickets T512+ identified | PASS | T512–T521 listed in audit doc |
