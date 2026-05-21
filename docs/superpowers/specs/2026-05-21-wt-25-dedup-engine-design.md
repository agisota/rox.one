# WT-25 — Content-hash deduplication engine — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for implementation (TDD-first)
**Ветка:** `feat/dedup-engine`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-25-dedup-engine/`
**Wave:** 2
**Priority:** P1
**Depends on:** WT-23 (storage backend контракт + tenant-scoped namespaces)
**Blocks:** WT-26 (backup опирается на dedup pointer-граф), WT-27 (soft-delete + versioning reuse ref-count)
**Parent epic:** PZD-122 (E10 — Drive / Storage)
**FB board:** Compounding (`6a0db1b5ff6b76b8a0f7c111`)
**Feature flag:** `rox.feature.drive.dedup` (default OFF, release cut "Storage")

---

## 1. Контекст

WT-23 даёт ROX.ONE базовый storage backend с tenant-scoped namespaces, но без
дедупликации: каждый upload пишется как уникальный physical blob, даже если
байты идентичны (snapshot одного и того же документа двумя пользователями,
повторная загрузка одного и того же ассета из спеки, общая ZIP-зависимость в
скилл-бандле). Это даёт линейный рост storage cost и breaks audit-chain
оптимизаций для WT-26 (backup) и WT-27 (versioning).

WT-25 вводит **content-addressable storage layer** поверх WT-23: каждый объект
адресуется детерминированным SHA-256 hash'ом контента (BLAKE3 как fast-path
fallback для horizon scan), а references — в отдельной reference-таблице с
ref-count и tenant-scope ACL. Inspiration: `tursodatabase/agentfs`,
`InsForge/InsForge` (content-addressable agent storage).

Дедупликация **строго tenant-scoped по умолчанию** (no cross-tenant pointer
leak) — конфиг `cross_tenant_dedup` доступен только enterprise plan и при
`ROX_GLOBAL_DEDUP=1` env (отложено на WT-41 spike — не в этом WT).

## 2. Цели и нецели

### 2.1 In scope

- `packages/shared/src/storage/dedup.ts` — pure-function API:
  `hashContent(buf)`, `ContentHash` branded type, `DedupIndex` ABC.
- `packages/shared/src/storage/dedup-index.ts` — SQLite-backed reference table:
  `content_blobs(hash, size, tenant_id, ref_count, first_seen_at, last_ref_at)`
  + `content_refs(ref_id, hash, tenant_id, object_key, scope, created_at)`.
- `packages/server-core/src/storage/dedup-service.ts` — server-side orchestrator:
  upload (hash → check → store-or-incref), delete (decref → physical delete if
  count=0), GC sweep (orphan scan).
- `apps/electron/src/main/storage/dedup-bridge.ts` — IPC bridge для renderer
  (тонкий wrapper; renderer не видит hash в plain text — только opaque
  `BlobRef`).
- Migration `0010_content_blobs.up.sql` + `.down.sql`.
- Tests: ≥ 20 unit + 8 integration.

### 2.2 Out of scope

- Backup-job orchestration → WT-26.
- Soft-delete / versioning policy → WT-27.
- Cross-tenant dedup → WT-41 spike (research only).
- UI поверх storage (Drive view, file-tree) → WT-34, WT-37.
- E2E encryption + key derivation → WT-44 (отдельный stream).

## 3. Архитектура

```
┌──────────────────────────────────────────────────────────────────┐
│  Upload flow                                                     │
│    renderer.uploadBlob(buf) ──IPC──> main.dedup-bridge           │
│      │                                                           │
│      ▼                                                           │
│  DedupService.upload({ tenantId, key, buf })                     │
│    ├─ hash = sha256(buf)             (streaming, no full alloc)  │
│    ├─ exists = DedupIndex.lookup(tenantId, hash)                 │
│    │     ├─ HIT → incref + insert into content_refs              │
│    │     └─ MISS → StorageBackend.put(hash, buf)                 │
│    │                + DedupIndex.create(tenantId, hash, size)    │
│    │                + content_refs insert                        │
│    └─ return BlobRef { hash, refId, size }                       │
├──────────────────────────────────────────────────────────────────┤
│  Delete flow                                                     │
│    DedupService.delete({ tenantId, refId })                      │
│    ├─ decref content_refs (delete row)                           │
│    ├─ if count(content_refs WHERE hash=H) == 0 →                 │
│    │     StorageBackend.del(H) + DedupIndex.delete(H)            │
│    │     + audit("blob.physically_deleted")                      │
│    └─ else → audit("blob.dereferenced")                          │
├──────────────────────────────────────────────────────────────────┤
│  GC sweep (cron, daily 03:00 UTC per region)                     │
│    SELECT hash FROM content_blobs                                │
│      WHERE ref_count = 0 AND last_ref_at < now() - 24h           │
│    → physical delete + audit batch                               │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1 Ключевые файлы (files_allowed)

- `packages/shared/src/storage/dedup.ts`
- `packages/shared/src/storage/dedup-index.ts`
- `packages/shared/src/storage/dedup-types.ts`
- `packages/shared/src/storage/index.ts` (только re-export новых entry points)
- `packages/server-core/src/storage/dedup-service.ts`
- `packages/server-core/src/storage/migrations/0010_content_blobs.up.sql`
- `packages/server-core/src/storage/migrations/0010_content_blobs.down.sql`
- `apps/electron/src/main/storage/dedup-bridge.ts`
- `tests/unit/storage/dedup/**/*.test.ts`
- `tests/integration/storage/dedup/**/*.test.ts`

### 3.2 files_forbidden

- `packages/shared/src/storage/backend.ts` — owned by WT-23.
- `packages/shared/src/storage/quota.ts` — owned by WT-24.
- `apps/electron/src/main/storage/backend-bridge.ts` — WT-23.
- `package.json`, `tsconfig*.json`, `bun.lock` — WT-00.

### 3.3 Scaffold-extension requests

- WT-00: добавить `blake3@^3.0.0` (fast-path hashing для очень больших
  blob'ов > 4MB; SHA-256 остаётся canonical).
- WT-00: добавить `better-sqlite3-multi-cipher@^11.0.0` (уже используется в
  audit-storage — переиспользуем для dedup-index; verify no version drift).

## 4. TDD план (≥ 5 tests-first)

| # | Test name | What it asserts |
|---|---|---|
| T1 | `hashes identical buffers to identical SHA-256` | Detereministic SHA-256 для одного buffer; разные buffers → разные hash'ы. |
| T2 | `upload of duplicate buffer increments ref_count` | Two uploads of same bytes in same tenant → один physical blob, ref_count=2, два разных `refId`. |
| T3 | `delete of last reference triggers physical delete` | После delete всех refs → blob удалён из backend; audit event `blob.physically_deleted`. |
| T4 | `delete of non-last reference keeps physical blob` | После delete одного из двух refs → blob остаётся; audit event `blob.dereferenced`. |
| T5 | `dedup is tenant-scoped by default` | Same bytes uploaded by tenant A и tenant B → два разных physical blob (no cross-tenant ref). |
| T6 | `feature flag OFF makes dedup a no-op pass-through` | `rox.feature.drive.dedup=false` → каждый upload пишется как unique blob; ref_count всегда 1. |
| T7 | `GC sweep removes orphans older than grace window` | `ref_count=0 AND last_ref_at < now-24h` → удалён; `< 24h` → остаётся. |
| T8 | `concurrent uploads of same content are race-safe` | 10 parallel uploads одного буфера → один physical blob, ref_count=10 (singleflight + advisory lock). |
| T9 | `migration up/down reverses cleanly` | 0010 up создаёт схему; 0010 down дропает обе таблицы; `verify_migrations.test.ts` зелёный. |
| T10 | `BlobRef opaque: renderer cannot see raw hash` | IPC bridge возвращает `BlobRef` без `hash` поля; hash хранится только в main process. |

Все тесты — первый commit ветки `test(storage/dedup): failing tests for content-hash dedup` до любого impl-кода.

## 5. Acceptance Criteria (≥ 5)

1. **AC-1:** `DedupService.upload(tenantId, key, buf)` идемпотентна на уровне
   `(tenantId, hash)` — повторный upload возвращает существующий BlobRef.
2. **AC-2:** Удаление последнего reference → physical delete с audit-event,
   содержащим `tenantId`, `hash_prefix` (первые 8 hex), `size_bytes`.
3. **AC-3:** GC sweep работает в batches (LIMIT 1000), не блокирует upload-path,
   pinned cron daily 03:00 UTC; metric `dedup.gc.sweeps_total`.
4. **AC-4:** Hash алгоритм по умолчанию — SHA-256 (canonical для audit);
   `blake3` опционально для buffer'ов > 4MB (метрика `dedup.hash.algo`).
5. **AC-5:** Tenant isolation: cross-tenant lookup в `DedupIndex.lookup` всегда
   возвращает MISS, даже если hash совпадает (no info leak про другой tenant).
6. **AC-6:** Feature flag `rox.feature.drive.dedup=false` → dedup-path bypassed;
   ref_count всегда 1; никаких записей в `content_blobs`/`content_refs`.
7. **AC-7:** Renderer process никогда не видит raw SHA-256 — только opaque
   `BlobRef.refId` (UUID v7).

## 6. Risks

| Risk | Mitigation |
|---|---|
| Hash collision (SHA-256 ≈ 2^-128) | Принято as cryptographically negligible; audit fires on collision (size mismatch) с reason `HASH_COLLISION` для forensic. |
| Race на concurrent upload same hash | Advisory lock per `(tenantId, hash)` в SQLite + singleflight per process; integration test T8. |
| GC удаляет blob во время in-flight read | Reader держит explicit "lease" в `content_refs` со scope=`read-lease`, TTL=10min; GC ignore'ит leases. |
| Tenant migration ломает ref-graph | WT-23 owns migration tooling; dedup-index переезжает атомарно по tenantId. |
| SQLite дедуп-таблица растёт unbounded | GC + per-tier retention; metric `dedup_index_rows`; alert > 10M rows. |

## 7. Inspiration repos

1. `tursodatabase/agentfs` — content-addressable agent filesystem (Apache-2.0). `integration_type: reference_only` — primary inspiration для `BlobRef` opaque pattern + ref-count GC sweep.
2. `InsForge/InsForge` — agentic backend с content-hash storage, MIT. `reference_only` — tenant-scoped namespacing + dedup index schema.
3. `linear/linear-release` — release-feed dedup для idempotent processing. `reference_only` — pattern для `(tenant, hash)` advisory lock.
4. `panva/jose` (уже в deps WT-10) — `crypto.subtle.digest` wrapper для SHA-256 streaming. `dependency`.
5. `BLAKE3-team/BLAKE3` — Rust + WASM bindings (CC0/Apache). `dependency` (via `blake3` npm) для fast-path.

## 8. Verification protocol

- **Unit:** `bun test tests/unit/storage/dedup/` — ≥ 20 tests, ≥ 95% coverage на
  `dedup.ts` + `dedup-index.ts`.
- **Integration:** in-memory SQLite + mock backend; 8 сценариев из таблицы T1-T10.
- **3-machine:** typecheck + tests + migration up/down на mac-14-arm,
  windows-2022, ubuntu-22.
- **RBAC isolation:** WT-16 isolation suite добавляет dedup-cross-tenant case
  (lookup hash из tenant B из контекста tenant A → MISS).
- **Performance:** bench `dedup.upload` cold/hot — hot path < 1ms для buf 1KB.

## 9. Definition of Done

- [ ] Tests-first commit precedes impl (gate enforced).
- [ ] `bun run typecheck` exit 0.
- [ ] `bun run lint` exit 0.
- [ ] `bun test tests/unit/storage/dedup/` exit 0 (≥ 10 tests).
- [ ] `bun test tests/integration/storage/dedup/` exit 0 (≥ 8 scenarios).
- [ ] Migration 0010 up/down проходят в `verify_migrations.test.ts`.
- [ ] Bundle size: main process delta ≤ 60 KB.
- [ ] Audit events `blob.dereferenced` / `blob.physically_deleted` зафиксированы fixture-тестом.
- [ ] Feature flag OFF: zero записей в `content_blobs`/`content_refs` (spied).
- [ ] Linear PZD-122 sub-issues "Ready for Merge" с evidence.

## 10. Open questions

- (O-1) GC grace window per-tier (Free 24h / Pro 6h / Team 1h)? — согласовать
  с продактом, см. master Q26.
- (O-2) Хешировать ли уже зашифрованный (E2EE) контент или plain? — отложено
  до WT-44; пока plain.
- (O-3) Включать ли BLAKE3 для buffer'ов > 4MB сразу или только под env-флагом?
  Решение: по умолчанию OFF, env `ROX_DEDUP_FAST_HASH=1`.
