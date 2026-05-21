# WT-24 — Quota Engine

- **Дата:** 2026-05-21
- **Статус:** Spec — draft
- **Branch:** `feat/quota-engine`
- **Base SHA:** `fac6f228069c`
- **Wave:** 1
- **Priority:** P0 (Enterprise B2B revenue blocker — без quota нет tier-pricing)
- **Epic:** PZD-122 (E11 Workspaces & Drive)
- **Featurebase board:** Enterprise B2B
- **Depends on:** WT-07 (entitlement-flags), WT-23 (storage-backend)
- **Blocks:** —

---

## 1. Цель и обоснование

Без quota engine нельзя строить tier pricing (Free / Pro / Team / Enterprise). Каждый ресурс
(storage bytes, agent runs, API calls, mailbox forwards и т.д.) должен:

1. Иметь decleared limit per tier (через WT-07 entitlement registry).
2. Иметь live counter с TTL window (per-day / per-month / lifetime).
3. Эмитить hard cap reject + soft warning at 80%.
4. Emit audit event on каждую попытку overrun (для billing/abuse triage).

WT-24 — pure-logic движок (нет I/O кроме storage adapter pluggable). Не привязан к конкретному
backend для счётчиков: in-memory (test) / SQLite (electron) / Durable Object (Workers) — все
через `QuotaCounterStore` interface.

---

## 2. Scope (in)

```
packages/shared/src/quota/
├── quota-engine.ts                       # main QuotaEngine class
├── quota-engine.test.ts
├── quota-types.ts                        # ResourceKind, QuotaWindow, QuotaPolicy, etc.
├── counter-store.ts                      # QuotaCounterStore interface + in-memory impl
├── counter-store.test.ts
├── adapters/
│   ├── sqlite-counter-store.ts           # для electron desktop
│   ├── sqlite-counter-store.test.ts
│   ├── durable-object-counter-store.ts   # для Workers (Cloudflare)
│   └── durable-object-counter-store.test.ts
├── policies/
│   ├── default-policies.ts               # hardcoded defaults per tier (Open Q25 final values)
│   └── default-policies.test.ts
└── index.ts
```

---

## 3. Out of scope (defer)

- UI для admins (отображение usage) — WT-17 RBAC admin UI extension в Wave 2.
- Billing integration (тарификация overage usage) — отдельный billing-WT.
- Cost-based quota (не bytes, а $$) — defer.
- Per-API-endpoint rate limiting на API gateway уровне — отдельная concern.
- Token bucket / leaky bucket complex algorithms — v1 простой fixed-window.

---

## 4. Engine API

```typescript
// packages/shared/src/quota/quota-types.ts
export type ResourceKind =
  | 'storage_bytes'
  | 'agent_runs'
  | 'api_calls'
  | 'mailbox_forwards'
  | 'workspace_count'
  | 'team_member_count';

export type QuotaWindow = 'per-day' | 'per-month' | 'lifetime';

export interface QuotaPolicy {
  resource: ResourceKind;
  window: QuotaWindow;
  hardCap: number;                  // reject выше этого
  softWarnAt: number;               // emit warning event (например, 0.8 * hardCap)
  tier: 'free' | 'pro' | 'team' | 'enterprise';
}

export interface QuotaCheckRequest {
  scope: { tenantId: string; userId?: string; workspaceId?: string };
  resource: ResourceKind;
  amount: number;                   // сколько хотим потратить (bytes, calls, runs)
  policy: QuotaPolicy;
}

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  current: number;
  hardCap: number;
  windowResetsAt: string;           // ISO8601
  warning?: { reason: 'approaching-cap'; thresholdReached: number };
  reject?: { reason: 'hard-cap-exceeded' | 'feature-disabled'; auditEventId?: string };
}

export interface QuotaConsumeRequest extends QuotaCheckRequest {
  idempotencyKey?: string;          // для retry safety
}

export class QuotaEngine {
  constructor(opts: { store: QuotaCounterStore; auditEmit?: AuditEmitter });
  check(req: QuotaCheckRequest): Promise<QuotaCheckResult>;
  consume(req: QuotaConsumeRequest): Promise<QuotaCheckResult>;
  rollback(req: QuotaConsumeRequest & { reason: string }): Promise<{ ok: boolean }>;
  getUsage(scope: QuotaCheckRequest['scope'], resource: ResourceKind, window: QuotaWindow): Promise<{ current: number; windowResetsAt: string }>;
}
```

**Counter store interface:**

```typescript
export interface QuotaCounterStore {
  increment(key: QuotaCounterKey, delta: number, windowResetsAt: string): Promise<{ newValue: number }>;
  read(key: QuotaCounterKey): Promise<{ value: number; windowResetsAt: string }>;
  reset(key: QuotaCounterKey): Promise<{ ok: boolean }>;
}

export interface QuotaCounterKey {
  tenantId: string;
  userId?: string;
  workspaceId?: string;
  resource: ResourceKind;
  window: QuotaWindow;
}
```

**Window reset logic:** `per-day` resets at midnight UTC; `per-month` at first-of-month UTC;
`lifetime` never. Все ISO8601 в UTC (CLAUDE.md `data_integrity`).

---

## 5. Acceptance Criteria

| # | AC | Verification |
|---|---|---|
| AC1 | `consume({amount: N})` где N + current ≤ hardCap → `allowed: true`, counter increments | happy-path test |
| AC2 | `consume` где N + current > hardCap → `allowed: false`, counter unchanged, reject.reason='hard-cap-exceeded' | hard-cap test |
| AC3 | `consume` где current crosses `softWarnAt` → `allowed: true`, `warning` populated | soft-warn test |
| AC4 | Overrun attempt emits audit event через `auditEmit` (WT-08 contract) с tenant/resource/amount | audit-emit test |
| AC5 | `consume` с тем же `idempotencyKey` дважды — second call no-op, returns prior result | idempotency test |
| AC6 | `per-day` window resets корректно через midnight UTC (mocked clock) | window-reset test |
| AC7 | `rollback({idempotencyKey})` decrements counter, emits audit | rollback test |
| AC8 | Concurrent consume calls (10 параллельно) не превышают hardCap (race-safe via store atomic increment) | concurrency test |
| AC9 | Feature flag `rox.feature.quota` default OFF → engine bypass (allowed=true always, без counter writes) | flag-off test |
| AC10 | Per-tier default policies match Open Q25 final values (Free 1GB / Pro 50GB / Team 500GB / Enterprise custom) | policy-table test (placeholder values до Q25 решения) |

---

## 6. TDD план

1. **T1 — quota-engine.happy-path.test.ts:** check + consume + getUsage.
2. **T2 — hard-cap-reject.test.ts:** counter unchanged on reject.
3. **T3 — soft-warn.test.ts:** warning emitted at threshold.
4. **T4 — audit-emit.test.ts:** overrun audit event correctly formed.
5. **T5 — idempotency.test.ts:** double consume same key = no-op.
6. **T6 — window-reset.test.ts:** mocked clock crosses midnight UTC.
7. **T7 — rollback.test.ts:** rollback decrements + audit.
8. **T8 — concurrency.test.ts:** 10 parallel consumes (Promise.all) respect hardCap.
9. **T9 — sqlite-store.test.ts:** SQLite adapter parametrized contract.
10. **T10 — feature-flag.test.ts:** OFF bypass.

---

## 7. Файловый allowlist

```yaml
files_allowed:
  - packages/shared/src/quota/**
  - tests/unit/quota/**
  - tests/integration/quota/**
files_forbidden:
  - package.json
  - tsconfig*.json
  - packages/shared/src/feature-flags/**     # WT-07 territory
  - packages/shared/src/audit/**             # WT-08 territory
  - packages/shared/src/storage/**           # WT-23 territory
```

Scaffold-request к WT-00:
- Подтвердить, что `better-sqlite3` (или existing electron SQLite binding) доступен для SQLite adapter.

---

## 8. Inspiration repos

| # | URL | Integration | Rationale |
|---|---|---|---|
| 1 | https://github.com/upstash/ratelimit | reference_only | Fixed-window + sliding-window patterns. |
| 2 | https://github.com/stripe/stripe-node (usage-records API) | reference_only | Idempotency + audit emit on usage. |
| 3 | https://github.com/animir/node-rate-limiter-flexible | concept | Multi-store adapter pattern. |
| 4 | https://github.com/cloudflare/workers-rs (Durable Objects examples) | reference_only | DO-backed atomic counters. |
| 5 | https://github.com/dgraph-io/badger (or similar) | reference_only (defer) | Embedded counter store option. |

---

## 9. Verification & 3-machine

- **mac-14-arm:** unit + integration (in-memory + SQLite) + concurrency stress (1000 parallel).
- **windows-2022:** same.
- **ubuntu-22:** same + Durable Object simulator test.

Screenshots: none. Smoke: 1000-parallel consume не превышает hardCap.

---

## 10. Linear/Featurebase sync

- **Linear parent:** PZD-122. Sub-issues: discovery / design / engine / sqlite-store / DO-store / policies / verify.
- **Featurebase board:** Enterprise B2B. Post alias: `wt-24-quota-engine`.

---

## 11. Risk register

| Risk | Mitigation |
|---|---|
| Race condition double-spend | Atomic increment в store (SQLite WAL / DO transaction); concurrency-test guard. |
| Clock skew мешает window reset | Use UTC + server-side reset (NOT client clock). |
| Hard cap blocks paying customer mid-flow | softWarnAt at 80% + UI escalation hook (WT-17 future). |
| Per-tier policy values not finalized (Open Q25) | Use placeholder defaults в `default-policies.ts`; structure not blocked. |

---

## 12. Definition of Done

- [ ] TDD-first 10 failing tests committed
- [ ] All tests pass
- [ ] typecheck / lint green
- [ ] Concurrency test (1000 parallel) passes без race
- [ ] Idempotency verified
- [ ] Audit emit verified
- [ ] SQLite + DO adapter parametrized contract passes
- [ ] No `any` types
- [ ] Feature flag OFF bypass verified
- [ ] 3-machine evidence attached
- [ ] Linear Done, FB Shipped
