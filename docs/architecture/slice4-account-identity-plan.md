# Slice 4 — Account & Identity Plan

- Status: in-progress
- Date: 2026-05-09
- Companion ADR: `docs/decision-records/audit-harness/0006-account-identity-foundation.md`

## Purpose

Slice 4 establishes the account & identity foundation that subsequent slices
(team workspaces, billing, audit harness) depend on. The bulk of the foundation
already landed on `main` ahead of this branch; the remaining work in this
session is **token-model hardening + documentation**, not new feature work.

This document records:

1. What is already on `main` (file-by-file).
2. What this branch changes (rotation hardening + docs).
3. What is explicitly **deferred** to a later slice.
4. Threat-model coverage and dependencies.

## Already on `main` — current state

| File | LOC | Responsibility |
|------|-----|----------------|
| `packages/server-core/src/accounts/types.ts` | 98 | `AccountStore` interface, `PublicUser`, `AccountSession`, `SessionIdentity`, error types |
| `packages/server-core/src/accounts/postgres-store.ts` | 410 | `PostgresAccountStore`: argon2id via `Bun.password`, sha256-hashed email/reset tokens, 32-byte random tokens, advisory-lock first-admin promotion, soft-revoke sessions |
| `packages/server-core/src/accounts/__tests__/postgres-store.test.ts` | 26 | Postgres store integration test scaffold |
| `packages/server-core/src/persistence/agent-workbench-persistence.ts` (lines 132–329) | ~200 | `InMemoryAccountStore` mirroring the full `AccountStore` interface for tests |
| `packages/server-core/src/webui/auth.ts` | 221 (pre-rotation) | Cookie/JWT helpers, `RateLimiter` (per-IP + global), `validateAccountSession` joining cookie → DB session |

Wiring: `accountStore` is provisioned in `handler-deps.ts` and surfaced in
`webui/http-server.ts` (`createAccountCookie`, `issueAccountCookie`,
`requireAccountSession`). The legacy single-password `validateSession` path
remains in place for non-account deployments.

### Hash & token primitives

- **Passwords:** argon2id via `Bun.password.hash` / `Bun.password.verify`
  (constant-time; algorithm explicit at every call site).
- **Email-verification & password-reset tokens:** 32 bytes (`randomBytes(32)`)
  base64url-encoded, persisted as sha256 hex digests; the raw token leaves the
  server only in the email link.
- **Account session ids:** UUID v4 (`randomUUID()`), recorded in
  `rox_account_sessions` with explicit `expires_at` and `revoked_at`.
- **First-admin promotion:** Postgres advisory lock
  (`pg_advisory_xact_lock(hashtext('rox_account_first_admin'))`) prevents a
  concurrent-signup race that would otherwise mint two admins.

## Threat-model coverage

| Threat | Mitigation in current code |
|--------|---------------------------|
| Password brute force (online) | `RateLimiter` per-IP (5/60s) + global (20/60s) on `/api/auth/*`; argon2id verification cost. |
| Password brute force (offline / DB dump) | Argon2id with default Bun parameters; salt embedded in encoded hash; raw passwords never stored or logged. |
| Session hijack via XSS | `HttpOnly` cookies; `SameSite=Strict`; `Secure` flag when TLS-fronted. |
| Session fixation | `accountStore.createSession` mints a fresh server-side session id at every login; cookie is reset on each `issueAccountCookie`. Pre-login → post-login id rotation is mandated by code path, not by manual rotation calls. |
| CSRF on state-changing endpoints | `SameSite=Strict` cookie + same-origin fetches from the web UI; no cross-site form posts permitted. |
| Token replay (email links) | Tokens are sha256-hashed at rest, single-use (`consumed_at`), and time-bounded (24h verify, 1h reset). |
| Timing attack on token comparison | sha256 lookup is performed by SQL `=` against indexed hashes — equality is between fixed-length 64-char hex strings whose value is derived from a server-controlled keyed digest, eliminating practical timing oracles on raw tokens. Password verification uses Bun's constant-time argon2 verifier. |
| Long-lived bearer reuse | **Closed by this branch.** Pre-branch, the cookie was a 24h JWT bearing `{ sub, sid }`. This branch rotates the underlying DB session id on a sliding window so a stolen cookie ages out even if it is exfiltrated mid-window. See ADR 0006. |
| Race on first-admin promotion | Advisory transaction lock (Postgres) serialises the count→insert critical section. |

## What this branch changes

1. **Timing-safe-equality audit & guard test** — `packages/server-core/src/webui/__tests__/auth-timing.test.ts` documents that no in-process byte equality is performed on tokens or hashes (SQL handles all token equality), and asserts the property by inspecting `auth.ts` for forbidden patterns. Future regressions will fail this test before review.
2. **Session-id rotation on use** — `auth.ts` and `http-server.ts` cooperate to rotate the DB session id on a sliding window (configurable, default 15 min) without forcing the user to re-authenticate. The cookie continues to carry an opaque, server-controlled identifier (no raw secret material), and the JWT envelope is preserved for compatibility with the existing call sites.
3. **ADR 0006 + this plan** — first canonical record of the account-identity foundation.

## Deferred — out of scope this slice

These are explicit non-goals; they should not be opportunistically added in a
review cycle.

- **OAuth / SSO providers** (Google, GitHub, SAML). The `AccountAuthMethod` enum
  is already extensible, but no provider integrations land in slice 4.
- **MFA / WebAuthn second factor.** No TOTP/WebAuthn registration, challenge,
  or recovery-code paths.
- **Account-recovery edge cases beyond the happy path.** Email-change challenge,
  break-glass admin recovery, and expired-mailbox recovery are deferred.
- **Real multi-tenant `WorkspaceScope` enforcement.** `grantWorkspaceOwner` /
  `isWorkspaceOwner` is in place, but the `WorkspaceScope` type that gates RPC
  handlers lands in Session +3 / +5 and is referenced here only as a dependency.
- **Refresh-token model** (long-lived refresh + short-lived access). The current
  rotation strategy (sliding-window opaque session id) is sufficient for slice 4
  and avoids the additional surface area of a refresh-token table.
- **Device list UI / "log out everywhere" UX.** The store has
  `revokeUserSessions` and `revokeOtherSessions`; surfacing them in the UI is a
  later slice.

## Dependencies

- **`WorkspaceScope`** (Session +3) — the typed scope object every authenticated
  RPC handler will receive. Slice 4 does not block on it; the account store is
  ready to feed scope construction.
- **Email transport** — `accountEmailService` is injected; production
  deployments must supply an SMTP/Resend implementation. The default redacts
  links to logs only.
- **Postgres** — required for the production `AccountStore`. Tests rely on the
  in-memory implementation.

## Verification gates this branch must clear

- `bun test packages/server-core` — must remain at the pre-branch pass count
  plus any new tests added here, with zero failures.
- `bunx tsc --noEmit` from `packages/server-core` — clean.
- ADR 0006 present and dated.
- PR body explicitly requests a security-reviewer pass before merge.
