# WT-10 — Cloudflare Access JWT validator — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for implementation (TDD-first)
**Ветка:** `feat/access-jwt`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-10-access-jwt/`
**Wave:** 1
**Priority:** P0
**Depends on:** WT-04 (user contract), WT-05 (tenant contract), WT-08 (audit/telemetry)
**Blocks:** WT-12 (account linking + JIT)
**Parent epic:** PZD-113 (E02 Auth/RBAC)
**FB board:** Enterprise B2B (`6a0db1dabaed70b5d8d3f898`)
**Feature flag:** `rox.feature.auth.cloudflare-access-jwt` (default OFF, release cut "Auth")

---

## 1. Контекст

ROX.ONE deploy внутри корпоративной сети часто стоит за Cloudflare Access (Zero Trust gateway). Access добавляет signed JWT в заголовок `Cf-Access-Jwt-Assertion` (или `CF_Authorization` cookie), содержащий identity-клеймы (email, groups, device posture). Текущий `oauth/*` модуль (Anthropic/Google/Slack/MS) не покрывает enterprise-кейс «headless SSO без OAuth-flow».

Этот WT добавляет дискретный validator для Access JWT с автоматическим обновлением JWKS, поддержкой ротации ключей, claim extraction в нативный `IdentityClaim` и защитой от replay-атак. Validator работает как pure-function middleware в main-process Electron (никаких renderer-side секретов) и пишет audit-events в `@rox-one/audit` (WT-08).

## 2. Цели и нецели

### 2.1 In scope

- Валидация JWT signature через JWKS (RS256/ES256) с auto-rotation cache.
- Проверка `iss` (team domain), `aud` (Access Application AUD), `exp`, `iat`, `nbf`.
- Извлечение `email`, `identity_nonce`, `country`, `custom.groups`, `device_posture`.
- Replay-protection через `identity_nonce` LRU TTL=10min.
- Audit-emit `auth.access_jwt.validated` / `auth.access_jwt.rejected` с reason code.
- Feature-flag-gated: при OFF — validator no-op, всё проходит как unauthenticated.

### 2.2 Out of scope

- OAuth flows (`oauth/*`) — НЕ ТРОГАТЬ.
- Account linking / JIT user provisioning → WT-12.
- SCIM provisioning → WT-11.
- RBAC role mapping → WT-14.
- UI для admin-настроек AUD/team-domain → WT-17.

## 3. Архитектура

```
┌────────────────────────────────────────────────────────────────┐
│  HTTP request → main process IPC bridge                        │
│       │                                                        │
│       ▼                                                        │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  AccessJwtValidator (apps/electron/main/auth/access- │      │
│  │   jwt/validator.ts)                                  │      │
│  │   ├─ extractTokenFromHeaders()                       │      │
│  │   ├─ JwksFetcher (packages/shared/auth/access-jwt/   │      │
│  │   │   jwks-fetcher.ts) — LRU cache, TTL=1h           │      │
│  │   ├─ verifySignature()  — jose library               │      │
│  │   ├─ verifyClaims()     — iss/aud/exp/iat/nbf        │      │
│  │   ├─ replayGuard()      — identity_nonce LRU         │      │
│  │   └─ ClaimExtractor (claim-extractor.ts) → Identity- │      │
│  │       Claim (см. @rox-one/shared/core/user.ts)       │      │
│  └──────────────────────────────────────────────────────┘      │
│       │                                                        │
│       ▼                                                        │
│  AuditEmitter (@rox-one/audit) → audit log + telemetry         │
└────────────────────────────────────────────────────────────────┘
```

### 3.1 Ключевые файлы (files_allowed)

- `apps/electron/src/main/auth/access-jwt/validator.ts`
- `apps/electron/src/main/auth/access-jwt/claim-extractor.ts`
- `apps/electron/src/main/auth/access-jwt/replay-guard.ts`
- `apps/electron/src/main/auth/access-jwt/index.ts`
- `packages/shared/src/auth/access-jwt/jwks-fetcher.ts`
- `packages/shared/src/auth/access-jwt/types.ts`
- `packages/shared/src/auth/access-jwt/index.ts`
- `tests/unit/auth/access-jwt/**/*.test.ts`
- `tests/integration/auth/access-jwt/**/*.test.ts`

### 3.2 files_forbidden

- `apps/electron/src/main/auth/oauth/**` — owned by existing OAuth subsystem.
- `packages/shared/src/auth/oauth/**`.
- `package.json`, `tsconfig*.json`, `bun.lock` — owned by WT-00 (scaffold-extension request).

### 3.3 Scaffold-extension requests

- WT-00: add `jose@^5.9.0` to `package.json` (JWKS + JWT verification primitives).
- WT-00: add `lru-cache@^11.0.0` (для JWKS + replay guard).

## 4. TDD план (≥ 5 tests-first)

| # | Test name | What it asserts |
|---|---|---|
| T1 | `validates valid JWT with correct iss/aud/exp/nonce` | Happy path: signature + claims OK → returns `IdentityClaim`. |
| T2 | `rejects expired JWT with reason=EXPIRED` | `exp` в прошлом → `Result.err({ code: 'EXPIRED' })`. |
| T3 | `rejects JWT with wrong audience` | `aud` mismatch → `WRONG_AUDIENCE`; audit event emitted. |
| T4 | `rejects JWT with wrong issuer` | `iss` mismatch → `WRONG_ISSUER`; audit event emitted. |
| T5 | `handles JWKS rotation gracefully` | Initially key K1 in cache; JWT signed by K2; fetcher refreshes; validation passes second time. |
| T6 | `extracts email, groups, device-posture claims` | Custom claim `custom.groups=['eng','admin']`, `device_posture.compliant=true` парсится. |
| T7 | `rejects replay (same nonce within TTL)` | Token validates once, second call с тем же `identity_nonce` → `REPLAY_DETECTED`. |
| T8 | `feature flag OFF makes validator no-op` | `rox.feature.auth.cloudflare-access-jwt=false` → validator вернёт `Result.ok(null)` без сети. |
| T9 | `JWKS fetch timeout fails closed` | Network timeout → `Result.err({ code: 'JWKS_UNREACHABLE' })`; security default = reject. |

Все тесты commit-ятся первым коммитом `test(auth/access-jwt): failing tests for validator` ДО любого impl-кода.

## 5. Acceptance Criteria (≥ 5)

1. **AC-1:** `AccessJwtValidator.validate(headers)` возвращает `Result<IdentityClaim, AccessJwtError>` без брос-исключений.
2. **AC-2:** JWKS cache TTL=1h, форсированный refetch при `kid` mismatch; max 1 in-flight fetch (singleflight).
3. **AC-3:** Replay guard LRU capacity=10000, TTL=10min; eviction LRU; persistent across renderer reloads (in-memory только в main-process).
4. **AC-4:** Audit events `auth.access_jwt.validated` и `auth.access_jwt.rejected` содержат `tenant_scope`, `reason`, `kid_hash`, `nonce_hash` (no raw token).
5. **AC-5:** Feature flag `rox.feature.auth.cloudflare-access-jwt=false` → validator emits zero network calls, zero audit events.
6. **AC-6:** Type-coverage `jose`-related APIs не утечает в renderer (renderer bundle не содержит `jose`).
7. **AC-7:** При `JWKS_UNREACHABLE` валидатор fail-closed (reject), но coordinator может быть конфигурирован в `fail-open=true` only через explicit env (`ROX_ACCESS_JWT_FAIL_OPEN=1`).

## 6. Risks

| Risk | Mitigation |
|---|---|
| JWKS rate-limit от Cloudflare | Singleflight + LRU + jittered retry. |
| Bundle size: `jose` ~150KB | Tree-shake (только `jwtVerify`, `createRemoteJWKSet`); проверка в `bundle-budget.json`. |
| Replay LRU memory leak | Жёсткий cap=10000, метрика `replay_lru_size`. |
| Clock skew vs Cloudflare | Allow 60s skew tolerance в `exp`/`iat` (jose option). |
| Token in URL/logs leak | Mask via `kid_hash`/`nonce_hash` в audit; gitleaks pre-commit. |

## 7. Inspiration repos

1. `panva/jose` — primary JWT/JWKS library (Apache-2.0). `integration_type: dependency`.
2. `cloudflare/workers-access-jwt-example` — claim-extraction patterns (`integration_type: reference_only`).
3. `auth0/node-jwks-rsa` — JWKS cache lessons (rotation, singleflight) (`reference_only`).
4. `anomalyco/openauth` — TypeScript standards-based auth provider abstraction (`reference_only`).
5. `agisota/senpi` — Pi IPC scope propagation patterns from monorepo fork (`reference_only`).

## 8. Verification protocol

- **Unit:** `bun test tests/unit/auth/access-jwt/` — 9 tests above.
- **Integration:** mock JWKS endpoint (msw), full happy + 4 reject paths.
- **3-machine:** не требуется UI; verification — typecheck + tests + bundle-budget на all 3 OS.
- **RBAC isolation:** WT-16 reuse validator в isolation suite.

## 9. Definition of Done

- [x] Tests-first commit precedes any impl commit (gate enforced).
- [x] `bun run typecheck` exit 0.
- [x] `bun run lint` exit 0.
- [x] `bun test tests/unit/auth/access-jwt/` exit 0 (≥9 tests).
- [x] Bundle budget `apps/electron/main` increase ≤ 80 KB.
- [x] Audit events emit verified via fixture.
- [x] Feature flag OFF: zero net calls (asserted by spy).
- [x] Linear PZD sub-issue moved to "Ready for Merge" with evidence.

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** enterprise-sso-login
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** AccessJWT
- **Events emitted (WT-49 ActivityEvent):** auth.jwt.validated, auth.jwt.rejected
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** security, data
