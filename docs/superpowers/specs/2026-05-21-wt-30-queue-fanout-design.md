# WT-30 — Queue fan-out/fan-in — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for Phase 1 (Discovery)
**Branch:** `feat/queue-fanout`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-30-queue-fanout/`
**Wave:** 2 (Agent Fabric)
**Priority:** P0
**Depends on:** WT-29 (Task DAG runner)
**Blocks:** WT-34 (Agent Run UI command center)
**Parent epic:** PZD-116 (E05 — Agent fabric / orchestration)
**FB board:** Frictionless UX
**Feature flag:** `rox.feature.agent-fabric.queue-fanout` (default OFF, release cut "Agent Fabric")

---

## 1. Контекст и цель

WT-29 даёт `TaskDagRunner` — synchronous executor графа задач (`Task[]` →
`TaskRun[]`). Single-process модель не масштабируется: один долгий sub-task
блокирует параллельные ветки, retry — ручной, dead-letter не существует, а
backpressure от downstream agent ролей теряется. Для enterprise-нагрузки нужен
distributed fan-out с гарантированной at-least-once delivery + per-role
consumer pool + dead-letter queue.

**Цель WT-30** — внедрить fan-out producer/consumer через **Cloudflare Queues
binding** в `infra/cloudflare/queue-fanout.worker.ts`. DAG runner становится
producer: для каждого ready-task пушит `TaskEnvelope` в role-specific очередь
(`q-role-tests`, `q-role-impl`, `q-role-review`, …). Per-role consumer worker
снимает batch, выполняет sub-agent, пишет результат в `agent-fabric/results`
KV/DO, кидает completion event обратно в `q-fanin` для DAG progress update.
Retry / DLQ / backpressure управляются через native Queues feature set.

После merge fan-out выключен флагом; включается release cut "Agent Fabric".

## 2. Скоуп

### 2.1 Входит

- `infra/cloudflare/queue-fanout.worker.ts` — единая Worker entry с
  `fetch()` + `queue()` handlers (producer-side ack + consumer dispatch).
- `infra/cloudflare/queue-fanin.worker.ts` — consumer для completion events
  (обновляет DAG state через DO storage у WT-29).
- `infra/cloudflare/wrangler.queues.toml` — декларация bindings:
  6 role queues (`q-role-discovery`, `q-role-impl`, `q-role-tests`,
  `q-role-review`, `q-role-verify`, `q-role-optimize`) + `q-fanin` +
  `q-deadletter`.
- `packages/shared/src/agent-fabric/queue/envelope.ts` — zod-схема
  `TaskEnvelope`, `CompletionEvent`, `DeadLetterRecord`.
- `packages/shared/src/agent-fabric/queue/producer.ts` —
  `enqueueTask(envelope)` + `enqueueBatch(envelopes)` (singleflight per
  `task_id`).
- `packages/shared/src/agent-fabric/queue/consumer.ts` — runtime-agnostic
  consumer loop (`processBatch(messages)` + ack/retry decisions).
- `packages/shared/src/agent-fabric/queue/backpressure.ts` — token-bucket
  rate-limiter + circuit breaker per role.
- `tests/unit/agent-fabric/queue/**/*.test.ts` — TDD первого коммита.
- `tests/integration/agent-fabric/queue/**/*.test.ts` — против miniflare
  Queues emulator.
- `wt-meta/wt-30.yaml` (этот WT).

### 2.2 Вне скоупа

- DAG state machine — owned WT-29 (read-only consume через published API).
- WebSocket realtime push к UI — WT-31.
- Per-tenant cost accounting — WT-29 (передаётся в envelope как
  `tenant_budget_token`).
- UI run timeline — WT-34.

### 2.3 Forbidden globs

- `packages/shared/src/agent-fabric/dag/**` (WT-29 owner).
- `infra/cloudflare/durable-objects/agent-coordinator.ts` (WT-28 owner).
- `infra/cloudflare/realtime-ws.worker.ts` (WT-31 owner).
- `package.json`, `tsconfig*.json`, `bun.lock` (WT-00 owner).

## 3. Архитектура

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DAG Runner (WT-29) — selects READY tasks                               │
│              │                                                          │
│              ▼ enqueueBatch(envelopes)                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  queue-fanout.worker.ts — fetch handler                          │   │
│  │    producer(envelope) → routeByRole(env.role) → ENV.QUEUE.send() │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│              │                                                          │
│   q-role-tests   q-role-impl   q-role-review   q-role-verify  …         │
│        │              │             │                │                  │
│        ▼              ▼             ▼                ▼                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  queue-fanout.worker.ts — queue() handler (per-role binding)     │   │
│  │    processBatch(messages) → invoke sub-agent → resultRecord      │   │
│  │    ack on success, retry (≤ maxRetries=5, expBackoff), DLQ       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│              │                                                          │
│              ▼ enqueueCompletion(event)                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  q-fanin → queue-fanin.worker.ts → DAG runner state update       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Failures > maxRetries → q-deadletter → audit emit + Linear ping        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 `TaskEnvelope` schema

```ts
export const TaskEnvelope = z.object({
  envelopeId:       z.string().uuid(),         // idempotency key
  runId:            z.string().uuid(),         // links to DAG run
  taskId:           z.string().uuid(),
  role:             z.enum([
    'discovery', 'impl', 'tests', 'review', 'verify', 'optimize',
  ]),
  tenantId:         z.string().uuid(),
  budgetToken:      z.string(),                // signed JWT from WT-07/WT-24
  attempt:          z.number().int().min(1).max(5),
  payload:          z.record(z.unknown()),     // role-specific
  enqueuedAt:       z.string().datetime(),
  notBefore:        z.string().datetime().nullable(),  // for delayed retry
});
```

### 3.2 Backpressure / circuit breaker

- Token bucket per `(tenantId, role)` — capacity = entitlement-tier × N
  (Free: 5 concurrent, Pro: 20, Team: 100, Enterprise: 1000).
- При `tokens === 0` producer возвращает `EnqueueResult.deferred` и
  envelope попадает в `q-deferred-<role>` с `notBefore = now + 5s`.
- Circuit breaker: если consumer ack-rate < 30 % за 60s окно — role
  переходит в `OPEN`, producer возвращает `DEGRADED`; через 30s — `HALF_OPEN`.

### 3.3 Retry / DLQ policy

- `maxRetries = 5`, exponential backoff `base=2s`, `cap=120s`, jitter ±20 %.
- Non-retriable errors (`SCHEMA_INVALID`, `TENANT_DISABLED`, `BUDGET_EXHAUSTED`) →
  immediate DLQ.
- DLQ envelope ⇒ `audit.queue.dead_letter` event + Linear comment on parent
  sub-issue (через WT-09 sync hook).

### 3.4 Ключевые файлы (files_allowed)

- `infra/cloudflare/queue-fanout.worker.ts`
- `infra/cloudflare/queue-fanin.worker.ts`
- `infra/cloudflare/wrangler.queues.toml`
- `packages/shared/src/agent-fabric/queue/envelope.ts`
- `packages/shared/src/agent-fabric/queue/producer.ts`
- `packages/shared/src/agent-fabric/queue/consumer.ts`
- `packages/shared/src/agent-fabric/queue/backpressure.ts`
- `packages/shared/src/agent-fabric/queue/dead-letter.ts`
- `packages/shared/src/agent-fabric/queue/index.ts`
- `tests/unit/agent-fabric/queue/**`
- `tests/integration/agent-fabric/queue/**`

### 3.5 Scaffold-extension requests

- WT-00: `@cloudflare/workers-types@^4.20260501` (dev dep).
- WT-00: `miniflare@^3.20260501` (dev dep — local Queues emulator).
- WT-00: `wrangler@^3.95` (dev dep).

## 4. TDD план (≥ 5)

| # | Test | Что проверяет |
|---|---|---|
| T1 | `producer enqueues envelope to correct role queue` | `enqueueTask({role: 'tests'})` → spy на `env.Q_ROLE_TESTS.send` 1 раз. |
| T2 | `producer fans out 50 tasks atomically` | batch of 50 → consumer видит ровно 50 envelopes без дублей по `envelopeId`. |
| T3 | `consumer retries with exp backoff on transient error` | sub-agent throws → message `retry()` с `delaySeconds` соответствует attempt level (2,4,8,16,32). |
| T4 | `consumer routes to DLQ after maxRetries` | 6-я ошибка → envelope в `q-deadletter`, audit emit `queue.dead_letter`, original message acked. |
| T5 | `backpressure denies enqueue when token bucket empty` | Free tier 5 concurrent → 6-й call → `EnqueueResult.deferred`, `notBefore` назад через 5s. |
| T6 | `circuit breaker opens on <30% ack rate` | mock 10 attempts с 80% fail → breaker → `OPEN`; next enqueue → `DEGRADED`. |
| T7 | `idempotency: duplicate envelopeId dropped` | повторный enqueue той же `envelopeId` → no-op + audit `queue.duplicate_dropped`. |
| T8 | `fan-in completion event reaches DAG runner` | sub-agent success → `q-fanin` get event → mocked DAG runner method called. |
| T9 | `feature flag OFF: producer is no-op` | флаг false → producer возвращает `Result.ok(null)`, zero `.send()` calls. |

Все commit-ятся первым коммитом
`test(agent-fabric/queue): failing tests for fanout/fanin` ДО любого impl-кода.

## 5. Acceptance Criteria (≥ 5)

- [ ] **AC-1:** `enqueueTask` идемпотентен по `envelopeId` (повторный enqueue
      внутри 24h-окна детектируется через KV-set).
- [ ] **AC-2:** 6 role queues + `q-fanin` + `q-deadletter` декларированы в
      `wrangler.queues.toml` и проходят `wrangler queues list --dry-run`.
- [ ] **AC-3:** Consumer ack rate ≥ 99 % при happy path; DLQ rate ≤ 0.1 %
      измерен через 1000-envelope synthetic load.
- [ ] **AC-4:** Backpressure token bucket уважает tier-quotas из WT-07
      entitlement engine (контракт: `getConcurrencyForTier(tenant, role)`).
- [ ] **AC-5:** Audit events `queue.enqueued`, `queue.dequeued`,
      `queue.dead_letter`, `queue.duplicate_dropped` содержат `tenantId`,
      `runId`, `taskId`, `role`, `attempt` (no payload PII).
- [ ] **AC-6:** При `rox.feature.agent-fabric.queue-fanout=false` — DAG
      runner fallback к in-process выполнению (no queue calls).
- [ ] **AC-7:** Bundle size `infra/cloudflare/queue-fanout.worker.ts`
      ≤ 250 KB (deflated) — фиксируется в `bundle-budget.json`.
- [ ] **AC-8:** miniflare integration suite зелёный на 3 машинах (mac/win/linux).

## 6. Risks

| Risk | Mitigation |
|---|---|
| Cloudflare Queues per-account RPS limit | Aggregated metrics + `queue_send_rate` watcher; alert на ≥ 80 % предела. |
| Поглощение бюджета opus-max при storm retry | Non-retriable error codes + max attempts cap + DLQ alarm. |
| Cold start workers latency | Singleton consumer pool через DO; warm-up ping каждые 4 минуты. |
| KV idempotency cost (1M writes) | TTL=24h + hash-prefix sharding; consider Durable Object SQLite вместо KV в Phase 5. |
| Schema drift envelope при mid-deploy | Strict zod parsing; миграции через `envelope_version` field (v1 only сейчас). |

## 7. Inspiration repos

| Repo | Integration type | Зачем |
|---|---|---|
| `cloudflare/workers-sdk` (Queues examples) | reference_only | Канонические `queue()` consumer patterns, batch-ack, retry semantics. |
| `cloudflare/durable-objects-template` | reference_only | DO-state для idempotency keys + circuit breaker state. |
| `temporalio/sdk-typescript` | reference_only | Worker lifecycle patterns, exponential backoff retry policy, DLQ contract. |
| `aws/aws-lambda-powertools-typescript` | reference_only | SQS batch failure semantics — переносится на Cloudflare Queues. |
| `bull-board/bullmq` | reference_only | Token bucket per-queue concurrency + circuit breaker patterns. |

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

UX-guru не задействован (no UI surface).

## 9. Связи

- **Зависит от:** WT-29 (DAG runner contract `enqueueTask` callback),
  WT-07 (entitlement quotas), WT-08 (audit emit), WT-24 (quota engine).
- **Блокирует:** WT-34 (UI ждёт queue state metadata),
  WT-31 (push events read fan-in queue metrics).

## 10. Verification protocol

- **Unit:** miniflare-mocked Queues — 9 tests above.
- **Integration:** miniflare full Queues + KV + DO emulators — happy
  fan-out/fan-in + DLQ + circuit breaker.
- **3-machine:** typecheck + unit + integration зелёный на mac/win/linux
  (workers code is platform-agnostic). UI smoke не требуется.
- **Load test (Phase 5):** synthetic 10k envelopes, p99 enqueue < 50ms,
  p99 fanin-roundtrip < 5s.

## 11. Open questions

- (O-1) Cloudflare Queues GA region availability — должны ли мы fallback к
  KV-based pseudo-queue для disabled regions? (Решение в Phase 1.)
- (O-2) Deadletter retention period — 30 дней или 90? Согласовать с WT-26
  (backup policy).
- (O-3) `tenant_budget_token` revoke flow — push-based (WT-07 webhook) или
  pull-based (consumer проверяет на каждом attempt)?

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** N/A
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** TaskQueue
- **Events emitted (WT-49 ActivityEvent):** task.queued, task.consumed
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** perf
