# WT-07 — Entitlement + FeatureFlag engine

**Дата:** 2026-05-21
**Статус:** Design — готов к Phase 1 (Discovery)
**Branch:** `feat/contract-entitlement-flags`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-07-entitlement-flags`
**Parent epic:** PZD-115 (E04 — Skills, Automations, Permissions)
**Wave:** 0 (Foundation)
**Priority:** P0

---

## 1. Контекст и цель

Master design (Section 2.3) требует, чтобы каждый WT мерджился за feature flag.
Сейчас нет ни одного централизованного registry — feature flag'и разбросаны по
`apps/electron/src/main/config/` и hardcoded constants. Параллельно растёт
требование на entitlement engine для tier'а Free/Pro/Team/Enterprise (см. WT-05
A05-01 plan enum) и quota tracking (storage в WT-24, agent fabric в WT-29/30).

**Цель WT-07** — три связанных контракта в одном WT (но в трёх файлах):
1. `FeatureFlag` registry — централизованная таблица флагов с default values.
2. `Entitlement` — per-tenant overrides поверх defaults + TTL.
3. `QuotaAccount` — runtime usage counter с limits.

После merge — read-only для всех downstream WT (они только читают / consume,
а не меняют схему).

## 2. Скоуп

### 2.1 Входит

- `packages/shared/src/feature-flags/registry.ts` — `FeatureFlagKey` enum +
  `FEATURE_FLAGS` const с default values + `getDefaultValue(key)` +
  `registerFlag(key, default, owner_wt)` helper для регистрации новых
- `packages/shared/src/feature-flags/entitlement.ts` — zod-схема +
  `Entitlement` type + `resolveEntitlement(tenantId, key)` (with TTL)
- `packages/shared/src/feature-flags/quota-account.ts` — zod-схема +
  `QuotaAccount` type + `QuotaResource` enum + consumption methods
  (`tryConsume`, `release`, `peek`)
- `packages/shared/src/feature-flags/index.ts` — barrel
- `packages/server-core/src/schema/feature-flags.ts` — SQL definitions +
  migration `0003_feature_flags.up.sql` / `.down.sql`
- `tests/unit/feature-flags/registry.test.ts`,
  `tests/unit/feature-flags/entitlement.test.ts`,
  `tests/unit/feature-flags/quota-account.test.ts`
- `wt-meta/wt-07.yaml`

### 2.2 Вне скоупа

- Tenant / Organization (WT-05) — только `tenantId` references
- Workspace / Team / Membership (WT-06)
- Audit emit (WT-08) — interface stub только
- UI для управления флагами (WT-17/WT-37)
- Live remote flag service (Cloudflare KV-based) — отложено до Wave 2
- Permission modes (E04-S03 — отдельный WT, не этот)

### 2.3 Forbidden globs

- `packages/shared/src/core/tenant.ts`, `organization.ts`,
  `workspace.ts`, `team.ts`, `user.ts`
- `packages/shared/src/audit/**`
- `package.json`, `tsconfig*.json`, `bun.lock`

## 3. Модель данных

```ts
// 3.1 Registry
export const FEATURE_FLAGS = {
  'rox.feature.contracts.tenant-org.v1':    { default: false, owner_wt: 'WT-05' },
  'rox.feature.contracts.workspace-team.v1':{ default: false, owner_wt: 'WT-06' },
  'rox.feature.access-jwt':                  { default: false, owner_wt: 'WT-10' },
  'rox.feature.scim':                        { default: false, owner_wt: 'WT-11' },
  'rox.feature.rbac.v1':                     { default: false, owner_wt: 'WT-14' },
  'rox.feature.drive.v1':                    { default: false, owner_wt: 'WT-23' },
  'rox.feature.agent-fabric.v1':             { default: false, owner_wt: 'WT-28' },
  'rox.feature.prompt-v2':                   { default: false, owner_wt: 'WT-33' },
  // дополняется через registerFlag()
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

// 3.2 Entitlement
export const EntitlementSource = z.enum(['default', 'tenant-override', 'plan-pack', 'admin-grant']);

export const Entitlement = z.object({
  id:         z.string().uuid(),
  tenantId:   z.string().uuid(),
  featureKey: z.string(),
  value:      z.union([z.boolean(), z.number(), z.string()]),
  source:     EntitlementSource,
  expiresAt:  z.string().datetime({ offset: false }).nullable().default(null),
  createdAt:  z.string().datetime({ offset: false }),
});

// 3.3 Quota
export const QuotaResource = z.enum([
  'storage_bytes',
  'agent_runs_per_day',
  'mcp_connections',
  'mailbox_addresses',
  'team_members',
  'skill_installs',
]);
export const QuotaPeriod = z.enum(['minute', 'hour', 'day', 'month', 'lifetime']);

export const QuotaAccount = z.object({
  id:          z.string().uuid(),
  scope:       z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('tenant'), tenantId: z.string().uuid() }),
    z.object({ kind: z.literal('user'),   userId:   z.string().uuid() }),
    z.object({ kind: z.literal('workspace'), workspaceId: z.string().uuid() }),
  ]),
  resource:    QuotaResource,
  used:        z.number().int().min(0),
  limit:       z.number().int().min(0),
  period:      QuotaPeriod,
  periodStart: z.string().datetime({ offset: false }),
  updatedAt:   z.string().datetime({ offset: false }),
});
```

Resolve order: `admin-grant` > `tenant-override` > `plan-pack` > `default`.
TTL: `expiresAt < now()` → entry игнорируется, fallback to next-level.

## 4. Архитектурные решения

- **A07-01 — Registry — compile-time const.** `FEATURE_FLAGS` живёт в
  `.ts` файле как readonly object; type-system enforce'ит существующие keys.
  Динамическая регистрация — только через `registerFlag` (in-memory map, без
  persistence на этом этапе).
- **A07-02 — Entitlement values polymorphic.** `boolean | number | string` —
  поддержка булевых флагов, числовых лимитов, строковых choice'ов
  (например, `'eu'|'us'` для региона). Каждое downstream consume site
  знает свой тип (через generic `getEntitlement<T>(key)`).
- **A07-03 — Quota — append-on-consume.** `tryConsume(resource, amount)` либо
  succeeds + увеличивает `used`, либо возвращает `{ ok: false, retryAfter }`.
  Никаких update-in-place операций — каждое consume событие пишет audit
  через interface (реальный emit — WT-08).
- **A07-04 — Quota periods auto-reset.** При `now() > periodStart + period`
  `used` обнуляется при следующем `peek`/`tryConsume`. Lifetime — без сброса.
- **A07-05 — Sources priority hardcoded.** Не configurable runtime; смена
  требует миграции + audit-flagged event.

## 5. Acceptance criteria

- [ ] AC-1: `getDefaultValue('rox.feature.access-jwt')` → `false`
- [ ] AC-2: `registerFlag('rox.feature.foo', true, 'WT-99')` — после вызова
      `getDefaultValue('rox.feature.foo')` → `true`
- [ ] AC-3: Дубликат `registerFlag` с другим default → `DuplicateFlagError`
- [ ] AC-4: Entitlement override (`source: 'tenant-override'`) выигрывает у
      default
- [ ] AC-5: `admin-grant` выигрывает у `tenant-override`
- [ ] AC-6: Entitlement c `expiresAt` в прошлом → ignored
- [ ] AC-7: `tryConsume(account, 10)` при `used=95, limit=100` → ok, new
      `used=105` запрещено → `{ ok: false }`
- [ ] AC-8: `tryConsume(account, 5)` при `used=95, limit=100` → ok, new
      `used=100`
- [ ] AC-9: Auto-reset при пересечении периода: `period='day'`, `periodStart`
      ≥24h назад → reset перед consume
- [ ] AC-10: Quota scope discriminated correctly (tenant/user/workspace)
- [ ] AC-11: Migration up/down — reversible

## 6. Тестовый план (TDD-first)

1. **`registry.test.ts › flag override`** — tenant с `Entitlement(key='rox.feature.foo', value=true)` поверх `default=false` → `resolveEntitlement(...)` → `true`.
2. **`entitlement.test.ts › TTL expiry`** — `expiresAt` в прошлом — entry
   игнорируется; в будущем — учитывается.
3. **`entitlement.test.ts › source priority`** — все 4 источника одновременно;
   resolve возвращает `admin-grant`.
4. **`quota-account.test.ts › consumption tracking`** — multiple
   `tryConsume` накапливают `used`; finally `tryConsume(amount > remaining)` →
   denied.
5. **`quota-account.test.ts › period auto-reset`** — `period='hour'`,
   `periodStart` 2h назад → first `tryConsume` сбрасывает `used` в 0.

Дополнительно: registry conflict, scope discriminated union,
migration reversibility, audit interface stub invoked on consume.

## 7. Inspiration repos

| Repo | Integration | Зачем |
|---|---|---|
| `github/spec-kit` | reference_only | Spec-driven skills — паттерн для declarative feature gates |
| `safishamsi/graphify` | plugin | Skills registry pattern, аналогично flags registry |
| `multica-ai/multica` | reference_only | Skills/automations контракт; reference для entitlement consumption |
| `wasp-lang/open-saas` | reference_only | Tier/plan → entitlement mapping |
| `666ghj/BettaFish` | reference_only | Multi-agent orchestration — pattern для per-tenant feature gating |

## 8. Phase 5 swarm distribution

Стандартный 13-role swarm. UX-guru не задействован.

## 9. Связи

- **Зависит от:** WT-00 (scaffolds), WT-05 (tenantId), WT-06 (workspaceId)
- **Блокирует:** WT-10..WT-39 (все WT регистрируют feature flag здесь),
  WT-24 (Quota engine — downstream uses), WT-37 (UI surface для entitlements)

## 10. Verification

Type-check + bun test на 3 машинах. Migration up/down. Pre-merge gate
проверяет, что `FEATURE_FLAGS` const содержит keys для всех уже-merged
downstream WT (cross-reference с master `release-cuts.yaml`).

## 11. Open questions

- (O-1) Persistence flag overrides — sqlite-only или Cloudflare KV remote?
  Решение: SQLite + cache; KV — Wave 2 (отдельный WT).
- (O-2) Quota lifetime может ли быть negative (для credit-based billing)?
  Сейчас `min(0)`; решение откладывается до WT-24.
- (O-3) Audit emit interface — sync или async? Решение: async через
  WT-08 `logger.audit()` (WT-08 owns interface).

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** N/A
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** Entitlement, FeatureFlag, QuotaAccount
- **Events emitted (WT-49 ActivityEvent):** entitlement.granted, quota.exceeded
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** data, security
