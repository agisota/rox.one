# WT-31 — WebSocket realtime stream — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for Phase 1 (Discovery)
**Branch:** `feat/realtime-ws`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-31-realtime-ws/`
**Wave:** 2 (Agent Fabric)
**Priority:** P0
**Depends on:** WT-28 (Coordinator agent / DO scaffolding)
**Blocks:** WT-34 (Agent Run UI command center)
**Parent epic:** PZD-116 (E05 — Agent fabric / orchestration)
**FB board:** Frictionless UX
**Feature flag:** `rox.feature.agent-fabric.realtime-ws` (default OFF, release cut "Agent Fabric")

---

## 1. Контекст и цель

Сейчас UI получает прогресс агентских run-ов через polling `/api/runs/:id`
каждые 2 секунды. Это даёт **визуальную задержку 1-3s**, нагрузку на DO storage
и обрывы при reconnect — пользователь видит "замёрзшую" timeline. Cloudflare
Durable Objects поддерживают native **WebSocket hibernation** (с акцептом
`acceptWebSocket()` в DO; коннекция переживает hibernation между событиями).

**Цель WT-31** — выставить WebSocket endpoint на DO Agent с подпиской по
`runId`. Каждое прогресс-событие (`task.queued`, `task.started`,
`task.tool_call`, `task.completed`, `task.failed`, `run.completed`) push-ится
всем подписчикам того же `runId`. Клиент-хук `useAgentStream(runId)` управляет
подключением, exponential reconnect, `last_event_id` replay и hibernation-aware
keep-alive.

После merge — флаг OFF; UI продолжает polling. Release cut "Agent Fabric"
включает WS и удаляет polling fallback на ≥ 99 % трафика.

## 2. Скоуп

### 2.1 Входит

- `infra/cloudflare/realtime-ws.worker.ts` — fetch handler с
  `Upgrade: websocket` дюрабельным переходом в DO.
- `infra/cloudflare/durable-objects/run-stream.ts` — DO `RunStream`:
  `acceptWebSocket()`, `webSocketMessage()`, `webSocketClose()`,
  `webSocketError()`, `alarm()` (keep-alive heartbeat).
- `packages/shared/src/agent-fabric/realtime/event.ts` — zod-схема
  `RunStreamEvent` + `RunStreamEnvelope` + `SubscribeRequest`.
- `packages/shared/src/agent-fabric/realtime/event-id.ts` — monotonic event
  ID generator + replay buffer (ring buffer N=1000 per run).
- `packages/shared/src/agent-fabric/realtime/client.ts` — runtime-agnostic
  client (browser/node/electron) с reconnect + replay logic.
- `apps/electron/src/renderer/hooks/useAgentStream.ts` — React hook с
  React Suspense ready API (`{ events, status, lastEventId, reconnect() }`).
- `apps/electron/src/renderer/hooks/__tests__/useAgentStream.test.tsx`.
- `tests/unit/agent-fabric/realtime/**`.
- `tests/integration/agent-fabric/realtime/**` — miniflare WS emulator.
- `wt-meta/wt-31.yaml`.

### 2.2 Вне скоупа

- DAG state changes — owned WT-28/WT-29 (consumes via DO storage).
- Queue producer/consumer — WT-30.
- Run timeline UI — WT-34.
- Audit log query API — WT-18.
- Per-run cost meter — WT-29.

### 2.3 Forbidden globs

- `packages/shared/src/agent-fabric/dag/**` (WT-29).
- `packages/shared/src/agent-fabric/queue/**` (WT-30).
- `infra/cloudflare/queue-*.worker.ts` (WT-30).
- `package.json`, `tsconfig*.json`, `bun.lock` (WT-00).

## 3. Архитектура

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser/Electron — useAgentStream(runId)                               │
│              │ WebSocket('wss://api/.../runs/{runId}/stream')           │
│              │   ?last_event_id=<n>                                     │
│              ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  realtime-ws.worker.ts                                           │   │
│  │    fetch() → if Upgrade=ws → env.RUN_STREAM.idFromName(runId)    │   │
│  │                          → forward to DO                         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│              │                                                          │
│              ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  RunStream DO (hibernation-aware)                                │   │
│  │    ├─ acceptWebSocket(ws, [runId, userId])                       │   │
│  │    ├─ state.getWebSockets() → broadcast helper                   │   │
│  │    ├─ replayBuffer (sqlite DO storage) — events keyed by eventId │   │
│  │    ├─ webSocketMessage(ws, data) — ping/pong + subscribe-cmd     │   │
│  │    ├─ alarm() — every 30s send heartbeat, evict idle WS > 10min  │   │
│  │    └─ publish(event) — inject from WT-28/29/30 via service call  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│              ▲                                                          │
│   internal service binding:                                             │
│   WT-29 DAG runner → env.RUN_STREAM.get(runId).publish(event)           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 `RunStreamEvent` schema

```ts
export const RunStreamEvent = z.discriminatedUnion('type', [
  z.object({
    type:       z.literal('task.queued'),
    eventId:    z.number().int(),
    ts:         z.string().datetime(),
    runId:      z.string().uuid(),
    taskId:     z.string().uuid(),
    role:       z.string(),
  }),
  z.object({
    type:       z.literal('task.started'),
    eventId:    z.number().int(),
    ts:         z.string().datetime(),
    runId:      z.string().uuid(),
    taskId:     z.string().uuid(),
  }),
  z.object({
    type:       z.literal('task.tool_call'),
    eventId:    z.number().int(),
    ts:         z.string().datetime(),
    runId:      z.string().uuid(),
    taskId:     z.string().uuid(),
    tool:       z.string(),
    summary:    z.string().max(200),
  }),
  z.object({
    type:       z.literal('task.completed'),
    eventId:    z.number().int(),
    ts:         z.string().datetime(),
    runId:      z.string().uuid(),
    taskId:     z.string().uuid(),
    durationMs: z.number().int(),
    costUsd:    z.number().nonnegative(),
    artifactIds:z.array(z.string()).default([]),
  }),
  z.object({
    type:       z.literal('task.failed'),
    eventId:    z.number().int(),
    ts:         z.string().datetime(),
    runId:      z.string().uuid(),
    taskId:     z.string().uuid(),
    error:      z.string(),
    attempt:    z.number().int(),
  }),
  z.object({
    type:       z.literal('run.completed'),
    eventId:    z.number().int(),
    ts:         z.string().datetime(),
    runId:      z.string().uuid(),
    status:     z.enum(['success', 'partial', 'failed']),
  }),
  z.object({
    type:       z.literal('heartbeat'),
    eventId:    z.number().int(),
    ts:         z.string().datetime(),
  }),
]);
```

### 3.2 Hibernation strategy

- DO использует `state.acceptWebSocket(ws)` — НЕ хранит ws в instance fields.
  В hibernation между событиями state instance уничтожается, при следующем
  событии Cloudflare воссоздаёт DO и вызывает `webSocketMessage/Close/Error`
  с восстановленным WS из managed pool.
- Все state (replay buffer, subscriber metadata) — в DO SQLite storage,
  НЕ в memory.
- Heartbeat через `state.setAlarm(now + 30s)` — `alarm()` сам опрашивает
  `state.getWebSockets()` и отправляет `{type:'heartbeat'}`. Это не предотвращает
  hibernation; нужно только чтобы client knew connection alive.

### 3.3 Replay protocol

- Каждое событие получает `eventId = lastEventId + 1` (monotonic per runId,
  persisted в DO SQLite).
- Client при reconnect отправляет header `Sec-WebSocket-Protocol: rox-last-event-id-<n>`
  или query `?last_event_id=<n>`.
- DO `webSocketOpen` (через `acceptWebSocket` attach hook): загружает события
  с `eventId > n` из SQLite, шлёт пачкой (max 100), потом ставит ws в live pool.
- Replay buffer хранит последние 1000 событий per run в DO SQLite,
  TTL=24h после `run.completed`.

### 3.4 Ключевые файлы (files_allowed)

- `infra/cloudflare/realtime-ws.worker.ts`
- `infra/cloudflare/durable-objects/run-stream.ts`
- `infra/cloudflare/wrangler.realtime.toml`
- `packages/shared/src/agent-fabric/realtime/event.ts`
- `packages/shared/src/agent-fabric/realtime/event-id.ts`
- `packages/shared/src/agent-fabric/realtime/client.ts`
- `packages/shared/src/agent-fabric/realtime/replay-buffer.ts`
- `packages/shared/src/agent-fabric/realtime/index.ts`
- `apps/electron/src/renderer/hooks/useAgentStream.ts`
- `apps/electron/src/renderer/hooks/__tests__/useAgentStream.test.tsx`
- `tests/unit/agent-fabric/realtime/**`
- `tests/integration/agent-fabric/realtime/**`

### 3.5 Scaffold-extension requests

- WT-00: `partysocket@^1.0` (dev/runtime — robust reconnecting WS client).
- WT-00: `@cloudflare/workers-types@^4.20260501` (если ещё не добавлено WT-30 —
  координируется через scaffold-ownership.yaml).

## 4. TDD план (≥ 5)

| # | Test | Что проверяет |
|---|---|---|
| T1 | `client subscribes to runId and receives task.queued event` | publish via service binding → spy на WS message handler. |
| T2 | `monotonic event ids` | 100 publishes → eventIds 1..100 строго возрастают, без дыр. |
| T3 | `replay on reconnect from last_event_id=50` | publish 100 событий, новый client `last_event_id=50` → получает 51..100 пачкой ≤ 1s. |
| T4 | `hibernation-safe: DO state lost but replay buffer survives` | Force DO destroy → next event → новые subscribers видят replay из SQLite. |
| T5 | `heartbeat every 30s` | mock clock advance → alarm sends `{type:'heartbeat'}`. |
| T6 | `exponential reconnect on disconnect` | client disconnect → retry intervals 1s, 2s, 4s, 8s, 16s (cap 30s). |
| T7 | `useAgentStream hook updates state on event` | React test: hook renders, event arrives, `events` array updated. |
| T8 | `tenant isolation` | DO checks `userId` from JWT against `runId.tenantId` mapping → cross-tenant reject. |
| T9 | `feature flag OFF: useAgentStream falls back to polling` | флаг false → no WS connection, useAgentStream использует existing polling util. |

Все commit-ятся первым коммитом
`test(agent-fabric/realtime): failing tests for ws + reconnect + replay`.

## 5. Acceptance Criteria (≥ 5)

- [ ] **AC-1:** WS endpoint `wss://api/.../runs/{runId}/stream` — uppergrade
      успешный для authorized user; reject 401 для cross-tenant.
- [ ] **AC-2:** Каждое прогресс-событие достигает всех subscriber-ов того же
      runId с задержкой p99 < 500ms (measured в miniflare integration).
- [ ] **AC-3:** Reconnect с `last_event_id` восстанавливает все пропущенные
      события без дублей и без потерь (≤ 1000 events backlog).
- [ ] **AC-4:** Hibernation: DO instance может быть destroyed; следующий
      event re-creates DO и старые WS subscribers продолжают получать.
- [ ] **AC-5:** `useAgentStream` сохраняет API контракт `{ events, status,
      lastEventId, reconnect, disconnect }`; status ∈ `connecting | open |
      reconnecting | closed | error`.
- [ ] **AC-6:** Audit event `realtime.subscribe`, `realtime.publish_drop`,
      `realtime.cross_tenant_blocked` emit-ятся в WT-08 sink.
- [ ] **AC-7:** Бандл `useAgentStream` ≤ 25 KB gzip (включая partysocket).
- [ ] **AC-8:** При `rox.feature.agent-fabric.realtime-ws=false` хук
      возвращает данные через polling util (`usePollingFallback`), zero WS
      coннекций.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Cloudflare WS hibernation API нестабилен | Покрытие интеграционными тестами на miniflare; fallback polling под флагом. |
| Replay буфер растёт безгранично | Hard cap 1000 events / TTL 24h после `run.completed`. |
| WS connection cap (32k/instance) | Sharding по `runId` (DO `idFromName(runId)` — каждый run — отдельный DO). |
| Renderer leak: hook не размонтируется | `useEffect` cleanup + `disconnect()` обязателен; тестируется через RTL. |
| Token in URL leak (last_event_id, jwt) | JWT в `Authorization` header через `Sec-WebSocket-Protocol`; `last_event_id` numeric only. |

## 7. Inspiration repos

| Repo | Integration type | Зачем |
|---|---|---|
| `cloudflare/workers-chat-demo` | reference_only | Канонический DO hibernation + `acceptWebSocket` pattern. |
| `partykit/partykit` | reference_only | DO-based real-time framework — replay buffer + reconnect patterns. |
| `partykit/partysocket` | dependency | Robust reconnecting WS client (auto-resume, exp backoff). |
| `cloudflare/templates` (durable-objects-websocket-server) | reference_only | Hibernation-aware DO server skeleton. |
| `pusher/pusher-http-node` | reference_only | Event-id monotonic + replay protocol design. |

## 8. Phase 5 swarm distribution

| Phase | Роли | Модель |
|---|---|---|
| Discovery | brainstormer, requirements-keeper, scope-analyzer, critic | opus-4.7-max |
| Design | prompt-writer, architect, ux-guru (hook API contract) | opus-4.7-max |
| Impl tests | test-writer | opus-4.7-max |
| Impl code | implementer, super-coder | sonnet-4.6-medium |
| Impl review | reviewer | opus-4.7-max |
| Verification | verifier, critic, integrator | opus-4.7-max |
| Optimization | optimizer, 10x-improver | opus-4.7-max |

## 9. Связи

- **Зависит от:** WT-28 (Coordinator agent — публикует events via service
  binding), WT-08 (audit emit).
- **Блокирует:** WT-34 (UI command center потребляет hook), WT-30 (fanin
  worker emits через тот же DO).

## 10. Verification protocol

- **Unit:** Vitest + JSDOM для hook + zod schemas + replay-buffer = 9 tests.
- **Integration:** miniflare WS + DO emulator — все 6 событийных типов +
  reconnect + hibernation simulated через `getDurableObject().destroy()`.
- **3-machine:** typecheck + unit + integration на mac/win/linux; UI smoke
  включён только в WT-34. Здесь — headless hook test.
- **Load (Phase 5):** 1000 concurrent WS, p99 latency < 500ms, memory
  < 100 MB DO instance.

## 11. Open questions

- (O-1) Hibernation поведение под Workers paid plan vs free — нужно ли
  fallback на non-hibernating WS (хранить subscribers in DO memory)?
- (O-2) Replay buffer storage cost — SQLite DO vs KV; считаем cost для
  1k runs/day по 200 events.
- (O-3) Audit event `realtime.publish_drop` granularity — per drop или
  aggregated по 60s окнам?

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** N/A
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** WSStream
- **Events emitted (WT-49 ActivityEvent):** ws.connected, ws.disconnected, ws.replay
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** perf, data
