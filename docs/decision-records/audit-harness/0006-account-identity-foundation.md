# Decision 0006: Account Identity Foundation

- Status: accepted
- Date: 2026-05-09
- Companion plan: `docs/architecture/slice4-account-identity-plan.md`

## Canonical

```text
account_identity_foundation:
  password_hash: argon2id  # via Bun.password.hash, default Bun parameters
  email_token:
    bytes: 32              # randomBytes(32), base64url-encoded
    storage: sha256_hex    # raw token never persisted
    ttl:
      verify_email: 24h
      password_reset: 1h
  session:
    server_state: postgres # rox_account_sessions, soft revoke (revoked_at)
    cookie:
      envelope: jwt_hs256  # short-lived signed cookie
      ttl: 1h              # ACCOUNT_SESSION_TTL_SECONDS
      flags: [HttpOnly, SameSite=Strict, Secure?]
    rotation:
      window: 15m          # ACCOUNT_SESSION_ROTATION_WINDOW_MS
      trigger: /api/account/me GET
      action: mint_new_db_session_id, revoke_previous, reissue_cookie
  first_admin_promotion:
    mechanism: pg_advisory_xact_lock(hashtext('rox_account_first_admin'))
    invariant: at_most_one_admin_at_first_signup
  rate_limit:
    per_ip: 5_per_60s
    global: 20_per_60s
    scope: /api/auth/*
  store_paths:
    interface: packages/server-core/src/accounts/types.ts
    postgres: packages/server-core/src/accounts/postgres-store.ts
    in_memory: packages/server-core/src/persistence/agent-workbench-persistence.ts
    cookie_helpers: packages/server-core/src/webui/auth.ts
```

## Why

The audit-harness slice (and every later slice that issues authority over a
workspace) requires a stable, reviewable identity layer. Before slice 4 we had
a single shared password protecting the web UI; that is acceptable for a
single-operator development setup but cannot serve a multi-user, multi-tenant
deployment. The decisions captured here lock in the **minimum** correct
foundation so subsequent slices can compose on top without re-arguing the
primitives.

### Threat-model rationale

| Threat | Mitigation |
|--------|-----------|
| Online password brute force | RateLimiter (5/60s per-IP, 20/60s global); argon2id verification cost. |
| Offline password brute force (DB dump) | argon2id with default Bun parameters; per-user salt embedded in hash; raw passwords never written or logged. |
| Session fixation | DB session id is created server-side at login (`accountStore.createSession`); the pre-login cookie cannot promote into a logged-in cookie. |
| XSS-driven session theft | Cookies are `HttpOnly`, `SameSite=Strict`; production uses `Secure`. |
| CSRF | `SameSite=Strict` + same-origin fetches from the SPA. State-changing endpoints require the cookie + match origin. |
| Email-token replay | sha256-only at rest; single-use (`consumed_at`); time-bounded; stored hash is content-addressed via index. |
| Token-equality timing attack | All token equality is performed in SQL on indexed sha256 hex columns. The single in-process equality comparison (DV.net webhook signature) uses `crypto.timingSafeEqual`. The `auth-timing.test.ts` audit guards this property. |
| Long-lived bearer reuse (cookie exfiltration) | Cookie envelope TTL shortened from 24h → 1h. Underlying DB session id rotates on a 15-min sliding window so even an active stolen cookie ages out within ~15 min of the next legitimate request. |
| Concurrent first-admin race | Postgres advisory transaction lock serialises the count→insert critical section. |
| Cross-user session enumeration | Session ids are UUID v4 (`randomUUID`); the store never accepts a client-supplied id; lookup is by id only. |

### Token model — explicit choice

We considered three token-model options:

1. **Long-lived JWT bearer** (rejected — pre-slice-4 baseline).
   *Pro:* zero server state. *Con:* a stolen cookie remains valid for the full
   TTL with no recourse short of changing the signing secret (which logs out
   every user). Unacceptable as a hardened default.
2. **Short-TTL access JWT + DB-backed refresh token** (rejected for slice 4).
   *Pro:* well-trodden pattern, fine-grained access-token revocation.
   *Con:* doubles the surface area (refresh-token table, rotation logic,
   refresh-on-401 client behaviour). Additional value over option 3 is small
   for our deployment shape.
3. **Short-TTL JWT envelope + opaque DB session id with sliding-window rotation**
   (chosen).
   *Pro:* the cookie is **always** an opaque, server-revocable identifier. The
   JWT envelope merely binds the identifier to integrity-checked claims and
   bounds bearer reuse with a short hard TTL. Rotation cuts the practical
   replay window to ~15 minutes for an active session.
   *Con:* requires a rotation invocation point. We chose
   `GET /api/account/me` because the SPA polls it on every navigation; for
   long-idle sessions, the next page load re-rotates within seconds of return.

## Out of scope

Deferred to later slices, captured here so reviewers do not opportunistically
expand the slice 4 surface:

- OAuth / SAML providers; provider-link tables; account-merge UX.
- MFA (TOTP, WebAuthn); recovery codes.
- Email-change challenge flow; expired-mailbox break-glass.
- Refresh-token model — we chose sliding-window rotation instead; revisit only
  if cross-device long-idle sessions become a hard requirement.
- Device list / "log out everywhere" UX (the `revokeUserSessions` /
  `revokeOtherSessions` primitives already exist).
- True multi-tenant `WorkspaceScope` enforcement (depends on slice +3/+5).
- Anomaly detection (impossible-travel, geo-shift, UA-shift).
- Rotation triggers on every authenticated endpoint (slice 4 wires only
  `/api/account/me`; the helper is reusable wherever a future endpoint wants
  to opt in).

## Verification gates

- Bun test suite (`bun test packages/server-core`) at 248 pass / 0 fail
  including five new rotation tests + five new timing-audit tests.
- Type check (`bunx tsc --noEmit` from `packages/server-core`) clean.
- `auth-timing.test.ts` mechanically guards the no-JS-byte-equality property.
- ADR + plan doc landed in the same PR; PR body marked
  **SECURITY REVIEW REQUIRED** before merge.
