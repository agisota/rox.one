# WT-12 — Account linking + JIT provisioning — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for implementation (TDD-first)
**Ветка:** `feat/account-linking-jit`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-12-account-linking-jit/`
**Wave:** 1
**Priority:** P0
**Depends on:** WT-10 (Access JWT validator), WT-11 (SCIM receiver)
**Blocks:** WT-15 (membership-invite), WT-17 (RBAC admin UI)
**Parent epic:** PZD-113 (E02 Auth/RBAC)
**FB board:** Enterprise B2B (`6a0db1dabaed70b5d8d3f898`)
**Feature flag:** `rox.feature.auth.account-linking-jit` (default OFF, release cut "Auth")

---

## 1. Контекст

WT-10 валидирует Cloudflare Access JWT и возвращает `IdentityClaim`. WT-11 принимает SCIM events. Но ни один из них не создаёт нативного `User` в ROX.ONE storage и не привязывает 2+ identity (OAuth Google + Access JWT + SCIM external_id) к одной учётке.

Этот WT отвечает за:
1. **Account linking**: один canonical `User.id` объединяет до N `Identity{provider, subject}` записей.
2. **JIT provisioning**: при первом валидном JWT/SCIM-event'е, если user не существует, создаётся `User` + начальный `Membership` к default tenant.
3. **Conflict resolution**: если identity уже linked к другому user — emit `IdentityConflictError` + audit, не silent merge.
4. **Deprovisioning**: SCIM `active=false` → user.disabled=true → block login + revoke sessions (через WT-15 hooks).

## 2. Цели и нецели

### 2.1 In scope

- `AccountLinker.linkIdentity(userId, identity)` — атомарная привязка identity к user.
- `JitProvisioner.provision(claim | scimUser)` — idempotent JIT create-or-link.
- `ConflictDetector` — проверяет, что `(provider, subject)` уникально по globally.
- `Deprovisioner.disable(userId)` — soft-disable + audit + session-revoke signal.
- Audit-events: `account.linked`, `account.unlinked`, `account.jit_provisioned`, `account.conflict_detected`, `account.deprovisioned`.
- Feature-flag gated.

### 2.2 Out of scope

- HTTP endpoints для admin UI → WT-17.
- Session-revoke implementation → WT-15 (membership-invite owns session lifecycle).
- Email notification on linking → WT-19/20.
- Username assignment → WT-13.
- Role assignment based on SCIM groups → WT-14 + WT-15.

## 3. Архитектура

```
┌────────────────────────────────────────────────────────────────┐
│  Trigger 1: WT-10 Access JWT validator emits IdentityClaim     │
│  Trigger 2: WT-11 SCIM receiver emits ScimEvent                │
│                                                                │
│       ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  JitProvisioner (apps/electron/main/auth/account/        │  │
│  │   jit-provisioner.ts)                                    │  │
│  │   ├─ findUserByIdentity(provider, subject)               │  │
│  │   ├─ findUserByEmail(email)  — fuzzy linking candidate   │  │
│  │   ├─ if found → linkIdentity(userId, identity)           │  │
│  │   ├─ else → createUser() + linkIdentity()                │  │
│  │   └─ emit audit                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
│       ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AccountLinker (apps/electron/main/auth/account/         │  │
│  │   linker.ts)                                             │  │
│  │   ├─ linkIdentity(userId, identity) — TX                 │  │
│  │   ├─ unlinkIdentity(userId, identity) — TX               │  │
│  │   ├─ ConflictDetector — pre-check (provider,subject) глоб│  │
│  │   └─ Deprovisioner.disable(userId)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
│       ▼                                                        │
│  user_identities table (SQLite WAL):                           │
│   (user_id, provider, subject, linked_at, primary)             │
└────────────────────────────────────────────────────────────────┘
```

### 3.1 Files allowed

- `apps/electron/src/main/auth/account/linker.ts`
- `apps/electron/src/main/auth/account/jit-provisioner.ts`
- `apps/electron/src/main/auth/account/conflict-detector.ts`
- `apps/electron/src/main/auth/account/deprovisioner.ts`
- `apps/electron/src/main/auth/account/index.ts`
- `apps/electron/src/main/storage/migrations/20260521-user-identities.sql`
- `packages/shared/src/auth/account/types.ts`
- `packages/shared/src/auth/account/index.ts`
- `tests/unit/auth/account/**`
- `tests/integration/auth/account/**`

### 3.2 Files forbidden

- `packages/shared/src/core/user.ts` — owned by WT-04 (read-only after merge).
- `apps/electron/src/main/auth/access-jwt/**` — WT-10.
- `apps/electron/src/main/auth/scim/**` — WT-11.
- `apps/electron/src/main/auth/oauth/**`.
- `package.json`, `tsconfig*.json`, `bun.lock`.

### 3.3 Scaffold-extension requests

- None new (uses existing better-sqlite3 / bun:sqlite + zod).

## 4. TDD план

| # | Test name | What it asserts |
|---|---|---|
| T1 | `JIT creates user on first valid JWT` | No user matches → `User` created + identity linked + audit `account.jit_provisioned`. |
| T2 | `JIT links to existing user by email match` | User existed, новый identity provider — linked, не дубликат. |
| T3 | `links two identities to same user atomically` | TX: link Access JWT, потом SCIM — оба appear в `user_identities`. |
| T4 | `rejects link when identity already linked to another user` | (google, sub=X) уже у user A; попытка link к user B → `IdentityConflictError`; audit. |
| T5 | `deprovisioned user blocked from login (SCIM active=false)` | SCIM deactivate → user.disabled=true; subsequent JWT → reject `USER_DISABLED`. |
| T6 | `unlink last identity blocked` | User has 1 identity; unlink → `LastIdentityProtected`. |
| T7 | `JIT provisioning idempotent (same identity twice)` | Calling twice → single user, single audit, no duplicate row. |
| T8 | `JIT respects feature flag` | Flag OFF → returns `Result.err({ code: 'JIT_DISABLED' })`. |
| T9 | `ConflictDetector cross-tenant scope` | (provider, subject) globally unique даже cross-tenant — enforced by index. |
| T10 | `deprovision emits session-revoke signal` | Deprovisioner emits `session.revoke.requested` event; WT-15 consumer pattern. |

## 5. Acceptance Criteria

1. **AC-1:** Table `user_identities` создаётся migration с UNIQUE INDEX `(provider, subject)`; FK к `users(id)` ON DELETE CASCADE.
2. **AC-2:** `JitProvisioner.provision()` идемпотентен; повторный вызов с тем же `(provider, subject)` не создаёт дубликат.
3. **AC-3:** Account-link транзакция атомарна (rollback при partial failure).
4. **AC-4:** Conflict-detection precedes any write; throws/returns Result.err до DB-mutation.
5. **AC-5:** Deprovisioning soft-disable (deleted_at=null, disabled_at=NOW); revoke session signal emitted.
6. **AC-6:** Audit emits для каждого state-changing event с tenant_scope + masked subject hash.
7. **AC-7:** Feature flag OFF: JIT возвращает err; existing linked users всё ещё login через OAuth (no regression).
8. **AC-8:** Email-based fuzzy match opt-in per tenant (`tenant.allow_email_based_linking=true`); default false.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Race condition: two simultaneous JWT для нового user → 2 users | SQLite TX BEGIN IMMEDIATE; UNIQUE constraint catches duplicate. |
| Account takeover via email collision | Default `allow_email_based_linking=false`; explicit opt-in per tenant. |
| Linking across tenants leaks data | (provider, subject) globally unique; cross-tenant linking blocked. |
| Deprovisioned user может остаться залогинен | Session-revoke signal mandatory; WT-15 must consume и evict. |
| Migration failure mid-deploy | Migration reversible (down migration drops table); test rollback. |

## 7. Inspiration repos

1. `lucia-auth/lucia` — TS auth library, account linking patterns (`reference_only`, MIT).
2. `nextauthjs/next-auth` — `linkAccount` callback patterns (`reference_only`).
3. `anomalyco/openauth` — TS standards-based provider abstraction (`reference_only`).
4. `Agent-Field/agentfield` — agent identity provisioning (`reference_only`).
5. `steipete/better-auth` — Comprehensive TS auth framework (`reference_only`).

## 8. Verification protocol

- **Unit:** ≥10 tests above.
- **Integration:** in-memory SQLite + real JWT/SCIM fixtures end-to-end.
- **Concurrency:** stress test 50 parallel JIT calls → exactly 1 user (race-safe).
- **3-machine:** typecheck + tests + sqlite-migration smoke.

## 9. Definition of Done

- [x] Tests-first commit precedes impl.
- [x] Migration up+down тестируется (rollback works).
- [x] `bun run typecheck` + `bun run lint` clean.
- [x] ≥10 unit + ≥5 integration tests.
- [x] Concurrency race test passes.
- [x] Audit emit verified.
- [x] Feature flag OFF: no JIT writes; OAuth unaffected.
- [x] Linear PZD sub-issue → "Ready for Merge".

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** account-link-flow
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** AccountLink
- **Events emitted (WT-49 ActivityEvent):** account.linked, account.jit_provisioned
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** security, data
