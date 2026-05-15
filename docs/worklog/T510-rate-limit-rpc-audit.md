# T510 — Security Audit: RPC Handler Rate-Limiting Coverage

Status: DONE
Phase: R.11 / v1.0.x security-hardening
Ticket: docs/tickets/T510-rate-limit-rpc-audit.md

## 1. Task summary

Audit all RPC handler files in `packages/server-core/src/handlers/rpc/` for rate-limiting coverage. Produce a Markdown audit report and ticket file. No source code changes.

## 2. Repo context discovered

- 22 registered handler files with RPC channels, plus helper/barrel/test files excluded.
- Registration confirmed through `packages/server-core/src/handlers/rpc/index.ts`: `server.ts` is registered when `serverCtx` is present; `messaging.ts` is registered unconditionally and exits early only when `deps.messagingRegistry` is absent.
- T086d abuse-guard pattern is present in 9 registered handler files.
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
- `packages/server-core/src/handlers/rpc/server.ts`
- `packages/server-core/src/handlers/rpc/messaging.ts`
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

- Added `docs/release/security-rate-limit-audit-2026-05-15.md` — full audit table covering 22 registered handler files (218 `server.handle(...)` registrations), aggregate statistics, risk-ordered fix recommendations, and 11 follow-up tickets (T512–T522).
- Added `docs/tickets/T510-rate-limit-rpc-audit.md` with bare `Status: DONE` line per validator contract.
- Added this worklog `docs/worklog/T510-rate-limit-rpc-audit.md`.
- Preserved already-landed worklogs for adjacent tickets while keeping the
  T510 patch itself audit-only.
- No source code was modified.

## 7. Validation commands run

```bash
bun run validate:docs
git diff --check
```

## 8. Passing test output summary

```text
[agent-contract] ok: 11 skills, 466 tickets, 7 required docs
[architecture-docs] ok
[sync-v2-design] validated
git diff --check => no output
```

## 9. Build output summary

No build required. Documentation-only change; no source code or runtime behavior affected.

## 10. Remaining risks

- T512–T522 are unfiled follow-up tickets. The audit identifies 12 registered handler files with no rate limiting; highest risk are `oauth.ts`, `onboarding.ts`, `llm-connections.ts`, and provider-facing messaging channels.
- The WS-RPC transport means no HTTP 429 / Retry-After is ever sent. T520 tracks the architectural fix required to close the CLAUDE.md compliance gap.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
|---|---|---|
| Audit covers registered RPC handler files | PASS | 22/22 registered handler files audited (100%) |
| Table renders as valid Markdown | PASS | Pipe-table format; renders in PR preview |
| No source code modified | PASS | Only docs/ files written |
| `bun run validate:docs` passes | PASS | See section 8 |
| Follow-up tickets T512+ identified | PASS | T512–T522 listed in audit doc |
