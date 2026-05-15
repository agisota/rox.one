# T510 — Security Audit: RPC Handler Rate-Limiting Coverage

Status: DONE
Phase: R.11 / v1.0.x security-hardening
Owner: agent-executor

---

## Summary

Audit every RPC handler in `packages/server-core/src/handlers/rpc/` for rate-limiting and abuse-guard coverage. Produce a Markdown report; no source code changes.

## Background

CLAUDE.md mandates: "Rate-limit all public APIs: per-IP and per-user limits, return 429 with Retry-After." The T086d ticket shipped a token-bucket / per-actor-budget-guard pattern for a subset of handlers. This audit establishes which handlers remain unprotected ahead of the v1.0.x patch cycle.

## Deliverables

- `docs/release/security-rate-limit-audit-2026-05-15.md` — full audit table and recommendations
- `docs/tickets/T510-rate-limit-rpc-audit.md` — this ticket

## Key Findings

- **22 registered handler files** with RPC channels audited (218 `server.handle(...)` registrations).
- **9 handler files** have the T086d abuse-guard pattern (rateLimiter + budgetGuard).
- **3 handler files** are fully protected: `labels.ts`, `statuses.ts`, `skills.ts`.
- **12 handler files** have no rate limiting: `oauth.ts`, `onboarding.ts`, `llm-connections.ts`, `settings.ts`, `files.ts`, `resources.ts`, `automations.ts`, `transfer.ts`, `system.ts`, `experience.ts`, `server.ts`, `messaging.ts`.
- **No handler** returns an HTTP 429 status or `Retry-After` header — the transport is WS-RPC; error is returned as `{error: 'rate-limited'}` JSON envelope. This is an architectural gap (see T520).

## Follow-Up Tickets

| Ticket | Scope | Priority |
|---|---|---|
| T512 | Rate-limit `oauth.ts` (all 4 channels) | P1 |
| T513 | Rate-limit `onboarding.ts` auth-flow channels | P1 |
| T514 | Rate-limit `llm-connections.ts` expensive channels | P1 |
| T515 | Rate-limit `automations.ts` (test, replay) | P2 |
| T516 | Rate-limit `files.ts` (storeAttachment, generateThumbnail) | P2 |
| T517 | Rate-limit `transfer.ts` (start, chunk) | P2 |
| T518 | Rate-limit `experience.ts` (emit) | P3 |
| T519 | Rate-limit `resources.ts` (import) | P3 |
| T520 | 429 + Retry-After HTTP translation layer | P3 |
| T521 | Close remaining partial-handler gaps | P3 |
| T522 | Rate-limit provider/pairing/access mutations in `messaging.ts` and workspace creation in `server.ts` | P3 |

## Acceptance Criteria

- [x] Audit table covers all registered RPC handler files in `index.ts` (22/22)
- [x] Table renders correctly as Markdown
- [x] `bun run validate:docs` passes (doc-only change, no source modifications)
- [x] No source code modified
