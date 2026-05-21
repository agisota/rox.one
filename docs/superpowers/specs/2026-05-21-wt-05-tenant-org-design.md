# WT-05 — Tenant + Organization data contract

**Дата:** 2026-05-21
**Статус:** Design — готов к Phase 1 (Discovery)
**Branch:** `feat/contract-tenant-org`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-05-tenant-org`
**Parent epic:** PZD-113 (E02 — Auth, RBAC, Multi-tenant)
**Wave:** 0 (Foundation)
**Priority:** P0

---

## 1. Контекст и цель

ROX.ONE сейчас работает в single-user режиме; multi-tenant включается фича-флагом
`ROX_MULTI_TENANT=1`, но базового data contract на уровне `Tenant` и
`Organization` в `packages/shared/src/core/` нет. Все компоненты выше
(workspace, RBAC, billing, telemetry) держат свои локальные представления.

**Цель WT-05** — зафиксировать единый канонический контракт `Tenant` и
`Organization`: zod-схема, branded id, soft-delete, plan enum, slug uniqueness,
default-tenant поведение при выключенном multi-tenant флаге. Это foundation для
WT-06 (Workspace/Team), WT-10/WT-11 (Access JWT, SCIM), WT-16 (isolation tests),
WT-24 (Quota), WT-28 (agent fabric).

После merge файлы становятся **read-only** для других WT (см. master Section 2.1).

## 2. Скоуп

### 2.1 Входит

- `packages/shared/src/core/tenant.ts` — zod-схема + `TenantId` branded type +
  `Tenant` type + `TenantPlan` enum + `parseTenant` / `serializeTenant`
- `packages/shared/src/core/organization.ts` — zod-схема + `OrganizationId`
  branded + `Organization` type + `OrganizationSettings` shape +
  `parseOrganization` / `serializeOrganization`
- `packages/shared/src/core/tenant-defaults.ts` — `DEFAULT_TENANT_ID`,
  `DEFAULT_TENANT_SLUG` ("local"), helper `isDefaultTenant(id)`
- `packages/server-core/src/schema/tenant.ts` — SQL-equivalent schema (Drizzle
  или ad-hoc DDL для SQLite-варианта аудита) и миграция
  `0001_tenant_org.up.sql` + `.down.sql`
- `packages/shared/src/core/index.ts` — re-export новых entry points
- `tests/unit/core/tenant.test.ts`, `tests/unit/core/organization.test.ts`,
  `tests/unit/core/tenant-defaults.test.ts` — TDD-first набор
- `wt-meta/wt-05.yaml` (этот WT) — декларация allowlist / DoD

### 2.2 Вне скоупа

- `user.ts` (WT-04 owner)
- `workspace.ts`, `team.ts`, `membership.ts` (WT-06)
- Entitlement / Feature flag registry (WT-07)
- Audit/telemetry baseline (WT-08)
- Migration уже существующих single-user data в Tenant-окружение
  (отдельный story в E11, не в этом WT)
- Cloudflare-side tenant manifest (отложено до WT-10/WT-11)

### 2.3 Forbidden globs

- `packages/shared/src/core/user.ts`
- `packages/shared/src/core/workspace.ts`
- `packages/shared/src/core/team.ts`
- `packages/shared/src/feature-flags/**`
- `packages/shared/src/audit/**`
- `package.json`, `tsconfig*.json`, `bun.lock` (WT-00 owner)

## 3. Модель данных

```ts
// Branded id
declare const TENANT_ID_BRAND: unique symbol;
export type TenantId = string & { readonly [TENANT_ID_BRAND]: true };

export const TenantPlan = z.enum(['free', 'pro', 'team', 'enterprise']);
export type TenantPlan = z.infer<typeof TenantPlan>;

export const Tenant = z.object({
  id:         z.string().uuid().transform(v => v as TenantId),
  slug:       z.string().regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/),
  name:       z.string().min(1).max(120),
  plan:       TenantPlan.default('free'),
  region:     z.enum(['eu', 'us', 'global']).default('global'),
  createdAt:  z.string().datetime({ offset: false }),
  updatedAt:  z.string().datetime({ offset: false }),
  deletedAt:  z.string().datetime({ offset: false }).nullable().default(null),
});
export type Tenant = z.infer<typeof Tenant>;

export const Organization = z.object({
  id:           z.string().uuid().transform(v => v as OrganizationId),
  tenantId:     z.string().uuid(),
  name:         z.string().min(1).max(120),
  ownerUserId:  z.string().uuid(),
  settings:     z.object({
    defaultLocale: z.string().default('en'),
    enforceMfa:    z.boolean().default(false),
    ssoOnly:       z.boolean().default(false),
  }).default({}),
  createdAt:    z.string().datetime({ offset: false }),
  deletedAt:    z.string().datetime({ offset: false }).nullable().default(null),
});
```

`DEFAULT_TENANT_ID` — фиксированный UUID v7 `01890000-0000-7000-8000-000000000000`,
slug `"local"`. При `ROX_MULTI_TENANT !== '1'` все код-пути резолвят `tenantId`
к этому значению через `resolveTenantId(envOrAuth)`.

## 4. Архитектурные решения (ADR-stubs)

- **A05-01 — Tenant id = UUID v7.** Sortable, B-tree friendly, audit-friendly.
- **A05-02 — Slug — отдельная колонка с unique index.** Не идентификатор —
  человеко-читаемый дисплей; меняется через explicit `renameTenant` audit.
- **A05-03 — Soft-delete через `deletedAt`.** Любые downstream queries
  обязаны фильтровать `deletedAt IS NULL` по умолчанию. WT-06/WT-07/WT-23
  получают helper `whereActive(tenantId)`.
- **A05-04 — Plan — enum, не свободная строка.** Любые downstream features
  matcher'ят по enum значению. Расширение plan допускается только через
  миграцию + audit event.
- **A05-05 — Organization opt-in.** Tenant обязан, organization — нет; на
  Free-plan один tenant = одна organization. Pro/Team/Enterprise могут иметь
  multiple organizations внутри одного tenant.
- **A05-06 — Default tenant — постоянный UUID.** Стабилен через рестарт,
  упрощает миграцию single-user → multi-tenant (WT-16 isolation tests).

## 5. Acceptance criteria

- [ ] AC-1: `Tenant.parse({...valid})` возвращает корректный объект
- [ ] AC-2: `Tenant.parse({ slug: 'A-B' })` → zod error (slug должен быть
      lowercase)
- [ ] AC-3: `Tenant.parse({ plan: 'platinum' })` → zod error (не в enum)
- [ ] AC-4: `Tenant.parse({...без deletedAt})` → `deletedAt: null`
- [ ] AC-5: `isDefaultTenant(DEFAULT_TENANT_ID) === true`,
      `isDefaultTenant('<random uuid>') === false`
- [ ] AC-6: При `ROX_MULTI_TENANT !== '1'` `resolveTenantId({})` →
      `DEFAULT_TENANT_ID` без warn-level audit
- [ ] AC-7: При `ROX_MULTI_TENANT === '1'` и отсутствии auth context
      `resolveTenantId({})` бросает `MissingTenantContextError`
- [ ] AC-8: Org without owner → zod error
- [ ] AC-9: `serializeTenant` round-trip stable (parse(serialize(x)) === x)
- [ ] AC-10: SQL-миграция up + down работают; `.down.sql` reverses cleanly
      (verified в migration test)

## 6. Тестовый план (TDD-first)

Все commit'ы в первом impl-цикле — failing tests (см. master Section 2.2).
Минимум 15 test cases в `tests/unit/core/tenant.test.ts`,
`tests/unit/core/organization.test.ts`, `tests/unit/core/tenant-defaults.test.ts`.
Ниже — 5 обязательных TDD-кейсов:

1. **`tenant.test.ts › default tenant resolution`** — env-флаг OFF, ожидаем
   `DEFAULT_TENANT_ID`; env-флаг ON без auth — throw.
2. **`tenant.test.ts › slug uniqueness`** — duplicate slug на in-memory store
   → `TenantSlugConflictError`.
3. **`tenant.test.ts › plan enum strictness`** — `plan: 'gold'` → zod error,
   `plan: 'pro'` → ok; default `'free'` при отсутствии.
4. **`tenant.test.ts › soft-delete invariants`** — set `deletedAt`, проверка
   `whereActive` фильтрует, `whereDeleted` показывает.
5. **`organization.test.ts › org enforces tenant binding`** —
   `Organization.parse({...без tenantId})` → zod error; orphan organization
   без существующего tenant → `OrganizationOrphanError` в integration test.

Дополнительные тесты: branded id leak (cast обязан не компилироваться,
проверяется через `tsd` или `expect-type`), serialize round-trip, migration
up/down.

## 7. Inspiration repos (3-5)

| Repo | Integration type | Зачем |
|---|---|---|
| `wasp-lang/open-saas` | reference_only | Канонический tenant/org schema для SaaS-бойлерплейта |
| `trailbaseio/trailbase` | reference_only | Single-binary multi-tenant backend — pattern для default-tenant resolution |
| `hackclub/hcb` | reference_only | Multi-tenant financial app с строгим slug/plan enforcement |
| `anomalyco/openauth` | reference_only | Tenant-aware auth провайдер — pattern для tenantId propagation в JWT claims (на стыке с WT-10) |
| `InsForge/InsForge` | reference_only | Agentic backend platform с tenant-scoped storage; reference для миграции WT-23 storage |

## 8. Phase 5 swarm distribution

| Phase | Роли | Модель |
|---|---|---|
| Discovery | brainstormer, requirements-keeper, scope-analyzer, critic | opus-4.7-max |
| Design | prompt-writer, architect | opus-4.7-max |
| Impl tests | test-writer | opus-4.7-max |
| Impl code | implementer, super-coder | sonnet-4.6-medium |
| Impl review | reviewer | opus-4.7-max |
| Verification | verifier, critic, integrator | opus-4.7-max |
| Optimization | optimizer | opus-4.7-max |

UI-guru роль **не задействована** (no UI in this WT).

## 9. Связи с другими WT

- **Зависит от:** WT-00 (snapshot, package.json owner)
- **Блокирует:** WT-06 (workspace ссылается на tenantId), WT-07 (entitlement
  scopes к tenantId), WT-10/WT-11 (auth providers пишут tenantId), WT-16
  (isolation tests), WT-23 (storage paths), WT-28 (agent fabric tenant scoping)

## 10. Verification protocol

3-machine build только для type-check + bun test (UI отсутствует). Screenshot
не требуется — но `bun run typecheck && bun test --scope=core/tenant` обязан
быть зелёным на всех трёх машинах. Migration `up`/`down` гоняется в Ubuntu
runner (SQLite default).

## 11. Open questions

- (O-1) Plan `'enterprise'` — финальное название tier'а? Согласовать с WT-37
  (Onboarding hints) и pricing-page.
- (O-2) Slug change history — нужен ли отдельный `tenant_slug_history` table
  или достаточно audit event'а? Решение откладывается на WT-18 (Audit query API).
- (O-3) Org settings.ssoOnly — где enforce'ится? Кандидат: WT-10 (Access JWT)
  + WT-11 (SCIM).

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** N/A
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** Tenant, Organization
- **Events emitted (WT-49 ActivityEvent):** tenant.created
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** index
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** data, security
