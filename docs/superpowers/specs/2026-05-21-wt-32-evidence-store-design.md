# WT-32 — Evidence / artifact store — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for Phase 1 (Discovery)
**Branch:** `feat/evidence-store`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-32-evidence-store/`
**Wave:** 2 (Agent Fabric / Artifacts)
**Priority:** P0
**Depends on:** WT-23 (Storage backend), WT-28 (Coordinator agent)
**Blocks:** WT-34 (Agent Run UI — artifact panel)
**Parent epic:** PZD-117 (E06 — Artifacts)
**FB board:** Frictionless UX
**Feature flag:** `rox.feature.evidence-store.v1` (default OFF, release cut "Agent Fabric")

---

## 1. Контекст и цель

Per-task evidence сейчас разбросан: screenshots в `evidence/wt-XX/...` файловой
системы CI runner-а, logs в DO storage, output diffs — inline в DAG run JSON,
input snapshots — нигде. Это блокирует аудит, повторяемость и UI artifact-panel
(WT-34).

**Цель WT-32** — единый content-addressable evidence store. Каждый артефакт —
бинарный blob с SHA-256 hash в качестве ID; метадата (тип, MIME, runId, taskId,
размер, tenantId) — в отдельной index таблице. Backend — **Cloudflare R2** для
blobs, **DO SQLite** для index. Авторизация и аудит — на каждом read/write.

Артефакты на task:
- `input_snapshot` — JSON слепок input config + prompt.
- `output_diff` — unified diff (file-system mutations) или JSON patch.
- `screenshot` — PNG screenshot UI после выполнения.
- `log` — stdout/stderr (text/plain, gzip).
- `cost_ledger` — JSON breakdown by model+tokens.

После merge — флаг OFF. Release cut "Agent Fabric" включает write путь;
release cut "UI" (WT-34) включает read путь в renderer.

## 2. Скоуп

### 2.1 Входит

- `packages/shared/src/evidence/artifact-id.ts` — `ArtifactId` branded type
  + `hashContent(buffer)` + `parseArtifactId(s)` (формат
  `art_sha256_<64-hex>`).
- `packages/shared/src/evidence/store.ts` — `EvidenceStore` interface:
  `put(metadata, body) → ArtifactId`, `get(id) → { metadata, body }`,
  `head(id) → metadata`, `list(filter) → ArtifactMetadata[]`,
  `delete(id) → void` (soft, через `deletedAt`).
- `packages/shared/src/evidence/metadata.ts` — zod-схема `ArtifactMetadata`:
  `id, type, mimeType, runId, taskId, tenantId, sizeBytes, hash, createdAt,
  createdBy, deletedAt, tags`.
- `packages/shared/src/evidence/r2-adapter.ts` — R2 backend impl
  (`R2EvidenceStore implements EvidenceStore`).
- `packages/shared/src/evidence/sqlite-index.ts` — DO SQLite index
  (`ArtifactIndex` adapter: `insert`, `lookup`, `listByRun`, `softDelete`).
- `packages/shared/src/evidence/audit.ts` — wraps store calls с audit emit
  через WT-08 sink (`evidence.put`, `evidence.get`, `evidence.list`,
  `evidence.delete`).
- `packages/shared/src/evidence/index.ts` — re-export public API.
- `infra/cloudflare/evidence-api.worker.ts` — HTTP endpoint
  (PUT/GET/HEAD/DELETE `/api/evidence/:id`) с auth + tenant scoping.
- `infra/cloudflare/wrangler.evidence.toml` — R2 binding + DO binding.
- `tests/unit/evidence/**/*.test.ts`
- `tests/integration/evidence/**/*.test.ts` — miniflare R2 emulator.
- `wt-meta/wt-32.yaml`.

### 2.2 Вне скоупа

- UI artifact viewer — WT-34.
- Generic file manager (WT-23 уже владеет user-facing storage paths).
- Backup / quota — WT-24, WT-26 (consumer этого store).
- Source registry / MCP — WT-38.

### 2.3 Forbidden globs

- `packages/shared/src/storage/**` (WT-23 owner). Этот WT использует
  storage backend через published interface, не редактирует.
- `apps/electron/src/renderer/components/**` (WT-34 owner).
- `packages/shared/src/audit/**` (WT-08 owner — read-only consume).
- `package.json`, `tsconfig*.json`, `bun.lock` (WT-00).

## 3. Архитектура

```
┌─────────────────────────────────────────────────────────────────────────┐
│  WT-28 Coordinator / WT-29 DAG runner — generate evidence               │
│         │                                                               │
│         ▼ EvidenceStore.put(meta, body)                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  evidence/store.ts                                               │   │
│  │    ├─ hashContent(body) → sha256 hex → ArtifactId                │   │
│  │    ├─ checkTenantQuota (WT-24 interface)                         │   │
│  │    ├─ r2-adapter.put(`tenant/${tid}/${id}`, body)                │   │
│  │    ├─ sqlite-index.insert(metadata)                              │   │
│  │    └─ audit-emit('evidence.put', {id, runId, taskId, tenantId})  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  WT-34 UI / API consumer:                                               │
│         │ HTTP GET /api/evidence/:id (with bearer)                      │
│         ▼                                                               │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  evidence-api.worker.ts                                          │   │
│  │    ├─ verifyAuth (WT-10) → tenantScope                           │   │
│  │    ├─ sqlite-index.lookup(id) → metadata                         │   │
│  │    ├─ assertTenantOwns(metadata, tenantScope) — cross-tenant 403 │   │
│  │    ├─ r2-adapter.get(...)                                        │   │
│  │    └─ audit-emit('evidence.get', ...)                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 `ArtifactMetadata` schema

```ts
export const ArtifactType = z.enum([
  'input_snapshot',
  'output_diff',
  'screenshot',
  'log',
  'cost_ledger',
  'custom',
]);

export const ArtifactMetadata = z.object({
  id:           z.string().regex(/^art_sha256_[0-9a-f]{64}$/),
  type:         ArtifactType,
  mimeType:     z.string().min(1).max(120),
  runId:        z.string().uuid(),
  taskId:       z.string().uuid(),
  tenantId:     z.string().uuid(),
  sizeBytes:    z.number().int().nonnegative(),
  hash:         z.string().regex(/^[0-9a-f]{64}$/),
  createdAt:    z.string().datetime(),
  createdBy:    z.string().uuid(),  // userId or service principal
  deletedAt:    z.string().datetime().nullable().default(null),
  tags:         z.record(z.string()).default({}),
});
```

### 3.2 Content addressing

- `ArtifactId = 'art_sha256_' + sha256(body).hex()` — deterministic;
  повторный put той же payload → возвращает существующий id (idempotent).
- Запись в R2 ключом `tenant/{tenantId}/{artifactId}` — cross-tenant
  изоляция на уровне ключа.
- SQLite index unique constraint на `(tenantId, id)` — гарантирует
  no-cross-tenant-leak даже при коллизии hash (теоретическая, но guarded).

### 3.3 Soft-delete

- `delete(id)` ставит `deletedAt=now()` в SQLite. R2 blob НЕ удаляется
  немедленно (cost-effective).
- Periodic job (WT-26 backup pipeline) удаляет R2 blobs с `deletedAt >
  90 дней`.

### 3.4 Audit emit на каждый доступ

Все операции (`put/get/head/list/delete`) emit-ят audit event с:
- `actor` (userId / service principal),
- `op` (put/get/head/list/delete),
- `artifactId`, `tenantId`, `runId`, `taskId`,
- `result` (ok / denied / not_found),
- `reason` (если denied).

Это требование compliance: каждый read evidence файла — audit trail.

### 3.5 Ключевые файлы (files_allowed)

- `packages/shared/src/evidence/**`
- `infra/cloudflare/evidence-api.worker.ts`
- `infra/cloudflare/wrangler.evidence.toml`
- `tests/unit/evidence/**`
- `tests/integration/evidence/**`

### 3.6 Scaffold-extension requests

- WT-00: `@cloudflare/workers-types@^4.20260501` (R2 typing — shared с WT-30/31).
- WT-00: `mime-types@^2.1.35` (MIME mapping helper).

## 4. TDD план (≥ 5)

| # | Test | Что проверяет |
|---|---|---|
| T1 | `put computes deterministic ArtifactId from body hash` | Same buffer → same id; different buffer → different id. |
| T2 | `idempotent put returns existing id without re-write` | Put body B → id X; put B again → id X, R2 `put` spy called once. |
| T3 | `get respects tenant scope (cross-tenant 403)` | Tenant A puts art X; tenant B `get(X)` → `Result.err({ code: 'NOT_FOUND' })` (not_found != denied для info-leak prevention). |
| T4 | `soft-delete hides from list` | put + delete + list → `deletedAt IS NULL` фильтрует, метадата сохранена. |
| T5 | `audit emit on every op (put/get/head/list/delete)` | spy на audit sink → 5 ops → 5 audit events с правильным `op` field. |
| T6 | `quota check before put rejects when over limit` | mock WT-24 quota → over → `Result.err({ code: 'QUOTA_EXCEEDED' })`, no R2 write. |
| T7 | `metadata schema validation rejects invalid mime` | put с mimeType `'evil'.repeat(100)` → zod error, no R2 write. |
| T8 | `listByRun returns chronologically sorted` | put 5 артефактов в разное время → list по `createdAt asc`. |
| T9 | `feature flag OFF: store is no-op stub` | флаг false → `put` возвращает `Result.ok(null_artifact_id)`, zero R2/SQLite calls. |

Все commit-ятся первым коммитом
`test(evidence): failing tests for content-addressed store`.

## 5. Acceptance Criteria (≥ 5)

- [ ] **AC-1:** `ArtifactId` format `art_sha256_<64-hex>` и deterministic
      hash function (RFC 6234 SHA-256).
- [ ] **AC-2:** R2 key layout `tenant/{tenantId}/{artifactId}` — cross-tenant
      isolation verified интеграционно (put из A, get из B → not_found).
- [ ] **AC-3:** SQLite index содержит unique `(tenantId, id)` constraint;
      list по `runId` использует index (EXPLAIN QUERY PLAN passes).
- [ ] **AC-4:** Soft-delete не удаляет R2 blob — только flag в index;
      reaper job (отложен на WT-26) разрешён по контракту.
- [ ] **AC-5:** Audit event на каждом read/write содержит `actor`, `op`,
      `artifactId`, `tenantId`, `runId`, `taskId`, `result` (`ok|denied|not_found`),
      `reason?`.
- [ ] **AC-6:** Idempotent `put` возвращает existing id без R2 PUT call
      при `If-Not-Exists` semantics.
- [ ] **AC-7:** Bundle `evidence-api.worker.ts` ≤ 200 KB deflated.
- [ ] **AC-8:** При `rox.feature.evidence-store.v1=false` store — no-op
      stub: вызовы возвращают success без побочных эффектов и без audit emit
      (избежать audit noise на disabled feature).

## 6. Risks

| Risk | Mitigation |
|---|---|
| Hash collision (теоретическая) | Unique `(tenantId, id)`, на коллизии возвращаем conflict ошибку с `reason='HASH_COLLISION'`. |
| R2 cost при miss + retry | LRU cache metadata в memory (DO state), TTL=5min. |
| Quota race condition (parallel puts превышают limit) | WT-24 quota check + post-put reconcile job (consistency eventual). |
| Audit emit storm (large list) | List op emit-ит один event `evidence.list` с `count`, не per-item. |
| Soft-delete без reaper утечёт R2 cost | WT-26 backup pipeline владеет reaper; documented dependency. |

## 7. Inspiration repos

| Repo | Integration type | Зачем |
|---|---|---|
| `git/git` | reference_only | Content-addressable storage (object database) — canonical pattern для hash-as-id. |
| `ipfs/go-ipfs` (Kubo) | reference_only | CID + content addressing + dedup — переносится на R2. |
| `cloudflare/r2-typescript-example` | reference_only | R2 binding patterns + multipart upload. |
| `tus/tus-resumable-upload-protocol` | reference_only | Resumable PUT для больших screenshots (defer to Phase 5). |
| `webdav-handler/webdav-handler` | reference_only | Authorization scoping + metadata-vs-blob split design. |

## 8. Phase 5 swarm distribution

| Phase | Роли | Модель |
|---|---|---|
| Discovery | brainstormer, requirements-keeper, scope-analyzer, critic | opus-4.7-max |
| Design | prompt-writer, architect | opus-4.7-max |
| Impl tests | test-writer | opus-4.7-max |
| Impl code | implementer, super-coder | sonnet-4.6-medium |
| Impl review | reviewer | opus-4.7-max |
| Verification | verifier, critic, integrator | opus-4.7-max |
| Optimization | optimizer, 10x-improver | opus-4.7-max |

UX-guru не задействован (no user-visible UI; WT-34 владеет UI).

## 9. Связи

- **Зависит от:** WT-23 (storage abstraction baseline), WT-28 (coordinator —
  producer of evidence), WT-08 (audit sink), WT-24 (quota interface),
  WT-10 (auth for API worker).
- **Блокирует:** WT-34 (UI artifact panel читает через store API),
  WT-26 (backup pipeline владеет reaper для soft-deleted blobs).

## 10. Verification protocol

- **Unit:** Vitest + zod + hash crypto + LRU = 9 tests above.
- **Integration:** miniflare R2 + DO emulator — put/get/list/delete полный
  цикл + cross-tenant rejects + idempotency + audit emit.
- **3-machine:** typecheck + unit + integration зелёный на mac/win/linux
  (workers code platform-agnostic). Нет UI smoke.
- **Security (Phase 5):** OWASP-asset-control checklist —
  IDOR (cross-tenant), path traversal в `tenant/{tid}/{id}` key, signed-URL
  abuse — все mitigations подтверждены fixture tests.

## 11. Open questions

- (O-1) Signed-URL для UI download — issue через worker fetch endpoint или
  direct R2 presigned (CF requires Account API Token, не Worker binding)?
- (O-2) Maximum artifact size — 10 MB default, 100 MB для Pro/Team tier?
  Согласовать с WT-24.
- (O-3) `cost_ledger` artifact формат — JSON одно-runId aggregate или per-task
  records? (Согласовать с WT-29.)
- (O-4) Audit event для disabled feature flag — emit или suppress? Текущий
  спек — suppress (избегаем noise), но open для compliance review.
