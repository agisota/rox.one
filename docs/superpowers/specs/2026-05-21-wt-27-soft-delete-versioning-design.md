# WT-27 — Soft-delete + versioning policy — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for implementation (TDD-first)
**Ветка:** `feat/soft-delete-versioning`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-27-soft-delete-versioning/`
**Wave:** 2
**Priority:** P1
**Depends on:** WT-23 (storage backend), WT-26 (numbering chain — версии нумеруются той же sequence)
**Blocks:** WT-34 (Drive UI должен видеть version timeline), WT-37 (Onboarding hint про restore)
**Parent epic:** PZD-122 (E10 — Drive / Storage)
**FB board:** Compounding (`6a0db1b5ff6b76b8a0f7c111`)
**Feature flag:** `rox.feature.drive.soft-delete` (default OFF, release cut "Storage")

---

## 1. Контекст

ROX.ONE storage сейчас выполняет hard delete: blob и его reference удаляются
сразу, без grace-периода. Это приводит к двум проблемам:

1. **Accidental data loss** (~15% support тикетов в beta — пользователи случайно
   удаляют файлы в Drive).
2. **No version history** — каждый upload поверх существующего key затирает
   старый контент; нельзя посмотреть/откатить предыдущую редакцию.

WT-27 вводит **soft-delete** с TTL grace window (per-tier) и **versioning
policy** (хранить N revisions per object). Обе фичи переиспользуют existing
infrastructure: dedup pointer-граф (WT-25) гарантирует, что hold-on старой
версии не растёт в физическом размере, если контент совпадает; numbering chain
(WT-26) даёт детерминированный порядок версий и audit-trail.

Inspiration: `tursodatabase/agentfs` (snapshot-based versioning), S3 Object
Lock pattern, Apple Time Machine UX-pattern для restore-точек.

## 2. Цели и нецели

### 2.1 In scope

- `packages/shared/src/storage/soft-delete.ts` — `SoftDeletePolicy`, branded
  `DeletedAt`, helpers `markDeleted`, `restoreFromTrash`, `isExpired`.
- `packages/shared/src/storage/versioning.ts` — `VersionPolicy`,
  `VersionId` branded type, helpers `pushVersion`, `listVersions`,
  `revertToVersion`.
- `packages/server-core/src/storage/soft-delete-service.ts` — orchestrator:
  delete → mark `deleted_at`, restore-from-trash, TTL sweep (cron daily).
- `packages/server-core/src/storage/version-service.ts` — write → push new
  version, GC oldest версий поверх per-tier cap.
- `apps/electron/src/main/storage/trash-bridge.ts` — IPC bridge для renderer
  (list trash, restore, list versions, revert).
- Migration `0012_object_versions.up.sql` + `0012_object_versions.down.sql`
  + `0013_trash_index.up.sql` + `.down.sql`.
- Tests: ≥ 25 unit + 8 integration.

### 2.2 Out of scope

- UI поверх Trash и Version Timeline → WT-34 (Drive UI).
- Hard-delete admin-button bypassing grace → WT-37 (admin tool).
- Legal-hold mode (compliance) → backlog.
- Cross-version diff viewer → отдельный story в Drive UI.

### 2.3 Forbidden globs

- `packages/shared/src/storage/backend.ts` — WT-23.
- `packages/shared/src/storage/dedup.ts` — WT-25.
- `packages/shared/src/storage/numbering.ts` — WT-26.
- `infra/backup/**` — WT-26.
- `apps/electron/src/renderer/**` — UI WT-34.
- `package.json`, `tsconfig*.json`, `bun.lock` — WT-00.

## 3. Архитектура

```
┌──────────────────────────────────────────────────────────────────┐
│  Soft-delete flow                                                │
│    DELETE object → SoftDeleteService.markDeleted(refId)          │
│      ├─ UPDATE content_refs SET deleted_at = NOW()               │
│      ├─ append storage_ops { op_type='soft_delete' }             │
│      └─ ref остаётся в content_refs до TTL                       │
│                                                                  │
│  Trash TTL sweep (cron daily 04:00 UTC)                          │
│    SELECT * FROM content_refs                                    │
│      WHERE deleted_at < (NOW() - tier_grace_period)              │
│    → for each: hard-delete ref (WT-25 decref → maybe physical)   │
│                + audit "object.purged"                           │
│                                                                  │
│  Restore-from-trash (grace period only)                          │
│    SoftDeleteService.restore(refId)                              │
│      ├─ if deleted_at + grace > NOW: UPDATE deleted_at = NULL    │
│      └─ else: reject `GRACE_EXPIRED` (uses backup → WT-26)       │
├──────────────────────────────────────────────────────────────────┤
│  Versioning flow                                                 │
│    UPLOAD к existing key → VersionService.pushVersion(key, buf)  │
│      ├─ DedupService.upload(...) → new BlobRef (может быть hit)  │
│      ├─ INSERT object_versions(version_id, object_key,           │
│      │     blob_ref_id, seq, created_at, actor)                  │
│      ├─ если version count > tier_cap → GC oldest version        │
│      │     (DedupService.delete(oldest.blob_ref_id))             │
│      └─ append storage_ops { op_type='version_push' }            │
│                                                                  │
│  revertToVersion(versionId)                                      │
│    SET current_blob_ref = versions[versionId].blob_ref           │
│      + append storage_ops { op_type='version_revert' }           │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1 Per-tier policy defaults

| Tier | Grace window | Versions kept | Notes |
|---|---|---|---|
| Free | 7 дней | 3 | Минимум для UX |
| Pro | 30 дней | 10 | Стандарт |
| Team | 30 дней | 25 | Совместная работа |
| Enterprise | 90 дней | 50 | Compliance-friendly |

Конфиг hot-reloadable через `feature-flags` (без перезапуска);
тенант-override приоритетнее tier-default (но не ниже tier-floor).

### 3.2 Ключевые файлы (files_allowed)

- `packages/shared/src/storage/soft-delete.ts`
- `packages/shared/src/storage/soft-delete-types.ts`
- `packages/shared/src/storage/versioning.ts`
- `packages/shared/src/storage/versioning-types.ts`
- `packages/server-core/src/storage/soft-delete-service.ts`
- `packages/server-core/src/storage/version-service.ts`
- `packages/server-core/src/storage/migrations/0012_object_versions.up.sql`
- `packages/server-core/src/storage/migrations/0012_object_versions.down.sql`
- `packages/server-core/src/storage/migrations/0013_trash_index.up.sql`
- `packages/server-core/src/storage/migrations/0013_trash_index.down.sql`
- `apps/electron/src/main/storage/trash-bridge.ts`
- `tests/unit/storage/soft-delete/**`
- `tests/unit/storage/versioning/**`
- `tests/integration/storage/soft-delete/**`

## 4. TDD план (≥ 5 tests-first)

| # | Test name | What it asserts |
|---|---|---|
| T1 | `markDeleted sets deleted_at without physical delete` | После `markDeleted` row остаётся; `deleted_at` non-null; dedup ref_count не меняется. |
| T2 | `restore within grace clears deleted_at` | `markDeleted` → wait < grace → `restore` → `deleted_at = NULL`; object visible. |
| T3 | `restore after grace returns GRACE_EXPIRED` | `markDeleted` → fast-forward clock past grace → `restore` → error code `GRACE_EXPIRED`. |
| T4 | `TTL sweep purges expired entries and decrefs blob` | Cron job → ref удалён; DedupService.delete вызван; audit `object.purged`. |
| T5 | `pushVersion creates new version row and reuses blob via dedup` | Upload same bytes 2x → 2 versions, 1 physical blob, ref_count=2. |
| T6 | `version cap enforced per tier (Free=3)` | 4-я version → oldest удалена (GC); audit `version.gc'd`. |
| T7 | `revertToVersion changes current pointer + emits chain op` | После revert: read возвращает старую версию; storage_ops содержит `version_revert`. |
| T8 | `listVersions returns ordered by seq descending` | 5 версий — ответ отсортирован новейшая→старейшая; pagination supported. |
| T9 | `tenant override respects tier floor` | Free tenant override `grace=1d` → принят; override `versions_kept=100` (>tier-cap 3) → clamped к 3. |
| T10 | `feature flag OFF: delete behaves as hard-delete` | `rox.feature.drive.soft-delete=false` → старый WT-25 path; trash empty. |
| T11 | `concurrent revert vs new push: last-writer wins via seq` | Push v6 параллельно с revert на v3 → numbering chain детерминирует порядок; verifyChain зелёный. |
| T12 | `migrations 0012 + 0013 up/down reverse cleanly` | Чистый rollback; integration test. |

Tests-first commit `test(storage/soft-delete): failing tests for soft-delete + versioning`.

## 5. Acceptance Criteria (≥ 5)

1. **AC-1:** Soft-delete grace window enforced per-tier; restore работает в
   grace, fail после grace с актионым hint "use backup restore (WT-26)".
2. **AC-2:** Versioning capped per-tier; GC удаляет oldest версии без потери
   active current pointer; audit-event `version.gc'd` с reason.
3. **AC-3:** Все mutating ops (mark/restore/push/revert/purge) appendятся в
   numbering chain (WT-26) с distinct `op_type`; verifyChain зелёный.
4. **AC-4:** Tenant-level override уважает tier-floor (нельзя установить
   grace меньше tier-default Free=7d через override).
5. **AC-5:** Feature flag `rox.feature.drive.soft-delete=false` → старое
   hard-delete поведение полностью сохраняется (regression-safe).
6. **AC-6:** TTL sweep работает без блокировки upload-path (batch 1000 rows;
   per-tenant locking); metric `trash.sweep.purged_count`.
7. **AC-7:** Renderer IPC bridge возвращает opaque `TrashEntry` и
   `VersionEntry` без raw hash/blob_id; используется `refId` (UUID).

## 6. Risks

| Risk | Mitigation |
|---|---|
| Storage cost растёт из-за удерживаемых версий | Dedup (WT-25) compensates для unchanged content; per-tier cap + GC. |
| Restore выглядит "broken" если пропущен grace | UX hint "Recovery via backup (WT-26)"; admin override на enterprise. |
| Race: revert + concurrent push | Seq monotonic + advisory lock на (tenant, object_key); test T11. |
| Versioning GC удаляет blob, нужный другой версии | DedupService.delete decref'ит; physical-delete fires только при ref_count=0 (T5 покрывает). |
| Tenant понижает tier — что с retained snapshot'ами? | Read-only access до окончания pre-paid grace; downgrade audit-event. |

## 7. Inspiration repos

1. `tursodatabase/agentfs` — snapshot-based versioning (Apache-2.0). `reference_only` — versioning chain integration с content-addressable store.
2. `aws/amazon-s3-resource-control` — Object Lock + retention reference patterns. `reference_only`.
3. `git/git` — packed object history (GPL — не для bundling, только pattern). `reference_only` — версии как pointer-граф.
4. `valkey-io/valkey` — expiration policies для большого keyspace, BSD. `reference_only` — TTL sweep batching.
5. `InsForge/InsForge` — agentic backend с soft-delete-by-default policy, MIT. `reference_only`.

## 8. Verification protocol

- **Unit:** `bun test tests/unit/storage/{soft-delete,versioning}/` — ≥ 25 tests, ≥ 95% coverage.
- **Integration:** real SQLite (in-memory) + mock backend; full delete → restore + push → revert цикл.
- **Time-based tests:** fake-timers (sinon) для grace-window и cron sweep.
- **Chaos:** kill sweep mid-batch → next run resumes без re-purging уже purged rows (idempotent).
- **3-machine:** typecheck + tests + migration на mac/windows/ubuntu.

## 9. Definition of Done

- [ ] Tests-first commit precedes impl.
- [ ] `bun run typecheck` exit 0.
- [ ] `bun run lint` exit 0.
- [ ] `bun test tests/unit/storage/{soft-delete,versioning}/` exit 0 (≥ 25 tests).
- [ ] `bun test tests/integration/storage/soft-delete/` exit 0 (≥ 8 scenarios).
- [ ] Migrations 0012 + 0013 up/down проходят.
- [ ] Tier policy table документирован в `docs/architecture/storage-tiers.md`.
- [ ] Audit events emit verified (purge/restore/version-gc/revert).
- [ ] Feature flag OFF: regression test зелёный.
- [ ] Linear PZD-122 sub-issues "Ready for Merge".

## 10. Open questions

- (O-1) Tier-floor для grace и versions_kept — final список значений с
  продактом. См. master Q27.
- (O-2) Cross-tenant move object (workspace transfer) — переносить версии
  целиком или обрезать на migration moment? Решение: переносим целиком (audit).
- (O-3) Visible quota: считать ли trash + versions в tenant.quota.used? Текущее
  решение: считать с дисконтом 0.5x (поощряем хранение версий).
