# WT-06 — Workspace + Team data contract

**Дата:** 2026-05-21
**Статус:** Design — готов к Phase 1 (Discovery)
**Branch:** `feat/contract-workspace-team`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-06-workspace-team`
**Parent epic:** PZD-122 (E11 — Workspaces & Migration)
**Wave:** 0 (Foundation)
**Priority:** P0

---

## 1. Контекст и цель

Workspace в ROX.ONE — главная единица изоляции данных пользователя (skills,
notes, drive, agent runs). Team — структура внутри tenant'а (root team, sub-teams,
manager/member роли). Membership связывает `userId` ↔ `workspaceId|teamId` с
ролью. На сегодня workspace представления разбросаны по
`apps/electron/src/main/storage/`, `packages/shared/src/scope/`,
`packages/shared/src/skills/`. WT-06 фиксирует единый канонический контракт.

**Цель:** один источник правды для Workspace/Team/Membership; foundation для
WT-14 (Roles engine), WT-15 (Membership invite), WT-17 (RBAC admin UI), WT-23
(Storage), WT-35 (Notes), WT-36 (Day tracking).

После merge файлы read-only для всех downstream WT.

## 2. Скоуп

### 2.1 Входит

- `packages/shared/src/core/workspace.ts` — zod-схема + `WorkspaceId` branded +
  `Workspace` + helpers (`isolation_path`, `whereActiveWorkspace`)
- `packages/shared/src/core/team.ts` — zod-схема + `TeamId` branded + `Team` +
  parentTeamId hierarchy + depth-check helper
- `packages/shared/src/core/membership.ts` — zod-схема + `Membership` +
  `MembershipRole` enum + `MembershipScope` discriminated union
  (workspace / team)
- `packages/server-core/src/schema/workspace.ts` — Drizzle/SQL definitions +
  миграция `0002_workspace_team.up.sql` + `.down.sql`
- `packages/shared/src/core/index.ts` — re-export новых entry points
  (через scaffold-extension request к WT-05 если index.ts уже им
  занят — иначе append-only через master orchestrator-coordinated cycle)
- `tests/unit/core/workspace.test.ts`, `tests/unit/core/team.test.ts`,
  `tests/unit/core/membership.test.ts`
- `wt-meta/wt-06.yaml`

### 2.2 Вне скоупа

- `tenant.ts`, `organization.ts` (WT-05)
- Roles policy engine (WT-14)
- Membership invitation flow (WT-15) — данные хранения только, UX/email — WT-15
- Workspace УI (WT-33, WT-34)
- Migration legacy `~/.rox-agent/` → workspace-aware path (WT-23, E11-S01)
- Default workspace bootstrap при first-run (WT-04 — user identity)

### 2.3 Forbidden globs

- `packages/shared/src/core/tenant.ts` (WT-05)
- `packages/shared/src/core/organization.ts` (WT-05)
- `packages/shared/src/feature-flags/**` (WT-07)
- `packages/shared/src/audit/**` (WT-08)
- `package.json`, `tsconfig*.json`, `bun.lock`

## 3. Модель данных

```ts
export const WorkspaceId = z.string().uuid().brand<'WorkspaceId'>();
export type WorkspaceId = z.infer<typeof WorkspaceId>;

export const Workspace = z.object({
  id:             WorkspaceId,
  tenantId:       z.string().uuid(),
  name:           z.string().min(1).max(120),
  slug:           z.string().regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/),
  isolationPath:  z.string().regex(/^[a-z0-9_/-]{1,256}$/),
  settings:       z.object({
    defaultLocale: z.string().default('en'),
    archived:      z.boolean().default(false),
  }).default({}),
  createdAt:      z.string().datetime({ offset: false }),
  deletedAt:      z.string().datetime({ offset: false }).nullable().default(null),
});

export const TeamId = z.string().uuid().brand<'TeamId'>();
export const Team = z.object({
  id:            TeamId,
  tenantId:      z.string().uuid(),
  name:          z.string().min(1).max(120),
  parentTeamId:  z.string().uuid().nullable().default(null),
  depth:         z.number().int().min(0).max(5),   // hard cap
  createdAt:     z.string().datetime({ offset: false }),
  deletedAt:     z.string().datetime({ offset: false }).nullable().default(null),
});

export const MembershipRole = z.enum([
  'owner', 'admin', 'manager', 'member', 'viewer', 'guest',
]);

export const Membership = z.object({
  id:        z.string().uuid(),
  userId:    z.string().uuid(),
  scope:     z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('workspace'), workspaceId: WorkspaceId }),
    z.object({ kind: z.literal('team'),      teamId: TeamId }),
  ]),
  role:      MembershipRole,
  joinedAt:  z.string().datetime({ offset: false }),
  expiresAt: z.string().datetime({ offset: false }).nullable().default(null),
});
```

`isolationPath` — относительный путь на диске (`tenants/<tid>/workspaces/<wid>/`),
unique per tenant. Используется WT-23 (storage backend) и WT-26 (backup).

## 4. Архитектурные решения

- **A06-01 — Hierarchy depth cap = 5.** Предотвращает циклы и cap'ит cost
  permission resolution. Проверяется в zod + DB constraint.
- **A06-02 — Membership как union, не FK к двум таблицам.** Один membership
  ссылается либо на workspace, либо на team — не на оба.
- **A06-03 — Roles — closed enum.** Расширение требует миграцию +
  WT-14 update. Не свободные строки.
- **A06-04 — isolationPath unique per tenant.** Composite index
  `(tenantId, isolationPath)`. Прямой путь, без resolve символьных ссылок,
  чтобы WT-23 мог делать `path.join(root, isolationPath)` детерминированно.
- **A06-05 — Soft-delete как у tenant.** Каскад: delete workspace →
  `deletedAt` set, но fs-данные не удаляются физически — это работа
  WT-27 (Soft-delete versioning).
- **A06-06 — Default workspace — per-tenant, не глобальный.** При first-run
  каждого tenant'а bootstrap создаёт `default-workspace` (slug `default`).
  Сам bootstrap — в WT-04 (user identity) или WT-16 (isolation tests setup).

## 5. Acceptance criteria

- [ ] AC-1: `Workspace.parse(...)` принимает валидный объект
- [ ] AC-2: Duplicate `isolationPath` внутри одного `tenantId` → conflict
- [ ] AC-3: Same `isolationPath` в разных tenants → OK
- [ ] AC-4: `Team.parse({ depth: 6 })` → zod error
- [ ] AC-5: Team-hierarchy cycle detection: `parentTeamId` ссылается на потомка
      → `TeamCycleError` в helper `assertNoCycle`
- [ ] AC-6: `MembershipRole.parse('superuser')` → zod error
- [ ] AC-7: Membership.scope discriminated correctly (`kind: 'workspace'` →
      `workspaceId` required, `teamId` запрещён)
- [ ] AC-8: `expiresAt < joinedAt` → zod error
- [ ] AC-9: Migration up + down round-trip clean
- [ ] AC-10: Branded ids не cast'аются прямо (typecheck failure on raw string)

## 6. Тестовый план (TDD-first)

Минимум 5 обязательных tests + ещё ≥10 покрытия:

1. **`workspace.test.ts › isolation_path uniqueness`** — два workspace с тем
   же `isolationPath` в одном `tenantId` → `WorkspaceIsolationConflictError`.
2. **`team.test.ts › depth limit`** — Team с `depth=6` отвергается; Team
   с `depth=5` принимается; helper `computeDepth(team, parent)` возвращает
   правильное значение.
3. **`team.test.ts › cycle detection`** — `assertNoCycle(teamA, teamB)` где
   `parentTeamId(B) === A.id` и пытаемся сделать `parentTeamId(A) = B.id` →
   throw.
4. **`membership.test.ts › role enum`** — `member`, `manager`, `viewer`,
   `guest`, `admin`, `owner` принимаются; `'reader'` → error.
5. **`membership.test.ts › scope discriminated union`** — `{ kind: 'workspace',
   workspaceId, teamId }` → zod error (teamId не должен быть в workspace
   scope); `{ kind: 'team', teamId }` без `workspaceId` — OK.

Дополнительно: migration up/down test, branded id leak test, archived workspace
filtered by `whereActiveWorkspace`.

## 7. Inspiration repos

| Repo | Integration | Зачем |
|---|---|---|
| `openai/symphony` | reference_only | Workspace-first agent architecture |
| `nocobase/nocobase` | reference_only | Workspaces + roles + permissions data model |
| `ln-dev7/circle` | reference_only | Project/team UI data model |
| `JerryZLiu/Dayflow` | reference_only | Workspace-scoped time/session data |
| `tobi/try` | reference_only | Ephemeral workspaces pattern — отсылка для archived flag |

## 8. Phase 5 swarm distribution

Стандартный 13-role swarm (без UX-guru, no UI). Все Phase 1-4 опус-max, кроме
implementer/super-coder (sonnet-medium).

## 9. Связи

- **Зависит от:** WT-00 (scaffolds), WT-05 (tenantId references)
- **Блокирует:** WT-14 (roles engine), WT-15 (membership invite), WT-17 (RBAC
  admin UI), WT-23 (storage), WT-24 (quota по workspaceId), WT-28 (agent
  fabric scoping), WT-35 (notes-mvp), WT-36 (day tracking)

## 10. Verification

Type-check + bun test на 3 машинах. Migration up/down на ubuntu runner.
Screenshot не требуется. Pre-merge gate должен показать что
`grep -r "isolation_path\|workspaceId" packages/shared/src/core/` приводит
только к новым файлам.

## 11. Open questions

- (O-1) Membership expiration — soft (флаг expired) или hard (record удаляется)?
  Сейчас expiresAt nullable + downstream policy. Решение в WT-14.
- (O-2) Default `slug='default'` — глобально или per-tenant? Согласовать с WT-22
  (mailbox-domain) — там `user@<tenant-slug>.rox.one` логика.
- (O-3) Workspace archive vs delete — UX тонкости в WT-17.

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** N/A
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** Workspace, Team, Membership
- **Events emitted (WT-49 ActivityEvent):** workspace.created, team.created
- **AI context implications (WT-48):** workspace-context
- **Search index implications (WT-50):** index
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** Workspace isolation
- **Risk axes:** data, security
