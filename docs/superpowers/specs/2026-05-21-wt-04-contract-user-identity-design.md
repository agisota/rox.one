# WT-04: User + Identity data contract

**Branch:** `feat/contract-user-identity`
**Base SHA:** `fac6f228069c`
**Wave:** 0
**Priority:** P0
**Feature flag:** `rox.feature.contracts.user-v1` (default OFF; включается на Foundation Cut)
**Status:** Design — awaiting implementation

---

## 1. Objective

Заложить foundation data-contract User + Identity, на котором стоят все Auth/RBAC WT (WT-10..18), Storage (WT-23..27), Agent Fabric (WT-28..32) и Sources (WT-38..39). User = identity owner (один человек), Identity = federated provider link (Google, Slack, Anthropic OAuth, SCIM external_id). Zod schema + Postgres migration up/down + backwards-compat default-tenant.

## 2. User goal

Технически — каждый downstream WT может `import { UserSchema, IdentitySchema } from '@rox-one/shared/core'` и не переживать про forming. Продуктовый — пользователь может линковать multiple identities к одному user account (Google для work + Slack для work + Anthropic OAuth для CLI); ROX знает, что это один человек.

## 3. Files allowed

- `packages/shared/src/core/index.ts`
- `packages/shared/src/core/user.ts`
- `packages/shared/src/core/identity.ts`
- `packages/shared/src/core/uuid-v7.ts`
- `packages/shared/src/core/__tests__/user.test.ts`
- `packages/shared/src/core/__tests__/identity.test.ts`
- `packages/shared/src/core/__tests__/uuid-v7.test.ts`
- `packages/server-core/src/persistence/migrations/2026-05-21-user-identity-up.sql`
- `packages/server-core/src/persistence/migrations/2026-05-21-user-identity-down.sql`
- `packages/server-core/src/persistence/__tests__/user-identity-migration.test.ts`
- `packages/server-core/src/services/user-repository.ts`
- `packages/server-core/src/services/identity-repository.ts`
- `packages/server-core/src/services/__tests__/user-repository.test.ts`
- `packages/server-core/src/services/__tests__/identity-repository.test.ts`
- `docs/architecture/data-contract-user-identity-2026-05-21.md`
- `docs/worklog/WT-04.md`

## 4. Files forbidden

- `packages/shared/src/auth/**` (existing OAuth flows; не трогаем, только consumer)
- `packages/shared/src/sessions/**` (existing; consumer)
- `packages/server-core/src/handlers/**` (out-of-scope для contract WT)
- `apps/electron/**` (no client-side changes)
- `packages/shared/src/feature-flags/registry.ts` (WT-07 scaffold)
- `package.json` (WT-00)
- `tsconfig.json` (WT-00)
- `bun.lock` (WT-00)
- `packages/shared/src/core/tenant.ts` (WT-05)
- `packages/shared/src/core/workspace.ts` (WT-06)

## 5. Depends on

WT-00.

## 6. Blocks

WT-05 (tenant — User имеет tenantId FK), WT-06 (workspace — owner = userId), WT-08 (audit — actorId = userId), WT-10 (Access JWT — sub claim → userId), WT-11 (SCIM — provisions identities), WT-13 (username claim), WT-19 (email provider — recipient = User), WT-22 (mailbox domain — user@), WT-23 (storage backend — owner = userId), WT-28 (coordinator agent — initiated by userId), WT-38 (source registry — owner = userId).

## 7. Functional requirements

1. **FR-04.1 (User schema)** Zod schema в `packages/shared/src/core/user.ts`:
   ```ts
   const UserSchema = z.object({
     id: UuidV7Schema,                    // sortable, B-tree-friendly
     tenantId: UuidV7Schema,              // FK → tenants.id (WT-05); pre-foundation = DEFAULT_TENANT_ID
     email: EmailSchema,                   // primary identifier, unique per tenant
     username: UsernameSchema.optional(), // assigned in WT-13
     displayName: z.string().min(1).max(255),
     locale: LocaleSchema,                 // BCP-47, default 'en-US'
     timezone: TimezoneSchema,             // IANA, default 'UTC'
     status: z.enum(['active', 'invited', 'suspended', 'deleted']),
     createdAtUtc: IsoUtcSchema,
     updatedAtUtc: IsoUtcSchema,
     deletedAtUtc: IsoUtcSchema.nullable().default(null),  // soft-delete
   });
   ```
2. **FR-04.2 (Identity schema)** `packages/shared/src/core/identity.ts`:
   ```ts
   const IdentitySchema = z.object({
     id: UuidV7Schema,
     userId: UuidV7Schema,                 // FK → users.id
     tenantId: UuidV7Schema,               // denormalized для isolation queries
     provider: z.enum(['google', 'slack', 'microsoft', 'anthropic-oauth', 'scim', 'rox-local']),
     externalId: z.string().min(1),        // provider's user ID
     claims: z.record(z.unknown()),         // raw JWT claims / SCIM attrs (limited 16KB)
     primary: z.boolean().default(false),   // user's primary identity для login
     lastSeenAtUtc: IsoUtcSchema.nullable().default(null),
     createdAtUtc: IsoUtcSchema,
     deletedAtUtc: IsoUtcSchema.nullable().default(null),
   });
   ```
   Compound unique: `(provider, externalId)` per tenant.
3. **FR-04.3 (uuid-v7)** `packages/shared/src/core/uuid-v7.ts` — implementation per RFC 9562 draft (time-sortable, B-tree-friendly, 48-bit ms timestamp + 74 random bits). Used everywhere `IdSchema` declared. Pure-JS, no native deps.
4. **FR-04.4 (migrations up/down)** Postgres migrations:
   - `up.sql`: CREATE TABLE users (...), CREATE TABLE identities (...), 4 indexes (user.email per tenant, identity.userId, identity.(provider, externalId), identity.lastSeenAtUtc), CHECK constraints для enums.
   - `down.sql`: DROP TABLE identities, DROP TABLE users. Idempotent.
   - Migration runner verifies up→down→up round-trip.
5. **FR-04.5 (backwards-compat default-tenant)** В Foundation Cut tenant scheme еще не enforced (WT-05 в parallel). Existing single-tenant data backfills с `tenantId = DEFAULT_TENANT_ID = '01900000-0000-7000-8000-000000000000'` (well-known UUID v7 reserved для default tenant). User-repository автоматически injects DEFAULT_TENANT_ID если caller не передал tenantId AND flag `rox.feature.contracts.tenant-v1` == OFF.
6. **FR-04.6 (repositories)** Type-safe repository pattern:
   - `UserRepository`: `create(input)`, `findById(id)`, `findByEmail(tenantId, email)`, `update(id, patch)`, `softDelete(id)`, `restore(id)`, `list(filter)`. Все возвращают `Result<User, RepositoryError>` (no exceptions for expected misses).
   - `IdentityRepository`: same shape + `findByProviderExternalId(provider, externalId, tenantId)`, `linkToUser(identityId, userId)`, `unlinkFromUser(identityId)`.
7. **FR-04.7 (validation at boundaries)** Все repository methods strictly parse через Zod на input AND output (catches DB schema drift).
8. **FR-04.8 (feature-flag gating)** При `rox.feature.contracts.user-v1` OFF в production — repositories доступны но idle (не register к global service container). WT-10..18 не могут "случайно" использовать contracts до Foundation Cut.

## 8. Non-functional requirements

- **NFR-04.1 (perf)** Zod parse User schema <0.5ms. `uuid-v7` generation <0.1ms.
- **NFR-04.2 (security)** PII handling — email logged как `hash(email).slice(0,8)` в audit pipeline; raw email never в logs.
- **NFR-04.3 (i18n)** locale + timezone — first-class; default 'en-US' / 'UTC', не cabines.
- **NFR-04.4 (a11y)** N/A — schema, not UI.
- **NFR-04.5 (audit)** Все mutations через repositories emit к WT-08 shim: `user.created`, `user.updated`, `user.soft-deleted`, `identity.linked`, `identity.unlinked`.
- **NFR-04.6 (reversibility)** Migration round-trip test обязателен.
- **NFR-04.7 (timezone)** Все timestamps UTC ISO 8601. Conversion в local zone только на display layer.

## 9. Data model touched

Полные DDL schema:

```sql
-- users
CREATE TABLE users (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL,
  email           TEXT NOT NULL,
  username        TEXT,
  display_name    TEXT NOT NULL,
  locale          TEXT NOT NULL DEFAULT 'en-US',
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  status          TEXT NOT NULL CHECK (status IN ('active','invited','suspended','deleted')),
  created_at_utc  TIMESTAMPTZ NOT NULL,
  updated_at_utc  TIMESTAMPTZ NOT NULL,
  deleted_at_utc  TIMESTAMPTZ,
  CONSTRAINT users_email_per_tenant_uq UNIQUE (tenant_id, email)
);
CREATE INDEX users_tenant_status_idx ON users (tenant_id, status) WHERE deleted_at_utc IS NULL;

-- identities
CREATE TABLE identities (
  id                UUID PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  tenant_id         UUID NOT NULL,
  provider          TEXT NOT NULL CHECK (provider IN ('google','slack','microsoft','anthropic-oauth','scim','rox-local')),
  external_id       TEXT NOT NULL,
  claims            JSONB NOT NULL DEFAULT '{}'::jsonb,
  primary_flag      BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at_utc  TIMESTAMPTZ,
  created_at_utc    TIMESTAMPTZ NOT NULL,
  deleted_at_utc    TIMESTAMPTZ,
  CONSTRAINT identities_provider_external_per_tenant_uq UNIQUE (tenant_id, provider, external_id),
  CHECK (length(claims::text) <= 16384)
);
CREATE INDEX identities_user_idx ON identities (user_id) WHERE deleted_at_utc IS NULL;
CREATE INDEX identities_last_seen_idx ON identities (last_seen_at_utc DESC NULLS LAST);
```

## 10. API / IPC / RPC touched

- **Public TypeScript API:**
  - `import { UserSchema, IdentitySchema, UuidV7Schema, type User, type Identity } from '@rox-one/shared/core';`
  - `import { UserRepository, IdentityRepository } from '@rox-one/server-core/services';`
- **No RPC / IPC** added напрямую (consumer WT добавляют поверх).

## 11. UI/UX touched

— нет.

## 12. Security / RBAC implications

- Foundation для всех Auth flows; ошибка в schema = vulnerability у всех 30+ downstream WT. Therefore opus-max test-writer и double-pass critic обязательны.
- Default tenant fallback (FR-04.5) — известный риск; mitigations: (a) explicit feature-flag, (b) tests assert tenant_id never NULL after Auth Cut.
- `claims` JSONB size cap 16KB предотвращает DoS через massive JWT payload.
- `external_id` no length cap, но stored as TEXT — Postgres handles до 1GB; не предполагаем abuse.

## 13. TDD test list

1. `describe('UserSchema', () => it('должно reject когда email отсутствует или invalid'))`.
2. `describe('UserSchema', () => it('должно default locale="en-US" и timezone="UTC" если не передано'))`.
3. `describe('UserSchema', () => it('должно reject status вне enum ('active'|'invited'|'suspended'|'deleted')'))`.
4. `describe('IdentitySchema', () => it('должно reject когда claims >16KB serialized'))`.
5. `describe('IdentitySchema', () => it('должно enforce unique (tenantId, provider, externalId) через repository'))`.
6. `describe('uuid-v7', () => it('должно generate sortable IDs: B-tree friendly (a < b ⇒ a.ts ≤ b.ts)'))`.
7. `describe('uuid-v7', () => it('должно variant RFC 9562 conformant (version=7, variant=10)'))`.
8. `describe('migrations', () => it('должно round-trip up → down → up без diff в pg_dump schema-only'))`.
9. `describe('UserRepository', () => it('должно inject DEFAULT_TENANT_ID когда tenant-v1 flag OFF и tenantId не передан'))`.
10. `describe('UserRepository', () => it('должно return Err когда email duplicate per tenant'))`.
11. `describe('IdentityRepository', () => it('должно findByProviderExternalId(google, "abc123", tenantId) корректно scoped'))`.
12. `describe('IdentityRepository', () => it('должно emit audit event identity.linked при linkToUser'))`.
13. `describe('soft-delete', () => it('должно skip deleted_at_utc NOT NULL rows в list() default filter'))`.

## 14. Acceptance criteria

1. **AC-04.1** `UserSchema` + `IdentitySchema` exported из `@rox-one/shared/core` и type-checks pass downstream.
2. **AC-04.2** Migration up applies clean к pristine Postgres; down reverses fully (pg_dump schema-only diff empty).
3. **AC-04.3** Round-trip up→down→up test passes в CI.
4. **AC-04.4** UUID v7 spec conformance (version=7, variant=10) verified.
5. **AC-04.5** `UserRepository.create()` with email duplicate per tenant returns `Err`, не throws.
6. **AC-04.6** `IdentityRepository.findByProviderExternalId` корректно tenant-scoped (cross-tenant query returns no rows).
7. **AC-04.7** При `rox.feature.contracts.tenant-v1` OFF — DEFAULT_TENANT_ID injected automatically.
8. **AC-04.8** Audit shim emits 5 event types (user.created/updated/soft-deleted, identity.linked/unlinked).
9. **AC-04.9** PII-safe logging: email hashed в audit payload (not raw).
10. **AC-04.10** Zod parse benchmark <0.5ms p99 (10k iterations).

## 15. 14-role plan

| Phase | Role | Model | Expected output |
|---|---|---|---|
| Discovery | brainstormer | opus-max | `discovery/01-vision.md` — почему User+Identity один WT |
| Discovery | requirements-keeper | opus-max | 10 AC + DoD |
| Discovery | scope-analyzer | opus-max | 16 файлов; нет пересечения с WT-05/06 |
| Discovery | critic | opus-max | data-contract anti-patterns; PII; tenant-scoping risk |
| Design | prompt-writer | opus-max | `design/01-impl-plan.md` |
| Design | architect | opus-max | review schema design |
| Design | UX-guru | (skip — нет UI) | — |
| Impl | test-writer | opus-max | 13 failing tests — opus-max-only (security-critical) |
| Impl | implementer | sonnet-medium | schemas, uuid-v7, repositories |
| Impl | super-coder | sonnet-medium | migrations + round-trip test runner |
| Impl | reviewer | opus-max | code review focused on tenant-scoping |
| Verify | verifier | opus-max | full gate + Postgres integration test |
| Verify | critic | opus-max | AC vs evidence; PII audit |
| Verify | integrator | opus-max | consumer-readiness check (mock WT-10 usage) |
| Optimize | optimizer | opus-max | Zod parse perf <0.5ms; index choices |
| Optimize | 10x-improver | opus-max | future: bitemporal user history; cross-tenant linking |

## 16. Verification protocol

3-machine: **только ubuntu-22** (server-side контракты; нет electron build). Дополнительно: Postgres 16 integration via Docker.

- `ubuntu-22`: `bun run typecheck && bun run lint && bun test packages/shared/src/core packages/server-core/src/{persistence,services}`
- Postgres integration: spin Postgres 16 via testcontainers, run migration up → seed data → query repos → migration down → verify schema empty.
- Performance benchmark: 10k Zod parses + 10k uuid-v7 generations + 10k repo.create() round-trips. Output `evidence/wt-04/perf.json`.

Smoke list:
1. typecheck + lint exit 0
2. all 13 unit tests pass
3. migration up→down→up round-trip
4. perf benchmarks meet AC-04.10
5. audit shim emits 5 types
6. mock-consumer (mini WT-10 usage) compiles

## 17. Feature flag configuration

- **Name:** `rox.feature.contracts.user-v1`
- **Default:** OFF (но schemas exported; OFF gates repository registration, not types)
- **Release cut:** `foundation`
- **Registry location:** `packages/shared/src/feature-flags/registry.ts` (WT-07 owns; scaffold-extension)

## 18. Linear mapping

- **Parent epic:** PZD-113 (E02 — Авторизация, RBAC, мульти-тенантность).
- **Child stories:**
  - "📐 UserSchema (Zod) + tests"
  - "📐 IdentitySchema (Zod) + tests"
  - "🔢 UUID v7 implementation"
  - "🗄 Postgres migration up/down + round-trip"
  - "🏪 UserRepository + IdentityRepository (Result-based)"
  - "🔒 DEFAULT_TENANT_ID backwards-compat shim"
  - "📡 Audit shim emit (5 event types)"
- **Existing PZD-* to attach:** issues уже созданные под PZD-113 на "user data migration", "tenant credential key derivation" — частично overlap с FR-04.5; re-parent под WT-04.

## 19. Featurebase mapping

- Board: `Enterprise, B2B` (id `6a0db1dabaed70b5d8d3f898`)
- Post alias: `wt-04-contract-user-identity`
- Status lifecycle: planned → in-progress → shipped
- Changelog draft (на merge): "User + Identity data contract — foundation для enterprise auth"

## 20. Inspiration repos

- `https://github.com/wasp-lang/open-saas` (E02, `reference_only`) — full-featured SaaS boilerplate с multi-provider OAuth (Google, Slack, MS); прямой референс для UserSchema поля + identity provider enum.
- `https://github.com/anomalyco/openauth` (E02, `reference_only`) — universal standards-based auth provider; provider abstraction patterns для IdentitySchema claims field.
- `https://github.com/trailbaseio/trailbase` (E02, `reference_only`) — single-executable backend с auth + admin UI; pattern для repository abstraction.
- `https://github.com/InsForge/InsForge` (E02, `reference_only`) — all-in-one backend agentic; multi-tenant isolation patterns для DEFAULT_TENANT_ID fallback.
- `https://github.com/steipete/better-auth` (E02, `reference_only`) — comprehensive TS auth framework fork; reference для repository methods naming.

## 21. Definition of done

1. Все 13 failing tests Section 13 → passing.
2. `bun run typecheck && bun run lint && bun test packages/shared packages/server-core` exit 0.
3. 10 AC из Section 14 верифицированы.
4. Postgres round-trip up→down→up в CI (action `validate-server.yml` или addition).
5. Performance benchmark <0.5ms Zod parse, <0.1ms uuid-v7.
6. Audit shim emits 5 event types (mock validated).
7. PII-safe logging — raw email NEVER в audit payload.
8. Feature flag OFF — repositories идле, schemas доступны для import.
9. Worklog заполнен.
10. Linear PZD-113 sub-issues closed; Featurebase changelog drafted.

## 22. Open questions

| # | Question | Proposed resolution |
|---|---|---|
| 1 | DEFAULT_TENANT_ID constant — где живёт (shared/core или per-package)? | `packages/shared/src/core/uuid-v7.ts` экспортирует `DEFAULT_TENANT_ID` как well-known UUID v7 `01900000-0000-7000-8000-000000000000`. |
| 2 | Username — assigned в WT-13 — но как enforce uniqueness across tenants? | `username` unique только per tenant в Foundation Cut; cross-tenant uniqueness — open question для WT-13 (proposed: ON, чтобы `@username` всегда globally unique для mailbox @rox.one). |
| 3 | `claims` JSONB size 16KB — достаточно для real-world JWT? | Real-world Anthropic OAuth JWT ~3KB, SCIM payload ~5KB; 16KB запас 3x — достаточно. Если SCIM custom-attributes overflow → store отдельно в `identity_extended_claims` table (defer). |
| 4 | Soft-delete grace period (30 дней?) — где enforced? | NOT в этом WT; `deleted_at_utc` просто маркер. Cron-job очистки = WT-27 (soft-delete-versioning). |
| 5 | UUID v7 vs ULID — final? | UUID v7 — RFC-track standard, native Postgres `gen_random_uuid()` будет поддерживать v7 в PG17+; миграция forward-friendly. ULID отвергнут (non-standard). |
| 6 | `provider: 'rox-local'` — для local-only accounts без OAuth (testing? offline)? | YES, нужен для tests + future offline-first; флаг allows локальную registration. |
