# WT-29 — Task DAG runner + Workflow bridge — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for implementation (TDD-first)
**Ветка:** `feat/task-dag-runner`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-29-task-dag-runner/`
**Wave:** 3
**Priority:** P0
**Depends on:** WT-28 (Coordinator Agent — runner живёт внутри coordinator)
**Blocks:** WT-30+ (agent fabric features), WT-34 (Agent run UI читает DAG state)
**Parent epic:** PZD-116 (E05 — Design / Agent Answer Package)
**FB board:** Frictionless UX (`6a0db1d3a8e2f070b0c2a234`)
**Feature flag:** `rox.feature.agent-fabric.dag-runner` (default OFF, release cut "Agent Fabric")

---

## 1. Контекст

WT-28 даёт долгоживущий Coordinator Agent с durable state. Чего ещё не
хватает — **языка для описания multi-role задач и runner'а, который их
исполняет**. ROX.ONE 14-role swarm (см. master Section 4) сейчас собирается
вручную внутри каждого WT-spec'а. Чтобы вынести swarm в production-feature
(агенты, которые крутятся за пользователя, не за разработчика), нужен
**Task DAG**:

- nodes = роли (14-role swarm: brainstormer, prompt-writer, test-writer,
  implementer, reviewer, …),
- edges = data-deps (output одного role → input другого),
- ветки могут retry'иться по failure без перезапуска всего DAG,
- cancel какой-либо node останавливает downstream (не upstream),
- progress / partial result доступен в любой момент через coordinator state.

Runner работает в двух модах:
1. **Inline mode** — внутри Coordinator DO (для коротких DAG, < 30s wall-clock).
2. **Bridge mode** — длинные DAG bridged в **Cloudflare Workflows** (durable
   execution с persistent state и observability), результат стримится обратно
   в coordinator.

Inspiration: Cloudflare Workflows, Temporal workflows, Inngest step functions,
`mastra-ai/mastra` workflow engine.

## 2. Цели и нецели

### 2.1 In scope

- `packages/shared/src/agent/dag-runner.ts` — pure runner: topo-sort, schedule,
  per-node retry, cancel propagation; in-memory + persistence hooks.
- `packages/shared/src/agent/dag-types.ts` — `DAG`, `DagNode`, `DagEdge`,
  `NodeResult`, `NodeStatus` (zod schemas).
- `packages/shared/src/agent/dag-builder.ts` — declarative builder с
  валидацией (no cycles, all nodes reachable, role registry compliance).
- `packages/shared/src/agent/role-registry.ts` — каталог 14 ролей из swarm
  + их model defaults (см. master Section 4).
- `infra/cloudflare/workflows-bridge.ts` — bridge layer: converts `DAG` →
  Workflow definition; runs in `WorkflowEntrypoint`; streams events back.
- `infra/cloudflare/wrangler.workflows-bridge.example.toml` + production toml.
- `apps/electron/src/main/agent/dag-bridge.ts` — IPC bridge между renderer
  и coordinator (read-only stream of DAG state).
- Tests: ≥ 30 unit + 15 integration + 4 chaos.

### 2.2 Out of scope

- UI для DAG (диаграмма, taskbar, fiber inspector) → WT-34.
- LLM tool execution внутри nodes — переиспользуем `claude-agent.ts` +
  `agent-answer-router.ts` без модификации.
- Cross-coordinator workflow chaining → backlog.
- Cost tracking per DAG → WT-18.

### 2.3 Forbidden globs

- `apps/electron/src/renderer/**` — UI.
- `infra/cloudflare/coordinator-agent.ts` — WT-28 (consume только, не модифицировать).
- `packages/shared/src/agent/coordinator-*.ts` — WT-28.
- `packages/shared/src/agent/claude-agent.ts` — существующий.
- `packages/shared/src/audit/**` — WT-08 (consume).
- `package.json`, `tsconfig*.json`, `bun.lock` — WT-00.

## 3. Архитектура

```
┌──────────────────────────────────────────────────────────────────┐
│  Renderer  ←──IPC──→  main/agent/dag-bridge                      │
│                              │                                   │
│                              ▼                                   │
│                  Coordinator Agent (WT-28)                       │
│                              │                                   │
│                              ▼ (inline mode)                     │
│         ┌─────────────────────────────────────────────┐          │
│         │  DAGRunner.run(dag, ctx)                    │          │
│         │   ├─ topoSort(nodes)                        │          │
│         │   ├─ schedule ready nodes (in_degree=0)     │          │
│         │   ├─ on node complete → emit event         │           │
│         │   │     → unblock downstream                │          │
│         │   ├─ on node failure → retry policy         │          │
│         │   │     → if exhausted → mark branch failed │          │
│         │   ├─ on cancel(nodeId) → cancel downstream  │          │
│         │   │     (upstream not affected)             │          │
│         │   └─ persist NodeResult в coordinator state │          │
│         └─────────────────────────────────────────────┘          │
│                              │                                   │
│                              ▼ (bridge mode, > 30s)              │
│            Cloudflare Workflows (workflows-bridge.ts)            │
│              WorkflowEntrypoint:                                 │
│                step("brainstormer", async () => {...})           │
│                step("prompt-writer", async () => {...})          │
│                ...                                               │
│              → Workflow events stream back to coordinator        │
│                через ctx.waitUntil + WebSocket pipe             │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1 DAG schema (zod)

```ts
const DagNode = z.object({
  id: z.string().min(1),
  role: z.enum(['brainstormer', 'requirements-keeper', 'scope-analyzer',
    'critic', 'prompt-writer', 'architect', 'ux-guru', 'test-writer',
    'implementer', 'super-coder', 'reviewer', 'verifier', 'integrator',
    'optimizer']),                       // 14 ролей
  inputs: z.record(z.string()),          // имена upstream node id → field
  spec: z.object({
    model: z.enum(['haiku', 'sonnet', 'opus']).optional(),
    timeout_ms: z.number().int().positive().default(60000),
    retry: z.object({
      max: z.number().int().min(0).max(5).default(2),
      backoff_ms: z.number().int().min(0).default(1000),
      strategy: z.enum(['exponential', 'linear']).default('exponential'),
    }).default({}),
  }),
});

const DAG = z.object({
  id: z.string(),
  goal_id: z.string().uuid(),
  nodes: z.array(DagNode).min(1),
  edges: z.array(z.object({
    from: z.string(),                    // node id
    to:   z.string(),                    // node id
    field: z.string(),                   // input field on `to`
  })),
});
```

Builder валидирует: (a) no cycles (Tarjan), (b) all edges referenced node ids
present, (c) каждый `to.inputs[field]` хотя бы одной edge заполнен, (d) роль
в registry, (e) max 50 nodes per DAG (chunking guard).

### 3.2 Node lifecycle

```
                 ┌──────────┐
                 │  pending │
                 └────┬─────┘
                      │ in_degree==0
                      ▼
                 ┌──────────┐
                 │ scheduled│
                 └────┬─────┘
                      │ runner pulls
                      ▼
                 ┌──────────┐    fail
                 │ running  │──────────┐
                 └────┬─────┘          │
                      │ ok            ▼
                      ▼          ┌──────────┐
                 ┌──────────┐    │ retrying │
                 │ succeeded│    └────┬─────┘
                 └──────────┘         │ retries exhausted
                                      ▼
                                 ┌──────────┐
                                 │ failed   │
                                 └──────────┘
                 cancel propagates downstream:
                 succeeded/running upstream → not affected
                 pending/scheduled downstream → status=cancelled
```

### 3.3 Bridge mode trigger

Если `estimatedDuration(dag) > 30s` ИЛИ `dag.nodes.length > 12` ИЛИ
`dag.flags.long_running === true` → bridge mode.

Workflows-bridge получает DAG, эмитирует Workflow definition с одним step
per node (плюс gating step для join points). Coordinator подписывается на
output через `executionId`; renderer видит the same stream через
coordinator state subscription.

### 3.4 Ключевые файлы (files_allowed)

- `packages/shared/src/agent/dag-runner.ts`
- `packages/shared/src/agent/dag-builder.ts`
- `packages/shared/src/agent/dag-types.ts`
- `packages/shared/src/agent/role-registry.ts`
- `packages/shared/src/agent/dag-events.ts`
- `packages/shared/src/agent/index.ts` (только re-export новых entry points)
- `infra/cloudflare/workflows-bridge.ts`
- `infra/cloudflare/wrangler.workflows-bridge.example.toml`
- `infra/cloudflare/wrangler.workflows-bridge.toml`
- `infra/cloudflare/__tests__/workflows-bridge.test.ts`
- `apps/electron/src/main/agent/dag-bridge.ts`
- `tests/unit/agent/dag/**`
- `tests/integration/agent/dag/**`

## 4. TDD план (≥ 5 tests-first)

| # | Test name | What it asserts |
|---|---|---|
| T1 | `topoSort orders linear DAG correctly` | A→B→C order = [A,B,C]; reverse order rejected. |
| T2 | `topoSort rejects cycles` | A→B→A → `DagValidationError{kind:'cycle'}`. |
| T3 | `runner schedules parallel ready nodes` | Diamond A→{B,C}→D: B и C scheduled параллельно, D ждёт обоих. |
| T4 | `node failure retries with exponential backoff` | Inject 2 fails → 2 retries (1s/2s); succeed on 3rd; attempt count tracked. |
| T5 | `retry exhausted marks branch failed and propagates cancel` | 3 fails → node failed; downstream nodes auto-cancelled. |
| T6 | `cancel propagates downstream but not upstream` | A→B→C; cancel(B) → A succeeded, B/C cancelled. |
| T7 | `inline mode runs <30s DAG without bridge` | Small DAG → bridge не invoked; stub fails test if bridge called. |
| T8 | `bridge mode triggers for long DAG and streams back` | DAG.flags.long_running=true → Workflow created; events stream-back через mock pipe. |
| T9 | `DAG schema rejects unknown role` | role='undefined-role' → zod error; role registry single source of truth. |
| T10 | `max 50 nodes per DAG enforced` | 51 nodes → `DagValidationError{kind:'too_large'}`. |
| T11 | `coordinator state contains live NodeResult progress` | After 2 nodes succeeded → coordinator.state.dagResults[id] has 2 entries; partial-readable. |
| T12 | `feature flag OFF: dag-bridge returns DISABLED` | `rox.feature.agent-fabric.dag-runner=false` → bridge no-op; client gets `Result.err('DISABLED')`. |
| T13 | `concurrent cancel + complete: cancel wins for non-yet-started downstream` | Race test: cancel(B) just before B completes → downstream still cancelled. |
| T14 | `Workflows bridge replay survives DO restart` | Bridge mode + simulate restart → Workflow continues; coordinator picks up из stored `executionId`. |
| T15 | `audit events emitted: dag.started/node.started/node.completed/node.failed/dag.completed` | Все 5 event types на full happy path. |

Tests-first commit `test(agent/dag): failing tests for DAG runner + workflows bridge`.

## 5. Acceptance Criteria (≥ 5)

1. **AC-1:** Builder валидирует DAG до запуска: cycles, missing inputs,
   unknown roles, >50 nodes — отклоняются с типизированным error code.
2. **AC-2:** Runner поддерживает parallel scheduling; ready nodes (in_degree=0)
   стартуют одновременно вплоть до `max_parallel=8` (per coordinator).
3. **AC-3:** Per-node retry — конфигурируем (max, backoff, strategy);
   per-branch failure не убивает успешные параллельные ветки.
4. **AC-4:** Cancel — directional: только downstream stop'ятся; upstream и
   parallel-siblings продолжают; audit-event `dag.node_cancelled` с reason.
5. **AC-5:** Inline mode и bridge mode имеют идентичный observable contract
   (events, NodeResult shape); switch прозрачен для caller.
6. **AC-6:** State persists в coordinator (WT-28) после каждого node-event;
   partial-result доступен через `coordinator.state.dagResults`.
7. **AC-7:** Feature flag OFF: `dagRunner.run()` → `Result.err({code:'DISABLED'})`;
   zero Workflows invocations; zero billing impact.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Tree explosion (DAG генерирует sub-DAG) | Hard cap 50 nodes; nested DAG запрещён в v1; flatten требуется на builder-side. |
| Bridge mode latency (Workflow cold start) | Pre-warm для активных tenants; metric `workflow.cold_start_ms`; threshold чтобы inline mode брал больше work. |
| Cost runaway: retry storm | Per-coordinator budget cap (max retries в DAG = 20); circuit breaker. |
| State drift: inline result не синхронизирован с bridge | Single source of truth: coordinator state; runner всегда пишет через `coordinator.appendResult()`. |
| Race на cancel mid-flight | Cancel токен передаётся в node fn; node-code обязан проверять `signal.aborted` в long ops. |

## 7. Inspiration repos

1. `cloudflare/workflows` — durable execution platform (proprietary, через `WorkflowEntrypoint` API). `dependency` — primary bridge target.
2. `temporalio/sdk-typescript` — workflow primitives + cancel propagation (MIT). `reference_only`.
3. `inngest/inngest` — step functions с retry/durable steps (Apache-2.0). `reference_only`.
4. `mastra-ai/mastra` — workflow engine для agentic systems (Apache-2.0). `reference_only`.
5. `dagster-io/dagster` — DAG-based orchestration patterns (Apache-2.0). `reference_only` для schema design.

## 8. Verification protocol

- **Unit:** `bun test tests/unit/agent/dag/` — ≥ 30 tests, ≥ 90% coverage.
- **Integration:** Miniflare для Workflows-bridge mock + DO; full inline + bridge cycle.
- **Chaos:** cancel storm (50 concurrent cancels), retry budget exhaustion, bridge mid-flight reconnect.
- **3-machine:** Electron client integration на mac/win/linux.
- **Audit:** все 5 event types emit'ятся; spy fixture verifies.

## 9. Definition of Done

- [ ] Tests-first commit precedes impl.
- [ ] `bun run typecheck` exit 0.
- [ ] `bun run lint` exit 0.
- [ ] `bun test tests/unit/agent/dag/` exit 0 (≥ 30 tests).
- [ ] `bun test tests/integration/agent/dag/` exit 0 (≥ 15 scenarios).
- [ ] Workflows-bridge Miniflare suite зелёный.
- [ ] Wrangler example + production config commit'ятся.
- [ ] Audit events emit verified.
- [ ] Feature flag OFF: regression test зелёный.
- [ ] Role registry содержит все 14 ролей с model defaults.
- [ ] Linear PZD-116 sub-issues "Ready for Merge".

## 10. Open questions

- (O-1) Max parallel scheduling per coordinator (4 / 8 / 16)? — зависит от
  DO single-thread limits, default 8, hot-reloadable.
- (O-2) Nested DAG (sub-workflow) — v1 запрещён; нужен ли в v2? Решение
  отложено до пользовательской обратной связи (WT-34 UI).
- (O-3) Cancel semantics для node, который сейчас вызывает LLM stream — abort
  signal или soft-cancel-at-next-token? Решение: soft (token-boundary).
