# WT-11 — SCIM v2 receiver endpoint — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for implementation (TDD-first)
**Ветка:** `feat/scim-receiver`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-11-scim-receiver/`
**Wave:** 1
**Priority:** P0
**Depends on:** WT-04 (user contract), WT-05 (tenant contract), WT-08 (audit/telemetry)
**Blocks:** WT-12 (account linking + JIT)
**Parent epic:** PZD-113 (E02 Auth/RBAC)
**FB board:** Enterprise B2B (`6a0db1dabaed70b5d8d3f898`)
**Feature flag:** `rox.feature.auth.scim-receiver` (default OFF, release cut "Auth")

---

## 1. Контекст

Enterprise IdP (Okta, Entra ID, JumpCloud, OneLogin) пушат изменения пользователей через SCIM v2 (RFC 7644). ROX.ONE сейчас не имеет SCIM-приёмника — все user mutations идут через OAuth flow + manual admin UI. Это блокирует продажу в B2B сегмент с auto-provisioning требованием.

Этот WT добавляет HTTP SCIM v2 endpoint, который принимает `POST/PUT/PATCH/DELETE /scim/v2/Users` и `/scim/v2/Groups`, валидирует bearer token (per-tenant API key), парсит SCIM payload, и emit'ит canonical events (`scim.user.created`, `scim.user.deactivated`, `scim.group.synced`). Реальный `User`-upsert произойдёт в WT-12 (account linking + JIT) — этот WT отвечает только за приём + validation + audit + queueing.

## 2. Цели и нецели

### 2.1 In scope

- HTTP receiver на main-process Express/Hono (`/scim/v2/{Users,Groups}`).
- SCIM v2 schema validation (RFC 7643).
- Bearer token auth (per-tenant API key из `@rox-one/shared/core/tenant`).
- HMAC signature validation (опционально, для IdP с supported `Authorization: SCIM-Signature`).
- Idempotency via `externalId` или `meta.location`.
- Audit-emit `scim.user.{created,updated,deactivated}`, `scim.group.synced`.
- Rate-limit per-tenant 100 RPS (token bucket).
- Feature-flag gated.

### 2.2 Out of scope

- User upsert в `@rox-one/shared/core/user` → WT-12.
- Account linking → WT-12.
- Group → Role mapping → WT-14 (roles-engine) + WT-15 (membership).
- Admin UI для просмотра SCIM sync статуса → WT-17.

## 3. Архитектура

```
┌───────────────────────────────────────────────────────────────┐
│   HTTP POST /scim/v2/Users  (IdP push)                        │
│       │                                                       │
│       ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ScimReceiver  (apps/electron/main/auth/scim/           │  │
│  │   receiver.ts)                                          │  │
│  │   ├─ authBearer()  — match per-tenant API key           │  │
│  │   ├─ verifyHmac()  — optional signature                 │  │
│  │   ├─ parsePayload() — SCIM schema strict                │  │
│  │   ├─ rateLimit()   — token bucket per-tenant            │  │
│  │   ├─ idempotencyGuard() — externalId LRU               │  │
│  │   └─ emit ScimEvent  (queue → WT-12 listener)           │  │
│  └─────────────────────────────────────────────────────────┘  │
│       │                                                       │
│       ▼                                                       │
│  AuditEmitter + Queue (scim_events table)                     │
└───────────────────────────────────────────────────────────────┘
```

### 3.1 Files allowed

- `apps/electron/src/main/auth/scim/receiver.ts`
- `apps/electron/src/main/auth/scim/user-upsert.ts` — emit-only (no DB write here)
- `apps/electron/src/main/auth/scim/group-sync.ts` — emit-only
- `apps/electron/src/main/auth/scim/schema-validator.ts`
- `apps/electron/src/main/auth/scim/rate-limiter.ts`
- `apps/electron/src/main/auth/scim/index.ts`
- `packages/shared/src/auth/scim/types.ts` (SCIM v2 types)
- `packages/shared/src/auth/scim/events.ts` (canonical event shapes)
- `tests/unit/auth/scim/**`
- `tests/integration/auth/scim/**`

### 3.2 Files forbidden

- `apps/electron/src/main/auth/oauth/**`
- `apps/electron/src/main/auth/access-jwt/**` — owned by WT-10
- `package.json`, `tsconfig*.json`, `bun.lock` (scaffold-extension)

### 3.3 Scaffold-extension requests

- WT-00: add `hono@^4.6.0` (lightweight HTTP framework для main-process; уже есть в проекте — verify version) или reuse existing Express. Default: prefer Hono для tree-shake.
- WT-00: add `zod@^3.23.0` (если ещё не) — SCIM schema validation.

## 4. TDD план (≥ 5 tests-first)

| # | Test name | What it asserts |
|---|---|---|
| T1 | `creates SCIM user with valid payload + bearer` | 201 Created; canonical event emitted; idempotency key cached. |
| T2 | `updates SCIM user via PATCH` | 200 OK; event `scim.user.updated` emitted with `diff`. |
| T3 | `deactivates user via PATCH active=false` | Event `scim.user.deactivated` emitted. |
| T4 | `rejects malformed payload with 400 + scim-error` | `schemas[]` missing → 400 `{schemas:['...:Error'], detail, status:400}`. |
| T5 | `rejects invalid bearer token` | 401 + audit `scim.auth.rejected`. |
| T6 | `rejects when HMAC signature mismatch (when required)` | 401 + reason=SIGNATURE_INVALID. |
| T7 | `synces group with members add/remove` | PATCH `Operations` parsed; canonical `scim.group.synced` event с {added, removed}. |
| T8 | `idempotency: duplicate externalId returns 200 + same id` | Second POST с тем же `externalId` → 200 (idempotent). |
| T9 | `rate-limit 429 with Retry-After` | 101-й request за 1s → 429, header `Retry-After`. |
| T10 | `feature flag OFF returns 503 + no event emit` | Flag off → 503 ServiceUnavailable; zero queue writes. |

## 5. Acceptance Criteria

1. **AC-1:** SCIM v2 conformance: `urn:ietf:params:scim:schemas:core:2.0:User` + `Group` parsed; error responses match `urn:ietf:params:scim:api:messages:2.0:Error`.
2. **AC-2:** Per-tenant bearer token verified против `@rox-one/shared/core/tenant.apiKeys[]`.
3. **AC-3:** Idempotency LRU TTL=24h, cap=10000 per-tenant.
4. **AC-4:** Rate-limit 100 RPS per-tenant; 429 + `Retry-After` correct.
5. **AC-5:** Events emit в `scim_events` queue (durable, JSON-serialized).
6. **AC-6:** Audit emits для все state-changing операций (created/updated/deactivated) + auth-rejected.
7. **AC-7:** Feature flag OFF: 503 response; no DB writes; no audit emit (кроме `feature.disabled.scim.attempt`).
8. **AC-8:** SCIM endpoint доступен только с loopback (127.0.0.1) или через tenant-allowlisted CIDR.

## 6. Risks

| Risk | Mitigation |
|---|---|
| IdP variants (Okta vs Entra payload-quirks) | Strict schema + per-vendor compat tests; matrix `okta/entra/jumpcloud`. |
| SCIM signature schema underspecified | Optional HMAC support; documented fallback to bearer-only. |
| Replay через идентичный externalId | Idempotency LRU; gate timestamps. |
| Rate-limit DoS by valid IdP | Per-tenant scope; not per-IP only. |
| Bearer token leak в logs | Mask bearer to `<sha256-first-8>`; gitleaks. |

## 7. Inspiration repos

1. `okta/okta-sdk-nodejs` — SCIM endpoint patterns (`reference_only`, MIT).
2. `microsoft/SCIMReferenceCode` — Microsoft reference SCIM 2.0 implementation (`reference_only`).
3. `InsForge/InsForge` — all-in-one backend with auth/multi-tenant patterns (`reference_only`).
4. `Agent-Field/agentfield` — agent identity + RBAC + audit patterns (`reference_only`).
5. `panva/oauth4webapi` — token validation primitives (`reference_only`).

## 8. Verification protocol

- **Unit:** ≥10 tests above.
- **Integration:** spinup Hono server in-process, send real SCIM payloads (Okta+Entra fixtures from `tests/fixtures/scim/`).
- **3-machine:** не UI — typecheck + tests на all 3 OS.
- **Security:** OWASP-style fuzzing на SCIM payload via `tests/fuzz/scim-fuzz.test.ts` (≥1000 mutated inputs).

## 9. Definition of Done

- [x] Tests-first commit precedes impl.
- [x] `bun run typecheck` + `bun run lint` clean.
- [x] ≥10 unit tests, ≥5 integration scenarios.
- [x] SCIM conformance test suite (subset) passes.
- [x] Audit events verified via fixture.
- [x] Rate-limit verified under load (100→429 transition).
- [x] Feature flag OFF: 503 + zero queue writes.
- [x] Linear PZD sub-issue → "Ready for Merge".

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** N/A
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** SCIMUser, SCIMGroup
- **Events emitted (WT-49 ActivityEvent):** scim.user.upserted, scim.user.deactivated
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** security, data
