# WT-28 — Coordinator Agent (durable identity) — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for implementation (TDD-first)
**Ветка:** `feat/coordinator-agent`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-28-coordinator-agent/`
**Wave:** 3
**Priority:** P0
**Depends on:** WT-04 (user contract), WT-05 (tenant/org contract), WT-06 (workspace/team), WT-08 (audit + telemetry)
**Blocks:** WT-29 (Task DAG runner — coordinator owns DAG state), WT-30+ (agent fabric usage)
**Parent epic:** PZD-116 (E05 — Design / Agent Answer Package / AAP)
**FB board:** Frictionless UX (`6a0db1d3a8e2f070b0c2a234`)
**Feature flag:** `rox.feature.agent-fabric.coordinator` (default OFF, release cut "Agent Fabric")

---

## 1. Контекст

Текущий ROX.ONE agent loop работает per-conversation: каждый chat-session
порождает свежий agent-context без долгой памяти и без cross-session
координации. Это блокирует:

- ритмы (daily/weekly check-ins, recurring tasks),
- multi-step рабочие потоки, которые переживают app reload,
- recovery после network drop / power loss,
- coherent identity per (tenant, user, workspace, goal) — "это всё ещё мой
  agent, тот же, что вчера".

WT-28 строит **Coordinator Agent** — долгоживущий identity-objects на базе
**Cloudflare Agents** (Durable Object subclass). Один coordinator существует
per `(tenant_id, user_id, workspace_id, goal_id)`. Coordinator владеет:

- persisted state (`setState` + sqlite-on-DO),
- scheduled rhythms (`schedule(...)` API DO Alarms),
- task fibers (`runFiber(name, fn)` — durable execution через `ctx.waitUntil`),
- chat recovery — stream reattach при app reconnect.

Inspiration: Anthropic Claude Agent SDK patterns
(`docs/superpowers/specs/2026-05-20-rox-integration-vision-design.md`),
Cloudflare Agents `cloudflare/agents`, Durable Objects.

Этот WT — **identity + capabilities layer**, не DAG executor (WT-29 поверх).
Этот WT — **не UI** для управления (отложено в WT-34 Agent run UI).

## 2. Цели и нецели

### 2.1 In scope

- `apps/electron/src/main/agent/coordinator.ts` — Electron-side proxy:
  resolve `(tenant, user, workspace, goal)` → bind to remote Coordinator DO
  через WS+JSON-RPC поверх существующего `network-proxy.ts`.
- `infra/cloudflare/coordinator-agent.ts` — Durable Object class
  `CoordinatorAgent extends Agent<Env, State>`:
  - `state: { goalSpec, lastTickAt, fiberStates, chatCursor, scheduleHandles }`
  - methods: `start(goalSpec)`, `tick()`, `schedule(spec)`, `runFiber(name, fn)`,
    `attachChat(streamId)`, `getRecoveryToken()`.
- `packages/shared/src/agent/coordinator-contract.ts` — wire-protocol types
  (zod): `CoordinatorId`, `GoalSpec`, `FiberState`, `RecoveryToken`, `Tick`.
- `packages/shared/src/agent/coordinator-client.ts` — typed client (shared
  между renderer и main).
- Wrangler config + DO binding `COORDINATOR_AGENT_NAMESPACE`.
- Tests: ≥ 25 unit + 12 integration (Miniflare для DO), 3 chaos.

### 2.2 Out of scope

- DAG executor (multi-role swarm runner) → WT-29.
- UI поверх coordinator (agent run timeline, fiber inspector) → WT-34.
- LLM provider switching внутри coordinator → существующий `claude-llm-query`.
- Cost accounting per coordinator → WT-18 audit query API + WT-08.
- Realtime WebSocket-multiplex для multiple coordinators → WT-31.

### 2.3 Forbidden globs

- `apps/electron/src/renderer/**` — UI.
- `packages/shared/src/auth/**` — WT-04/05/10.
- `packages/shared/src/audit/**` — WT-08 (consume, не модифицируем).
- `package.json`, `tsconfig*.json`, `bun.lock` — WT-00.

## 3. Архитектура

```
┌──────────────────────────────────────────────────────────────────┐
│  Electron renderer  ←──IPC──→  main process                      │
│                                  │                               │
│                       CoordinatorBridge (main/agent/             │
│                          coordinator.ts)                         │
│                                  │  WSS + JSON-RPC               │
│                                  ▼                               │
│            Cloudflare Worker (router → DO binding)               │
│                                  │                               │
│                                  ▼                               │
│   ┌────────────────────────────────────────────────────────┐     │
│   │ CoordinatorAgent extends Agent<Env, State>             │     │
│   │   (one DO per coordinatorId = hash(tenant,user,        │     │
│   │    workspace,goal))                                    │     │
│   │                                                        │     │
│   │  state:                                                │     │
│   │    goalSpec: GoalSpec                                  │     │
│   │    lastTickAt: ISO ts                                  │     │
│   │    fiberStates: Map<fiberId, FiberState>               │     │
│   │    chatCursor: { streamId, lastEventId }               │     │
│   │    scheduleHandles: Array<ScheduleHandle>              │     │
│   │                                                        │     │
│   │  methods:                                              │     │
│   │    start(spec)       — initialize + emit "started"     │     │
│   │    tick()            — periodic reconcile + emit       │     │
│   │    schedule(spec)    — register cron/at via DO alarm   │     │
│   │    runFiber(name, fn)— durable fn-call с retry/replay  │     │
│   │    attachChat(sid)   — bind ongoing LLM stream;        │     │
│   │                        chatCursor recovery при reconnect│    │
│   │    getRecoveryToken()— short-lived token для reconnect │     │
│   └────────────────────────────────────────────────────────┘     │
│                                  │                               │
│                                  ▼                               │
│       audit (WT-08) + telemetry — emits "agent.coord.*"          │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1 Identity stable hash

```
coordinatorId = sha256(
  `${tenant_id}:${user_id}:${workspace_id}:${goal_id_v1}`
).slice(0, 32)
```

`goal_id_v1` — UUID v7, assigned клиентом при первом `start(...)`; remains
stable across reconnects. Versioned suffix (`_v1`) на случай ребрендинга
goal-схемы.

### 3.2 State persistence

Cloudflare Agents предоставляет:
- `this.setState(partial)` — eventual-consistent JSON state.
- `this.sql` — embedded SQLite-on-DO (используем для fiber events log).
- `this.ctx.storage.put/get` — primary low-level KV (используем для
  recovery checkpoints каждые 30s).

Schema `this.sql` (DO-local):
```sql
CREATE TABLE IF NOT EXISTS fiber_log (
  fiber_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  ts INTEGER NOT NULL,
  PRIMARY KEY (fiber_id, seq)
);
CREATE TABLE IF NOT EXISTS schedule_log (
  handle_id TEXT PRIMARY KEY,
  cron_spec TEXT NOT NULL,
  next_fire_at INTEGER,
  created_at INTEGER
);
```

### 3.3 runFiber durability (replay semantics)

```ts
async runFiber(name: string, fn: () => Promise<T>): Promise<T> {
  const fiberId = `${name}.${ulid()}`;
  appendFiberLog(fiberId, 0, 'started', {});
  try {
    const result = await fn();
    appendFiberLog(fiberId, last+1, 'completed', { result });
    return result;
  } catch (e) {
    appendFiberLog(fiberId, last+1, 'failed', { err });
    // retryable? schedule retry с exponential backoff via DO alarm
    throw e;
  }
}
```

Replay при cold start: coordinator wakes → читает `fiber_log` → возобновляет
incomplete fibers (если retryable + within budget).

### 3.4 chatRecovery

Streams к LLM (`claude-llm-query` или `agent-answer-router`) держат
`streamId` + last-seen `eventId`. При app reconnect:
1. Client отдаёт `recoveryToken` + `streamId`.
2. Coordinator проверяет cursor; если позади tip — resume from cursor (replay
   buffered events).
3. Если tip уже завершён — отдаёт final result + closing event.

### 3.5 Ключевые файлы (files_allowed)

- `apps/electron/src/main/agent/coordinator.ts`
- `apps/electron/src/main/agent/coordinator-bridge-types.ts`
- `infra/cloudflare/coordinator-agent.ts`
- `infra/cloudflare/wrangler.coordinator-agent.example.toml`
- `infra/cloudflare/wrangler.coordinator-agent.toml`
- `infra/cloudflare/__tests__/coordinator-agent.test.ts`
- `packages/shared/src/agent/coordinator-contract.ts`
- `packages/shared/src/agent/coordinator-client.ts`
- `packages/shared/src/agent/coordinator-types.ts`
- `tests/unit/agent/coordinator/**`
- `tests/integration/agent/coordinator/**`

## 4. TDD план (≥ 5 tests-first)

| # | Test name | What it asserts |
|---|---|---|
| T1 | `coordinatorId derives stable hash from identity tuple` | Same `(tenant, user, workspace, goal)` → same `coordinatorId`; different goal → different. |
| T2 | `start initializes state and emits "started" event` | Свежий DO → `start(spec)` записывает `goalSpec`, emits audit "agent.coord.started". |
| T3 | `tick is idempotent within same wall-clock second` | Двойной `tick()` < 1s → second skipped (rate-limited); `lastTickAt` обновляется один раз. |
| T4 | `schedule registers DO alarm and fires at cron tick` | `schedule({ cron: '0 9 * * *' })` → next alarm = 09:00 UTC; mock-clock тест. |
| T5 | `runFiber persists log and replays on cold start` | Run fiber → kill DO → restart → replay из `fiber_log`; idempotent result. |
| T6 | `runFiber retry on transient failure with exponential backoff` | Inject 3 failures → 3 retries (1s/2s/4s); succeed on 4th attempt; budget cap при 5 retries. |
| T7 | `attachChat reattaches to existing stream by recoveryToken` | Stream pos=42 → disconnect → reattach с token → resume from event 43. |
| T8 | `recoveryToken expires after 5 minutes` | Issue token → wait 6m (fake-timer) → reattach → `RECOVERY_TOKEN_EXPIRED`. |
| T9 | `concurrent ticks serialized through DO single-threading` | 10 parallel `tick()` → no race; final state consistent (DO single-actor invariant). |
| T10 | `cross-coordinator isolation: state never leaks` | Coord A.state не виден из Coord B (даже same tenant); fuzz test. |
| T11 | `feature flag OFF: client falls back to ephemeral agent` | `rox.feature.agent-fabric.coordinator=false` → no DO calls; fallback path. |
| T12 | `audit events emitted for start/tick/schedule/fiber/attach` | 5 distinct event types на каждом mutating method. |

Tests-first commit `test(agent/coordinator): failing tests for coordinator agent`.

## 5. Acceptance Criteria (≥ 5)

1. **AC-1:** Coordinator identity детерминирована: одинаковые
   `(tenantId, userId, workspaceId, goalId)` → одна DO instance независимо от
   времени запуска.
2. **AC-2:** State выживает app reload + cold-start DO: повторное `attach()`
   возвращает same `goalSpec`, `fiberStates`, `chatCursor`.
3. **AC-3:** Schedule API поддерживает RFC-5545-like cron syntax;
   `next_fire_at` сохраняется в SQL-on-DO; миssed alarms fire-on-wake.
4. **AC-4:** runFiber durable: failure mid-execution → resumes на cold start
   (replay из `fiber_log`); idempotent при повторе.
5. **AC-5:** chatRecovery: client потерял соединение → re-attach по
   `recoveryToken` → resume LLM stream без потери tokens (cursor-based replay).
6. **AC-6:** Audit events `agent.coord.*` emit'ятся для всех mutating
   operations с `tenantId`, `coordinatorId`, `op_type`.
7. **AC-7:** Feature flag OFF → client использует ephemeral agent (текущий
   path); zero DO instantiation, zero billing-impact.

## 6. Risks

| Risk | Mitigation |
|---|---|
| DO cold-start latency блокирует UX | Pre-warm для active users; metric `coord.cold_start_ms`; budget 200ms p95. |
| State drift между Electron client + DO | Server-authoritative; client может только запросить `getState()`; conflict resolution via revision number. |
| Replay loop при кривом fiber-коде | Hard cap 5 retries + exponential backoff + circuit breaker; manual unblock через admin tool (WT-37). |
| Cost: per-DO billing растёт при тысячах goals | Hibernation policy (auto-stop при idle > 24h); explicit `archive()` API; metric `coord.active_count`. |
| Recovery token утечка | Token signed HMAC; TTL 5min; one-use (consume on attach); audit "agent.coord.recovery_used". |

## 7. Inspiration repos

1. `cloudflare/agents` — Durable Object-based Agent class (MIT). `dependency` — primary framework.
2. `anthropics/claude-agent-sdk-python` / `anthropics/claude-agent-sdk-typescript` — patterns для recovery + tool-loop (MIT). `reference_only`.
3. `temporalio/sdk-typescript` — durable execution model + workflow replay (MIT). `reference_only` для fiber design.
4. `mastra-ai/mastra` — agent framework с persistent state (Apache-2.0). `reference_only`.
5. `restatedev/restate` — distributed durable invocation (BSL → Apache after time-bomb). `reference_only` для retry semantics.

## 8. Verification protocol

- **Unit:** `bun test tests/unit/agent/coordinator/` — ≥ 25 tests, ≥ 90% coverage.
- **Integration:** Miniflare-based DO harness; full `start → tick → schedule → fiber → cold-restart → recover` cycle.
- **Chaos:** kill DO mid-fiber; concurrent attach storm (50 clients); recovery token race.
- **3-machine:** Electron client integration на mac/win/linux; mock CF endpoint.
- **Cost smoke:** assert `coord.active_count` ≤ N после `archive()` cycle.

## 9. Definition of Done

- [ ] Tests-first commit precedes impl.
- [ ] `bun run typecheck` exit 0.
- [ ] `bun run lint` exit 0.
- [ ] `bun test tests/unit/agent/coordinator/` exit 0 (≥ 25 tests).
- [ ] `bun test tests/integration/agent/coordinator/` exit 0 (≥ 12 scenarios).
- [ ] Miniflare DO suite зелёный (CI matrix).
- [ ] Wrangler example config + production config (sealed secrets) commit'ятся.
- [ ] Audit events emit verified.
- [ ] Feature flag OFF: regression test зелёный (zero DO calls).
- [ ] Linear PZD-116 sub-issues "Ready for Merge".

## 10. Open questions

- (O-1) Hibernation policy idle threshold (12h / 24h / 7d)? — согласовать
  с продактом + finance, см. master Q28.
- (O-2) Allow multiple goals на одного user одновременно? Решение: yes (по
  одному coordinator per goal), но UX-flag "active goal" в WT-34.
- (O-3) Schedule cron grammar — full RFC-5545 или subset? Кандидат subset
  (cron + ISO duration), отложено до review.

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** N/A
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** CoordinatorAgent
- **Events emitted (WT-49 ActivityEvent):** agent.spawned, agent.hibernated
- **AI context implications (WT-48):** coordinator-state
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** AI Tutor/Chat
- **Risk axes:** data, perf
