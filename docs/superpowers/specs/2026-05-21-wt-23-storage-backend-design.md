# WT-23 — Object Storage Backend (R2 / S3 / local-fs abstraction)

- **Дата:** 2026-05-21
- **Статус:** Spec — draft
- **Branch:** `feat/storage-backend`
- **Base SHA:** `fac6f228069c`
- **Wave:** 1
- **Priority:** P0 (foundation для WT-24, WT-25, WT-26, WT-27, WT-32, WT-35)
- **Epic:** PZD-122 (E11 Workspaces & Drive)
- **Featurebase board:** Compounding
- **Depends on:** WT-04 (user-identity contract), WT-06 (workspace-team contract)
- **Blocks:** WT-24, WT-25, WT-26, WT-27, WT-32, WT-35

---

## 1. Цель и обоснование

ROX.ONE drive — multi-tenant object storage. v1 backend должен поддерживать три профиля:

1. **Cloudflare R2** (production default, S3-compatible API, нулевой egress).
2. **AWS S3 / S3-compatible** (enterprise on-prem MinIO / Backblaze B2 / Wasabi).
3. **local-fs** (dev profile + Linux electron sandbox + integration tests).

Существующий `packages/server-core/src/storage/object-storage.ts` содержит начальный набор
типов (Put/Get/List/Delete inputs, ObjectStorageObject, quota constants) — WT-23 **расширяет**
этот файл без breaking changes: добавляет `ObjectStore` interface, adapter implementations,
per-tenant prefix isolation, метаданные, ACL примитивы. Существующий contract сохраняется
обратно-совместимым; legacy callers продолжают работать.

**Главные продуктовые принципы:**

- **Tenant isolation by prefix.** Каждый объект — `tenants/<tenantId>/<workspaceId>/<...>`.
  Любая операция вне tenant prefix → reject (с audit emit).
- **Идemmpotent puts.** putObject с тем же key + same content-hash = no-op (важно для WT-25 dedup).
- **Metadata first-class.** Custom metadata всегда string→string, ≤ 8 keys, ≤ 256 bytes per key.
- **Adapter-agnostic.** Бизнес-код NEVER импортирует AWS-SDK напрямую.

---

## 2. Scope (in)

```
packages/shared/src/storage/
├── object-store.ts                       # ObjectStore interface (new, owned)
├── object-store.test.ts                  # contract tests (применяются к каждому adapter)
├── tenant-prefix.ts                      # buildTenantPrefix(tenantId, workspaceId?) + isolation guard
├── tenant-prefix.test.ts
├── adapters/
│   ├── r2-adapter.ts                     # Cloudflare R2 binding (Workers) + REST fallback
│   ├── r2-adapter.test.ts
│   ├── s3-adapter.ts                     # @aws-sdk/client-s3 wrapper
│   ├── s3-adapter.test.ts
│   ├── local-fs-adapter.ts               # node:fs based, dev/test only
│   └── local-fs-adapter.test.ts
├── acl.ts                                # putAcl / getAcl primitives (public-read | private | tenant-only)
├── acl.test.ts
└── index.ts
```

**Existing file extension:** `packages/server-core/src/storage/object-storage.ts` дополняется
re-export строкой `export * from '@rox-agent/shared/storage'` — обратная совместимость для
existing callers.

---

## 3. Out of scope (defer)

- Encryption-at-rest key management (отдельный WT в Wave 2 если потребуется per-tenant KMS).
- Object versioning (WT-27 owns versioning + soft-delete).
- Lifecycle rules / archive tiers (defer, Cloudflare R2 / S3 native API когда нужно).
- Multipart upload / resumable upload UI (WT-32 evidence-store покрывает large files).
- CDN signing (signed-URL — да в этом WT; CDN config — defer).
- Quota enforcement (**WT-24 territory**, этот WT только expose usage stats).

---

## 4. ObjectStore interface

```typescript
// packages/shared/src/storage/object-store.ts
export type AclMode = 'private' | 'tenant-only' | 'public-read';

export interface TenantScope {
  tenantId: string;
  workspaceId?: string;
}

export interface PutObjectInput {
  scope: TenantScope;
  key: string;                              // relative to tenant prefix, no leading `/`
  body: Uint8Array | ReadableStream<Uint8Array>;
  contentType?: string;
  metadata?: Record<string, string>;
  contentHashSha256?: string;               // для WT-25 dedup
  acl?: AclMode;                            // default 'tenant-only'
  idempotencyKey?: string;
}

export interface GetObjectInput {
  scope: TenantScope;
  key: string;
}

export interface DeleteObjectInput {
  scope: TenantScope;
  key: string;
}

export interface ListObjectsInput {
  scope: TenantScope;
  prefix?: string;
  pageToken?: string;
  pageSize?: number;                        // default 100, max 1000
}

export interface ObjectMetadata {
  key: string;
  sizeBytes: number;
  contentType?: string;
  metadata: Record<string, string>;
  contentHashSha256?: string;
  acl: AclMode;
  updatedAt: string;                        // ISO8601
}

export interface PutObjectResult {
  ok: boolean;
  metadata: ObjectMetadata;
  deduplicated: boolean;                    // true если идентичный объект уже был
}

export interface ListObjectsResult {
  entries: ObjectMetadata[];
  nextPageToken?: string;
}

export interface ObjectStore {
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  getObject(input: GetObjectInput): Promise<{ body: Uint8Array; metadata: ObjectMetadata }>;
  deleteObject(input: DeleteObjectInput): Promise<{ ok: boolean }>;
  listObjects(input: ListObjectsInput): Promise<ListObjectsResult>;
  getMetadata(input: GetObjectInput): Promise<ObjectMetadata>;
  putAcl(input: GetObjectInput & { acl: AclMode }): Promise<{ ok: boolean }>;
  getSignedUrl(input: GetObjectInput & { ttlSeconds: number }): Promise<{ url: string; expiresAt: string }>;
}
```

**Tenant prefix guard.** Adapters внутренне вызывают `buildTenantPrefix(scope)` → `tenants/<tenantId>[/<workspaceId>]/`,
все key resolve через `joinSafe(prefix, key)` который throws при попытках path-traversal (`..`,
absolute paths, null-bytes).

---

## 5. Acceptance Criteria

| # | AC | Verification |
|---|---|---|
| AC1 | Один и тот же contract-test passes на all 3 adapters (R2 mock, S3 mock, local-fs) | parametrized test suite |
| AC2 | `putObject({scope, key: '../../escape'})` throws `TenantPrefixError` без I/O | tenant-isolation test |
| AC3 | `putObject` с тем же `contentHashSha256` второй раз возвращает `deduplicated: true` без новой записи | idempotency test |
| AC4 | `listObjects({scope})` возвращает только объекты в tenant prefix; нет cross-tenant leak | isolation test (2 tenants) |
| AC5 | `getSignedUrl` URL содержит TTL, expires через `ttlSeconds` точно, signed корректно | signed-url test |
| AC6 | `putAcl({acl: 'public-read'})` на R2 adapter делает correct Cloudflare API call | adapter integration test |
| AC7 | Feature flag `rox.feature.drive.v1` default OFF → adapter throws `FeatureDisabledError` | flag-off test |
| AC8 | Audit event emit на каждый put/delete/putAcl через WT-08 contract | audit-emit test |
| AC9 | metadata limits: >8 keys или >256 bytes/key → `MetadataLimitError`, no I/O | metadata-limit test |
| AC10 | local-fs adapter не работает в production profile (NODE_ENV=production) → throws | profile-guard test |

---

## 6. TDD план

1. **T1 — object-store.contract.test.ts:** parametrized suite, runs against все 3 adapters.
2. **T2 — tenant-prefix.test.ts:** path-traversal, null-byte, absolute path rejection.
3. **T3 — r2-adapter.test.ts:** Cloudflare R2 binding mock + REST fallback.
4. **T4 — s3-adapter.test.ts:** mock @aws-sdk, assert correct API calls.
5. **T5 — local-fs-adapter.test.ts:** tmpdir-based, prod-profile guard.
6. **T6 — idempotency.test.ts:** putObject same hash → deduplicated.
7. **T7 — isolation.test.ts:** 2 tenants, list/get must not leak.
8. **T8 — signed-url.test.ts:** TTL accuracy + signature correctness.
9. **T9 — audit-emit.test.ts:** spy WT-08 emit on every mutation.
10. **T10 — feature-flag.test.ts:** OFF путь throws FeatureDisabledError.

---

## 7. Файловый allowlist

```yaml
files_allowed:
  - packages/shared/src/storage/**
  - packages/server-core/src/storage/object-storage.ts   # extend re-export only
  - packages/server-core/src/storage/__tests__/**
  - tests/unit/storage/**
  - tests/integration/storage/**
files_forbidden:
  - package.json
  - tsconfig*.json
  - packages/shared/src/audit/**                # WT-08 territory
  - packages/shared/src/feature-flags/**        # WT-07 territory
  - packages/design-storage/**                  # ROX Design domain
```

Scaffold-request к WT-00:
- Добавить `@aws-sdk/client-s3` опциональную dep (peerOptional или separate package для server-core).
- Добавить runtime check `NODE_ENV !== 'production'` для local-fs adapter.

---

## 8. Inspiration repos

| # | URL | Integration | Rationale |
|---|---|---|---|
| 1 | https://github.com/cloudflare/workers-sdk (R2 examples) | reference_only | R2 binding patterns для Workers + REST API. |
| 2 | https://github.com/aws/aws-sdk-js-v3/tree/main/clients/client-s3 | reference_only | Canonical S3 API surface. |
| 3 | https://github.com/minio/minio-js | reference_only | S3-compatible adapter testing. |
| 4 | https://github.com/feathersjs-ecosystem/feathers-blob | concept | Multi-backend abstraction taste. |
| 5 | https://github.com/garage-team/garage | reference_only | Self-hosted S3 alternative для on-prem option. |

---

## 9. Verification & 3-machine

- **mac-14-arm:** unit tests + local-fs integration (tmpdir) + S3 mock.
- **windows-2022:** unit tests + local-fs (Windows path separators) + S3 mock.
- **ubuntu-22:** unit tests + local-fs + S3 mock + `bunx wrangler dev --dry-run` (R2 binding sanity).

Screenshots: none (no UI).
Smoke: contract-test suite passes на каждой machine.

---

## 10. Linear/Featurebase sync

- **Linear parent:** PZD-122. Sub-issues: discovery / design / contract / r2-adapter / s3-adapter / local-fs / verify.
- **Featurebase board:** Compounding. Post alias: `wt-23-storage-backend`.

---

## 11. Definition of Done

- [ ] TDD-first 10 failing tests committed
- [ ] All tests pass на 3 adapters (parametrized)
- [ ] typecheck / lint green
- [ ] Tenant isolation тесты pass (включая path-traversal)
- [ ] Audit emit tests pass
- [ ] Feature flag default OFF verified
- [ ] No `any` types (CLAUDE.md `code_quality`)
- [ ] Existing `packages/server-core/src/storage/object-storage.ts` callers не сломаны (re-export check)
- [ ] 3-machine evidence files attached
- [ ] Linear Done, FB Shipped

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** N/A
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** ObjectStore
- **Events emitted (WT-49 ActivityEvent):** object.uploaded, object.deleted
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** data, security
