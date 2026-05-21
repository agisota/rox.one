# WT-08 — AuditEvent + TelemetryEvent + observability baseline

**Дата:** 2026-05-21
**Статус:** Design — готов к Phase 1 (Discovery)
**Branch:** `feat/contract-audit-telemetry`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-08-audit-telemetry`
**Parent epic:** PZD-118 (E07 — Audit, Observability, Logging)
**Wave:** 0 (Foundation)
**Priority:** P0

---

## 1. Контекст и цель

Существующий audit-storage-backend spec (T218-T221) описывает append-only store
с hash-chain, sanitizer, query API. WT-08 фиксирует контракт + минимально
необходимый baseline: `AuditEvent`, `TelemetryEvent`, append-only store
interface (in-memory импл), payload-sanitizer, `logger.audit()` fanout.

**Цель:** WT-10..WT-39 могут эмитить audit события через единый API без своих
локальных store; telemetry — отдельный канал, redacted, без PII. После merge —
read-only для downstream.

WT-18 (Audit log query API) и WT-32 (Evidence store) — позже build'ят на этом
контракте.

## 2. Скоуп

### 2.1 Входит

- `packages/shared/src/audit/audit-event.ts` — zod `AuditEvent` + `AuditSeverity`
  enum + `EventType` taxonomy + canonical-fields hashing helper
- `packages/shared/src/audit/telemetry-event.ts` — zod `TelemetryEvent` +
  attribute schema + redaction helper for telemetry
- `packages/shared/src/audit/sanitizer.ts` — `sanitizePayload(obj)` (token /
  cookie / password / api-key / authorization key-based redaction +
  value-pattern detection for JWT-like / hex32+ / base64 40+ strings)
- `packages/shared/src/audit/logger.ts` — `logger.audit(eventType, payload,
  severity?)`, `logger.telemetry(source, event, attributes)` — single entry
  point; fanout через `AppendOnlyStore` + console/file
- `packages/server-core/src/audit/append-only-store.ts` — interface +
  `InMemoryAuditStore` impl + `verifyHashChain(store)` helper
- `packages/server-core/src/audit/redaction-rules.ts` — конфигурируемые правила
  (default rules + tenant-specific overrides hook)
- `packages/shared/src/audit/index.ts` — barrel
- `tests/unit/audit/audit-event.test.ts`,
  `tests/unit/audit/telemetry-event.test.ts`,
  `tests/unit/audit/sanitizer.test.ts`,
  `tests/unit/audit/append-only-store.test.ts`,
  `tests/unit/audit/logger.test.ts`
- `wt-meta/wt-08.yaml`

### 2.2 Вне скоупа

- Persistent backend (SQLite, ClickHouse) — WT-18
- Query API / pagination / search — WT-18
- Retention/rotation — WT-18
- Audit-harness probes (E07-S05..S10) — отдельный WT (зависит от WT-08)
- Evidence store binary attachments — WT-32
- Frontend log viewer — Wave 2

### 2.3 Forbidden globs

- `packages/shared/src/core/**`
- `packages/shared/src/feature-flags/**`
- `package.json`, `tsconfig*.json`, `bun.lock`

## 3. Модель данных

```ts
export const AuditSeverity = z.enum(['info', 'warn', 'error', 'critical']);

export const AuditEvent = z.object({
  event_id:    z.string().uuid(),       // UUID v7 — sortable
  ts:          z.string().datetime({ offset: false }),
  actor:       z.string().min(1),       // userId | 'system' | 'agent:<id>'
  tenant_id:   z.string().uuid().nullable(),
  workspace_id:z.string().uuid().nullable(),
  request_id:  z.string().min(1).nullable(),
  event_type:  z.string().regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_.]*$/),
                                         // "auth.login", "storage.write.ok"
  severity:    AuditSeverity,
  payload_json:z.string(),              // already sanitized JSON string
  prev_hash:   z.string().regex(/^[a-f0-9]{64}$/),
  hash:        z.string().regex(/^[a-f0-9]{64}$/),
});
export type AuditEvent = z.infer<typeof AuditEvent>;

export const TelemetryEvent = z.object({
  ts:         z.string().datetime({ offset: false }),
  source:     z.string().regex(/^[a-z][a-z0-9_-]*$/),
  event:      z.string().regex(/^[a-z][a-z0-9_.]*$/),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});
```

Hash-chain: `hash = SHA256(canonicalize({event_id, ts, actor, tenant_id,
workspace_id, request_id, event_type, severity, payload_json, prev_hash}))`.
Canonicalize — JSON с sorted keys, без whitespace.

Sanitizer rules:
- Key match (case-insensitive): `token`, `secret`, `password`, `cookie`,
  `authorization`, `api[_-]?key`, `bearer`, `refresh[_-]?token`, `access[_-]?token`
- Value match: JWT-like `^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$`,
  hex 32+, base64 40+ (lowercase-flag, strict charset)
- Recursive deep-clone; arrays + nested objects + circular ref guard
- Replacement: `'[REDACTED]'`

Telemetry — те же rules, плюс **никакого PII**: email/phone/full-name keys
блокируются полностью (drop attribute, log warn).

## 4. Архитектурные решения

- **A08-01 — Hash-chain — SHA-256.** Достаточно для tamper-evidence без
  cryptographic signing. Genesis event: `prev_hash = '0'.repeat(64)`.
- **A08-02 — Append-only contract — interface.** `InMemoryAuditStore` —
  default impl; persistent impls (SQLite, ClickHouse) — будут в WT-18.
  Никаких `update`/`delete` методов в interface.
- **A08-03 — Telemetry — отдельный store.** Не идёт через audit chain. Может
  быть batched, dropped, sampled — у audit'а такого права нет.
- **A08-04 — UUID v7.** Sortable timestamp prefix; helper
  `generateAuditEventId()` использует either node 22+ `crypto.randomUUID('v7')`
  fallback'нутый на manual impl для node <22.
- **A08-05 — event_type — closed taxonomy (но extendable).** Format
  `<domain>.<verb>[.<modifier>]`; allowed domains регистрируются в
  `EVENT_DOMAIN_REGISTRY`. Unknown domain — warn-level error (не throw, чтобы
  не сорвать downstream emit, но `verifyHashChain` пройдёт).
- **A08-06 — Sanitizer first, hash after.** payload_json уже sanitized
  до hashing; никаких raw secrets в hash inputs.

## 5. Acceptance criteria

- [ ] AC-1: `AuditEvent.parse(valid)` ok; missing `prev_hash` → error
- [ ] AC-2: `verifyHashChain(store)` returns `{ ok: true }` для valid chain
- [ ] AC-3: Tampered event (`payload_json` изменён после insert) → `verifyHashChain`
      returns `{ ok: false, brokenAt: <event_id> }`
- [ ] AC-4: `sanitizePayload({ password: 'x', api_key: 'y' })` returns both
      keys = `'[REDACTED]'`
- [ ] AC-5: `sanitizePayload({ token: 'eyJxxx.yyy.zzz' })` redacts; вложенный
      `{ data: { authorization: 'Bearer xxx' } }` тоже redacts
- [ ] AC-6: `sanitizePayload` recursive cycle (`a.b = a`) → no infinite loop
- [ ] AC-7: `logger.telemetry('renderer', 'click', { email: 'x@y.z' })` —
      `email` key dropped + warn-log
- [ ] AC-8: `InMemoryAuditStore.append(event)` validates schema before insert;
      invalid → throws + nothing inserted
- [ ] AC-9: `InMemoryAuditStore` does not expose update/delete methods (compile
      check)
- [ ] AC-10: `logger.audit('auth.login', { ok: true })` writes valid
      AuditEvent (с auto-filled event_id, ts, prev_hash из store tail)

## 6. Тестовый план (TDD-first)

1. **`audit-event.test.ts › hash-chain verification`** — append 3 events;
   `verifyHashChain` ok; tamper middle event → returns brokenAt that id.
2. **`sanitizer.test.ts › key + value redaction`** — table-test 30+ cases:
   keys (token, password, api_key, Authorization), value patterns (JWT, hex32,
   base64-40), nested objects, arrays of objects, cyclic refs.
3. **`telemetry-event.test.ts › no PII`** — попытка emit'нуть с email/phone/name
   keys → дропается + warn-log; tracked в `droppedTelemetryAttributes` counter.
4. **`append-only-store.test.ts › append-only contract`** —
   `InMemoryAuditStore` API имеет только `append`, `getAll`, `getByEventId`,
   `verifyChain` (no `update`, `delete`, `clear` для прод-кода — only `clear`
   в test helper отдельный namespace).
5. **`logger.test.ts › fanout`** — `logger.audit(...)` пишет в store +
   console + (опционально) file appender; mock console verified.

Дополнительно: genesis event prev_hash check, event_type taxonomy validator,
deep-clone correctness, perf (sanitizePayload ≤ 1ms на typical payload).

## 7. Inspiration repos

| Repo | Integration | Зачем |
|---|---|---|
| `OneUptime/oneuptime` | reference_only | Audit log + incident pipeline architecture |
| `Openpanel-dev/openpanel` | reference_only | Telemetry/analytics pipeline pattern (no-PII) |
| `databendlabs/databend` | reference_only | Append-only storage architecture |
| `iii-hq/iii` | reference_only | Service observability + structured logging |
| `pixlcore/xyops` | reference_only | Audit-event taxonomy + ops dashboards |

## 8. Phase 5 swarm distribution

Стандартный 13-role swarm. UX-guru не задействован.

## 9. Связи

- **Зависит от:** WT-00 (scaffolds)
- **Блокирует:** WT-10..WT-39 (все audit-emitting WT); WT-18 (Query API
  build'ит на этом store interface); WT-32 (Evidence store reuse'ит sanitizer)

## 10. Verification

Type-check + bun test на 3 машинах. **Дополнительно:** fuzz-test sanitizer'а
на 1000 cases (proptest-style) — должен 100% redact'ить или leave-alone
predictable. Perf-test: sanitizePayload среднее ≤ 1ms.

## 11. Open questions

- (O-1) Hash algorithm upgrade path (SHA-256 → SHA3-256)? Сейчас зашит;
  смена потребует chain re-anchor. Defer to WT-18.
- (O-2) Telemetry sampling — per-source rate-limit или uniform? Defer
  до Wave 2 telemetry-pipeline WT.
- (O-3) `actor` для system events — единый `'system'` или с suffix
  (`system:WT-10`)? Решение: `'system:<wt-id>'` для traceability, validated
  via regex.
