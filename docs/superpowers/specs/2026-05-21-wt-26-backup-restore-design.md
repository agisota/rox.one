# WT-26 — Backup + restore + numbering rules — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for implementation (TDD-first)
**Ветка:** `feat/backup-restore`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-26-backup-restore/`
**Wave:** 2
**Priority:** P0
**Depends on:** WT-23 (storage backend), WT-25 (dedup engine — backup-ы переиспользуют content-blob pointer-граф)
**Blocks:** WT-27 (soft-delete + versioning переиспользуют numbering chain)
**Parent epic:** PZD-122 (E10 — Drive / Storage)
**FB board:** Bugs, Fixes, Improvements (`6a0db0b911b1b8507c8e8165`)
**Feature flag:** `rox.feature.drive.backup` (default OFF, release cut "Storage")

---

## 1. Контекст

ROX.ONE multi-tenant storage (WT-23) сейчас не имеет автоматических бэкапов и
audit-friendly монотонной нумерации операций. Без этого невозможно: (а)
восстановить tenant после accidental wipe, (б) доказать в audit-логе, что
никакая запись не пропала между точками, (в) гарантировать R.11 chain-of-custody
для enterprise customers.

WT-26 вводит **per-tenant monotonic sequence number** (audit chain) и
**scheduler-based backup jobs** (daily + weekly snapshots). Restore работает в
**двухфазном режиме**: dry-run (план + diff) → apply (с rollback-checkpoint).
Inspiration: `tursodatabase/agentfs` (snapshot-based storage),
`linear/linear-release` (release-feed monotonic numbering + idempotent
processing).

Numbering rules дают audit-chain эквивалент Merkle-цепочки: каждая запись в
`storage_ops` ссылается на `prev_seq` предыдущей операции в том же tenant.
Разрыв цепи (gap или fork) → integrity violation.

## 2. Цели и нецели

### 2.1 In scope

- `infra/backup/scheduler.ts` — cron orchestrator (daily 02:00 UTC,
  weekly Sun 03:00 UTC per region); state в `backup_jobs` table.
- `infra/backup/snapshot-worker.ts` — backup job runner: enumerate blobs,
  собрать manifest (hash list + ref-graph + numbering tip),
  записать в backup-store (S3-compatible).
- `infra/backup/restore.ts` — двухфазный restore: `plan(manifest)` →
  `RestorePlan` (diff against current state), `apply(plan, confirmToken)` →
  выполнить + checkpoint.
- `packages/shared/src/storage/numbering.ts` — `SequenceNumber` branded type,
  `nextSeq(tenantId, prevSeq)`, validator `verifyChain(ops)`.
- `packages/server-core/src/storage/storage-ops-log.ts` — append-only audit
  table `storage_ops(seq, tenant_id, op_type, target_hash, prev_seq, actor, ts)`.
- Migration `0011_storage_ops_log.up.sql` + `.down.sql`.
- CLI: `rox-one backup list|create|verify|restore --dry-run`.
- Tests: ≥ 25 unit + 10 integration (включая chaos test для concurrent backup).

### 2.2 Out of scope

- E2E encryption бэкапов → WT-44 (rolled into key-derivation stream).
- Cross-region replication → WT-43 spike (network mesh).
- UI поверх backup management → WT-37.
- Point-in-time recovery (PITR) с WAL-replay → отложено до v1.2.

### 2.3 Forbidden globs

- `packages/shared/src/storage/backend.ts` — WT-23.
- `packages/shared/src/storage/dedup.ts` — WT-25 (только READ, не модифицируем).
- `apps/electron/src/renderer/**` — никакого backup-UI в этом WT.
- `package.json`, `tsconfig*.json`, `bun.lock` — WT-00.

## 3. Архитектура

```
┌──────────────────────────────────────────────────────────────────┐
│  Numbering chain (per-tenant audit log)                          │
│    storage_ops:                                                  │
│      seq (PK, monotonic per tenant_id)                           │
│      tenant_id, op_type, target_hash, prev_seq, actor_id, ts     │
│    Invariant: ∀op . op.prev_seq = (op.seq - 1)                   │
│      → verifyChain() walks all ops, returns ChainBreak[]         │
├──────────────────────────────────────────────────────────────────┤
│  Backup scheduler (Cloudflare Worker cron)                       │
│    daily 02:00 UTC  → for each tenant: snapshot full manifest    │
│    weekly Sun 03:00 → archive + retention sweep (per-tier policy)│
│                                                                  │
│  Backup job lifecycle                                            │
│    pending → running → completed | failed                        │
│    state persisted in backup_jobs(job_id, tenant_id, kind,       │
│      started_at, finished_at, manifest_uri, seq_tip, status)     │
├──────────────────────────────────────────────────────────────────┤
│  Restore flow                                                    │
│    Phase 1: plan(manifest_uri)                                   │
│      → diff: hashes_to_add, hashes_to_remove, seq_tip_old/new    │
│      → returns RestorePlan { confirmToken, summary, risks }      │
│    Phase 2: apply(plan, confirmToken)                            │
│      → take checkpoint (snapshot current tip)                    │
│      → execute add/remove batches                                │
│      → on failure: rollback к checkpoint                         │
│      → audit "backup.restored" с from_seq / to_seq               │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1 Numbering rules (audit-chain invariants)

1. **Монотонность:** для любого tenant `seq` строго возрастает на 1.
2. **Anchor:** первая операция tenant'а — `prev_seq = NULL`, всегда seq=1.
3. **No gaps:** `verifyChain` пробегает все ops в порядке `seq`, ловит gap →
   возвращает `ChainBreak { kind: 'gap', expected, actual }`.
4. **No forks:** `(tenant_id, seq)` unique; `(tenant_id, prev_seq)` unique
   (только одна операция может ссылаться на конкретный prev).
5. **Idempotency:** backup job в running-state не запускается повторно; restore
   `apply` требует matching `confirmToken` (UUID v7, TTL=10min).

### 3.2 Per-tier retention (defaults — confirm с продактом)

| Tier | Daily snapshots | Weekly snapshots | Total retention |
|---|---|---|---|
| Free | 7 | 0 | 7 дней |
| Pro | 14 | 4 | 30 дней |
| Team | 30 | 12 | 90 дней |
| Enterprise | 90 | 26 | 180 дней |

### 3.3 Ключевые файлы (files_allowed)

- `infra/backup/scheduler.ts`
- `infra/backup/snapshot-worker.ts`
- `infra/backup/restore.ts`
- `infra/backup/cli.ts` (rox-one backup CLI)
- `infra/backup/manifest.ts` (manifest schema, zod)
- `infra/backup/types.ts`
- `packages/shared/src/storage/numbering.ts`
- `packages/shared/src/storage/numbering-types.ts`
- `packages/server-core/src/storage/storage-ops-log.ts`
- `packages/server-core/src/storage/migrations/0011_storage_ops_log.up.sql`
- `packages/server-core/src/storage/migrations/0011_storage_ops_log.down.sql`
- `tests/unit/storage/backup/**`
- `tests/integration/storage/backup/**`

## 4. TDD план (≥ 5 tests-first)

| # | Test name | What it asserts |
|---|---|---|
| T1 | `numbering: first op gets seq=1 with prev_seq=null` | Свежий tenant, первый INSERT → seq=1, prev_seq=NULL. |
| T2 | `numbering: next op increments seq and references prev` | `nextSeq` возвращает `seq=N+1, prev_seq=N`; unique constraint. |
| T3 | `numbering: verifyChain catches gap` | Удаляем op seq=5 → `verifyChain` returns `ChainBreak{kind:'gap', expected:5}`. |
| T4 | `numbering: verifyChain catches fork` | Two ops с same `prev_seq` → unique constraint throws; verifyChain reports fork. |
| T5 | `backup scheduler: daily cron fires snapshot per tenant` | Mock clock 02:00 UTC → snapshot-worker invoked для каждого active tenant. |
| T6 | `backup scheduler: skips tenants with running job` | Tenant с `backup_jobs.status='running'` → no duplicate spawn. |
| T7 | `backup retention: enforces per-tier policy` | Free tier с 8 daily snapshots → oldest pruned; Pro retains 14. |
| T8 | `restore: dry-run produces RestorePlan without mutation` | Plan returns diff; DB state без изменений; assertion via spy. |
| T9 | `restore: apply requires valid confirmToken` | Wrong token → reject `INVALID_CONFIRM_TOKEN`; right token → apply. |
| T10 | `restore: rollback on apply failure` | Inject failure mid-restore → checkpoint восстанавливается; `verifyChain` зелёный после rollback. |
| T11 | `concurrent uploads preserve numbering invariants` | 100 parallel uploads → no gap, no fork, monotonic seq. |
| T12 | `feature flag OFF: no scheduler invocations` | `rox.feature.drive.backup=false` → cron noop; zero backup_jobs rows. |

Tests-first commit `test(storage/backup): failing tests for backup + numbering`.

## 5. Acceptance Criteria (≥ 5)

1. **AC-1:** Daily snapshot job выполняется без блокировки upload-path
   (concurrent writes продолжают работать, snapshot фиксирует tip seq на
   старте, eventual consistency через WAL).
2. **AC-2:** `verifyChain(tenantId)` детектирует gap, fork, missing-anchor
   с конкретным `ChainBreak[]`; integration test покрывает 3 случая.
3. **AC-3:** Restore — двухфазный. `plan()` всегда side-effect-free, `apply()`
   идемпотентен при retry с тем же `confirmToken`.
4. **AC-4:** Retention enforced per-tier; pruned snapshot пишет audit-event
   `backup.snapshot_pruned` с `retention_policy_name`.
5. **AC-5:** Backup manifest содержит SHA-256 hash самого manifest'а (root
   hash), что позволяет downstream verifier проверить integrity без
   reading всех blob'ов.
6. **AC-6:** Feature flag `rox.feature.drive.backup=false` → scheduler не
   зарегистрирован, никаких записей в `backup_jobs`.
7. **AC-7:** Numbering chain экспортируется в audit `@rox-one/audit` (WT-08)
   на каждую mutating operation (upload/delete/restore), `event=storage.op`.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Numbering bottleneck при high-write tenant | Per-tenant advisory lock + batch numbering (allocate seq в blocks по 1000). |
| Restore разрушает текущее состояние при ошибке | Mandatory checkpoint + transactional apply; rollback test T10. |
| Backup storage растёт unbounded | Per-tier retention + GC; metric `backup_store_bytes_total` + alert. |
| Race: backup fires while migration активна | Scheduler читает `tenant_lock_state`; skip + reschedule через 1h. |
| Manifest poisoning (malicious upload bypasses chain) | Manifest подписывается main-process key (см. WT-44 backlog); сейчас — HMAC через `ROX_BACKUP_SIGNING_KEY` env. |

## 7. Inspiration repos

1. `tursodatabase/agentfs` — snapshot-based agent filesystem (Apache-2.0). `reference_only` — primary inspiration для manifest schema + restore двухфазности.
2. `linear/linear-release` — release-feed monotonic numbering, MIT. `reference_only` — pattern для `(tenant, seq)` ordering + idempotent processing.
3. `restic/restic` — content-defined chunking + manifest verification (BSD-2). `reference_only` — root-hash проверка manifest'а.
4. `borgbackup/borg` — deduplicating backup (BSD). `reference_only` — retention policy DSL.
5. `wal-g/wal-g` — point-in-time backup, BSD. `reference_only` — pattern для backup-job lifecycle и scheduler resilience.

## 8. Verification protocol

- **Unit:** `bun test tests/unit/storage/backup/` — ≥ 25 tests.
- **Integration:** ephemeral S3 (minio) + SQLite — full snapshot → restore → verifyChain cycle.
- **3-machine:** scheduler тестируется через fake-timers; restore CLI smoke на всех 3 OS.
- **Chaos test:** kill snapshot-worker mid-job → next cron picks up clean restart (no half-written manifest).
- **Audit:** все mutating ops emit `storage.op` event; spy fixture verifies fields.

## 9. Definition of Done

- [ ] Tests-first commit precedes impl.
- [ ] `bun run typecheck` exit 0.
- [ ] `bun run lint` exit 0.
- [ ] `bun test tests/unit/storage/backup/` exit 0 (≥ 25 tests).
- [ ] `bun test tests/integration/storage/backup/` exit 0 (≥ 10 scenarios).
- [ ] Migration 0011 up/down проходят.
- [ ] CLI `rox-one backup` documented в `docs/cli.md`.
- [ ] Audit events emit verified.
- [ ] Feature flag OFF: zero scheduler invocations.
- [ ] Linear PZD-122 sub-issues "Ready for Merge".

## 10. Open questions

- (O-1) Retention defaults (Free 7d / Pro 30d / Team 90d) — final согласован
  с продактом? См. master Q26.
- (O-2) Backup storage location — same region as tenant data или DR-region
  cross-region replication? Кандидат на WT-43 spike.
- (O-3) Manifest signing — symmetric HMAC (сейчас) или asymmetric (Ed25519,
  WT-44)? Решение: HMAC до WT-44, потом миграция.
