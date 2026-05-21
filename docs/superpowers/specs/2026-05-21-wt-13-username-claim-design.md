# WT-13 — Username reservation + claim flow — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for implementation (TDD-first)
**Ветка:** `feat/username-claim`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-13-username-claim/`
**Wave:** 1
**Priority:** P1
**Depends on:** WT-04 (user contract)
**Blocks:** WT-22 (mailbox-domain — username нужен для `user@rox.one`)
**Parent epic:** PZD-113 (E02 Auth/RBAC)
**FB board:** Enterprise B2B (`6a0db1dabaed70b5d8d3f898`)
**Feature flag:** `rox.feature.auth.username-claim` (default OFF, release cut "Auth")

---

## 1. Контекст

ROX.ONE планирует выдавать каждому пользователю уникальный handle (`alex`, `mary-eng`) — нужен для:
1. Mailbox: `alex@rox.one` (WT-22).
2. Public sharing URLs: `rox.one/u/alex/notes/...`.
3. Mentions в notes/chats (`@alex`).
4. SCIM/SSO mapping (опциональный handle при provisioning).

Сейчас user identified by `email` или внутренний UUID — это плохой UX и нет namespace для public-shares. Этот WT добавляет username layer:
- Reservation TTL=24h (пользователь "забронировал" имя при регистрации, может подтвердить позже).
- Claim flow (admin/regular user проходит validation + reserve + confirm).
- Reserved words list (`admin`, `root`, `system`, etc.).
- Case-insensitive uniqueness; normalized к lowercase.

## 2. Цели и нецели

### 2.1 In scope

- `UsernameReservation` — TTL-bound bag of pending names (LRU + SQLite-backed).
- `UsernameClaimFlow` — `reserve(name, userId)` → `confirm(name, userId)` → permanent.
- Validator: length 3-32, allowed `[a-z0-9-_]`, no `--`/`__`/leading-trailing punct.
- Reserved words list (admin/root/system/api/staff/support/help/about/legal/privacy).
- Case-insensitive uniqueness (canonical=lowercased; preserved display-form optional).
- Audit emit на claim/release/conflict.
- Feature-flag gated.

### 2.2 Out of scope

- UI для claim flow → WT-17 (admin) или onboarding (WT-37).
- Mailbox creation `user@rox.one` → WT-22.
- Username change after claim → defer (separate WT).
- @-mentions parser → defer (notes WT-35).

## 3. Архитектура

```
┌────────────────────────────────────────────────────────────────┐
│  IPC: ipc.auth.username.reserve(name)                          │
│       │                                                        │
│       ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  UsernameValidator (packages/shared/username/            │  │
│  │   validator.ts)                                          │  │
│  │   ├─ check length 3-32                                   │  │
│  │   ├─ check regex /^[a-z0-9](?:[a-z0-9_-]{1,30}[a-z0-9])?$/│  │
│  │   ├─ check reserved-words list (importable JSON)         │  │
│  │   └─ normalize → lowercase canonical                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│       │                                                        │
│       ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  UsernameReservation (apps/electron/main/auth/username/  │  │
│  │   reservation.ts)                                        │  │
│  │   ├─ reserve(canonical, userId) — INSERT с expires_at    │  │
│  │   ├─ checkAvailable(canonical) — checks claims + reserv  │  │
│  │   ├─ purgeExpired() — cron 5min                          │  │
│  │   └─ release(canonical, userId)                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│       │                                                        │
│       ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  UsernameClaimFlow (apps/electron/main/auth/username/    │  │
│  │   claim-flow.ts)                                         │  │
│  │   ├─ confirm(canonical, userId)                          │  │
│  │   │   — promotes reservation → permanent claim           │  │
│  │   │   — updates users.username column                    │  │
│  │   └─ emit audit + emit event for WT-22 listener          │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### 3.1 Files allowed

- `apps/electron/src/main/auth/username/reservation.ts`
- `apps/electron/src/main/auth/username/claim-flow.ts`
- `apps/electron/src/main/auth/username/purge-cron.ts`
- `apps/electron/src/main/auth/username/index.ts`
- `apps/electron/src/main/storage/migrations/20260521-username-reservations.sql`
- `packages/shared/src/username/validator.ts`
- `packages/shared/src/username/reserved-words.ts`
- `packages/shared/src/username/types.ts`
- `packages/shared/src/username/index.ts`
- `tests/unit/auth/username/**`
- `tests/integration/auth/username/**`

### 3.2 Files forbidden

- `packages/shared/src/core/user.ts` — owned by WT-04 (только READ; column `username` добавляется через WT-04 scaffold-extension request).
- `package.json`, `tsconfig*.json`, `bun.lock`.

### 3.3 Scaffold-extension requests

- WT-04: add `username: string | null` column на `User` contract (через scaffold-extension request к WT-04 owner). Если WT-04 уже завершён, request переходит к WT-00 для shared contract patch.

## 4. TDD план

| # | Test name | What it asserts |
|---|---|---|
| T1 | `validates valid username "alex_dev-1"` | Returns `Result.ok({ canonical: 'alex_dev-1' })`. |
| T2 | `rejects too short "ab"` | `Result.err({ code: 'TOO_SHORT' })`. |
| T3 | `rejects too long (33 chars)` | `TOO_LONG`. |
| T4 | `rejects disallowed chars "alex@dev"` | `INVALID_CHARS`. |
| T5 | `rejects reserved word "admin" (case-insensitive)` | `RESERVED_WORD`. |
| T6 | `case-insensitive uniqueness: claim "Alex" blocks "alex"` | Second `reserve` → `ALREADY_TAKEN`. |
| T7 | `reservation expires after 24h` | After TTL → `checkAvailable` returns true; new user can reserve. |
| T8 | `confirm promotes reservation to permanent` | After confirm: `users.username` set; reservation row deleted; audit `username.claimed`. |
| T9 | `release frees reservation immediately` | `release` → `checkAvailable` true. |
| T10 | `concurrent reserve race: only one wins` | 2 simultaneous reserves → exactly 1 succeeds, other gets `ALREADY_TAKEN`. |
| T11 | `feature flag OFF: reserve returns err` | Flag off → `Result.err({ code: 'USERNAME_DISABLED' })`. |

## 5. Acceptance Criteria

1. **AC-1:** Username validator pure function без deps на storage/network.
2. **AC-2:** Reservation TTL=24h configurable via `tenant.username_reservation_ttl_hours` (default 24).
3. **AC-3:** Reserved-words list ≥50 entries; importable as JSON; tested separately.
4. **AC-4:** SQLite migration creates `username_reservations` (canonical TEXT PK, user_id, expires_at) + adds `users.username TEXT UNIQUE COLLATE NOCASE` (через WT-04 scaffold-extension).
5. **AC-5:** Concurrency-safe (BEGIN IMMEDIATE TX + UNIQUE constraint).
6. **AC-6:** Audit emit на reserve/confirm/release/conflict с tenant_scope.
7. **AC-7:** Purge cron runs every 5min, deletes expired rows; metric `username.reservations.purged_count`.
8. **AC-8:** Feature flag OFF: reserve/confirm fail with `USERNAME_DISABLED`; existing usernames продолжают работать.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Squatting (mass-reserve bot) | Per-user reserve limit (1 active reservation); rate-limit 5 reserves/hour. |
| Reserved-words drift (forget новое слово) | Reserved-words file + admin extension API (WT-17). |
| Unicode confusables (`alex` vs `аlex`) | Normalize NFC + ASCII-only enforcement (rejects non-[a-z0-9-_]). |
| Migration adds column to existing users.username NULL | Backfill optional via separate task; not blocking. |
| Mailbox dependency (WT-22) blocked by username changes | Username immutable post-claim (v1); future change-flow deferred. |

## 7. Inspiration repos

1. `github/banned-usernames` — reference reserved-words list (`reference_only`).
2. `shouldbee/reserved-usernames` — npm package для общего списка (`reference_only`, MIT).
3. `lucia-auth/lucia` — TS auth account + username patterns (`reference_only`).
4. `anomalyco/openauth` — TS standards-based provider (`reference_only`).
5. `steipete/better-auth` — Comprehensive TS auth framework (`reference_only`).

## 8. Verification protocol

- **Unit:** validator pure-function tests + reservation TTL tests.
- **Integration:** in-memory SQLite + cron purge + claim flow.
- **Concurrency:** 100 parallel reserves для same name → 1 winner.
- **3-machine:** typecheck + tests + migration smoke.

## 9. Definition of Done

- [x] Tests-first commit precedes impl.
- [x] Migration up+down tested.
- [x] `bun run typecheck` + `bun run lint` clean.
- [x] ≥11 unit + ≥3 integration tests.
- [x] Reserved-words list ≥50 entries.
- [x] Concurrency race test passes.
- [x] Audit emit verified.
- [x] Feature flag OFF: reserves fail closed.
- [x] Linear PZD sub-issue → "Ready for Merge".
