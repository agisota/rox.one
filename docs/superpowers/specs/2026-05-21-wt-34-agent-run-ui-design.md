# WT-34 — Agent Run UI command center — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for Phase 1 (Discovery)
**Branch:** `feat/agent-run-ui`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-34-agent-run-ui/`
**Wave:** 2 (UI cut)
**Priority:** P0
**Depends on:** WT-28 (Coordinator), WT-29 (DAG runner), WT-31 (Realtime WS)
**Blocks:** —
**Parent epic:** PZD-112 (E01 — Composer / Command Center)
**FB board:** Frictionless UX
**Feature flag:** `rox.feature.agent-run-ui.v1` (default OFF, release cut "UI")

---

## 1. Контекст и цель

Currently agent run-ы видны через текстовый log в Activity panel — нет
визуального графа задач, нет per-task cost/duration, нет inline approval
prompts, retry-failed-branch требует CLI. Это блокирует Frictionless UX (Mission
Control vision из T045) и расходует токены на debugging "что сейчас делает
агент".

**Цель WT-34** — единый «командный центр» агентского run-а:

1. **Run timeline** — Mermaid-like DAG view с node-per-task; status цвет +
   icon (`queued/running/done/failed/skipped`).
2. **Per-task chip:** status / cost / duration / artifact count;
   click → side-panel с подробностями.
3. **Inline approval prompts:** когда coordinator ждёт `human-in-the-loop`
   (Permission Mode UI indicator — см. WT-37 open question), UI показывает
   inline-approve / reject buttons.
4. **Retry-failed-branch:** клик на failed node → action "retry this branch"
   (отправляет DAG runner mutation re-enqueue).
5. **Result artifact panel:** список артефактов от run-а (через WT-32 store);
   inline previews (text/image/json).
6. **Real-time updates:** все обновления через `useAgentStream` (WT-31), zero
   polling.

После merge — флаг OFF; release cut "UI" включает для всех; legacy Activity
panel остается под флагом 1 release, потом удаляется.

## 2. Скоуп

### 2.1 Входит

- `apps/electron/src/renderer/components/agent-run/AgentRunCenter.tsx` —
  главный layout (left: timeline DAG, right: side-panel).
- `apps/electron/src/renderer/components/agent-run/RunTimeline.tsx` —
  DAG visualization (использует existing `@xyflow/react` или fallback на
  custom SVG).
- `apps/electron/src/renderer/components/agent-run/TaskNode.tsx` —
  node renderer (status badge, cost label, duration).
- `apps/electron/src/renderer/components/agent-run/TaskSidePanel.tsx` —
  task details (input/output/logs).
- `apps/electron/src/renderer/components/agent-run/InlineApprovalPrompt.tsx` —
  approve/reject UI.
- `apps/electron/src/renderer/components/agent-run/RetryBranchButton.tsx` —
  action button + confirmation dialog.
- `apps/electron/src/renderer/components/agent-run/ArtifactPanel.tsx` —
  список артефактов, превью.
- `apps/electron/src/renderer/components/agent-run/__tests__/**` — RTL.
- `apps/electron/src/renderer/hooks/useAgentRun.ts` — composite hook
  (`useAgentStream` + `useArtifactList`) с derivation `dagFromEvents`.
- `apps/electron/src/renderer/hooks/__tests__/useAgentRun.test.tsx`.
- `packages/shared/src/agent-run-view/dag-builder.ts` — pure function
  `buildDagFromEvents(events) → DagView` (nodes + edges + statuses).
- `packages/shared/src/agent-run-view/types.ts` — `DagView`, `TaskNodeData`,
  `EdgeData`.
- `packages/shared/src/agent-run-view/index.ts`.
- `apps/electron/src/renderer/locales/{en,ru}/agent-run.json` — locale keys.
- `tests/unit/agent-run-view/**` — pure unit tests for dag-builder.
- `tests/integration/renderer/agent-run/**` — Vitest + RTL.
- `tests/e2e/agent-run-ui.spec.ts` — Playwright happy path.
- `wt-meta/wt-34.yaml`.

### 2.2 Вне скоупа

- Backend changes — WT-28/29/30/31/32 уже выставили contracts.
- Cost ledger backend — WT-29 (читаем через event payload).
- Permission Mode UI indicator badge — WT-37.
- Tenant admin UI — WT-17.

### 2.3 Forbidden globs

- `infra/cloudflare/**` (WT-28/29/30/31/32 owners).
- `packages/shared/src/agent-fabric/**` (WT-28/29/30/31 owners).
- `packages/shared/src/evidence/**` (WT-32 owner).
- `apps/electron/src/renderer/components/composer/**` (WT-33 owner).
- `package.json`, `tsconfig*.json`, `bun.lock` (WT-00).

## 3. Архитектура

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AgentRunCenter.tsx                                                     │
│    │                                                                    │
│    ├─ useAgentRun(runId)                                                │
│    │     ├─ useAgentStream(runId) (WT-31)                               │
│    │     ├─ useArtifactList(runId)  (WT-32 HTTP API)                    │
│    │     └─ derived dagView = buildDagFromEvents(events)                │
│    │                                                                    │
│    ├─ <RunTimeline dag={dagView} onNodeClick={selectTask} />            │
│    │     uses @xyflow/react for DAG layout                              │
│    │     auto-layout (dagre or elk)                                     │
│    │     status colors: gray(queued) blue(running) green(done) red(failed)│
│    │                                                                    │
│    ├─ <TaskSidePanel task={selectedTask}                                │
│    │       artifacts={artifactsForTask}                                 │
│    │       onRetry={retryBranch} />                                     │
│    │                                                                    │
│    ├─ <InlineApprovalPrompt visible={pendingApproval}                   │
│    │       onApprove onReject />                                        │
│    │                                                                    │
│    └─ <ArtifactPanel artifacts={artifactsForRun} />                     │
│         inline preview for json/text/png ≤ 50 KB                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 `DagView` model

```ts
export interface TaskNodeData {
  taskId:        string;
  role:          string;
  status:        'queued' | 'running' | 'done' | 'failed' | 'skipped';
  startedAt?:    string;
  completedAt?:  string;
  durationMs?:   number;
  costUsd?:      number;
  artifactIds:   string[];
  error?:        string;
  attempt:       number;
}

export interface EdgeData {
  fromTaskId:    string;
  toTaskId:      string;
}

export interface DagView {
  runId:         string;
  status:        'queued' | 'running' | 'success' | 'partial' | 'failed';
  nodes:         TaskNodeData[];
  edges:         EdgeData[];
  totalCostUsd:  number;
  totalDurationMs: number;
}
```

### 3.2 `buildDagFromEvents`

Pure function: principio events log → DagView. Idempotent, deterministic.

- При `task.queued` → upsert node со status=`queued`.
- При `task.started` → set `status='running'`, `startedAt`.
- При `task.tool_call` → append to per-task tool-calls list (для side-panel).
- При `task.completed` → status=`done`, set `durationMs`, `costUsd`,
  `artifactIds`.
- При `task.failed` → status=`failed`, set `error`, `attempt`.
- При `run.completed` → set run-level status.

Edges берутся из coordinator metadata (через initial REST fetch
`/api/runs/:id/dag` — coordinator выставит это в WT-28).

### 3.3 Retry-failed-branch flow

1. User clicks failed `TaskNode` → side panel показывает `Retry branch` button.
2. Click → confirmation dialog "Retry from this task and all downstream?"
3. Approve → POST `/api/runs/:id/tasks/:taskId/retry` (endpoint в WT-29).
4. Coordinator ре-enqueue failed task + cascade в downstream. Real-time stream
   автоматически обновляет UI.

### 3.4 Inline approval

WT-29 emit-ит event `task.awaiting_approval` (отдельный — добавлен в WT-31
event schema через **scaffold-extension request** к WT-31). UI показывает
modal с context + Approve/Reject buttons. POST на
`/api/runs/:id/tasks/:taskId/approve|reject` → coordinator продолжает /
abort branch.

### 3.5 Ключевые файлы (files_allowed)

См. 2.1.

### 3.6 Scaffold-extension requests

- WT-00: `@xyflow/react@^12` (dep, DAG layout).
- WT-00: `dagre@^0.8` или `elkjs@^0.9` (dep, auto-layout). Решение в
  Phase 2 (UX-guru ratifies).
- WT-31: добавить `task.awaiting_approval` event type в schema.
- WT-29: добавить REST endpoint `/api/runs/:id/dag` (initial fetch) +
  `/api/runs/:id/tasks/:taskId/{retry,approve,reject}`.
- WT-20: locale keys `agent-run.timeline.*`, `agent-run.actions.*`,
  `agent-run.empty.*`.

## 4. TDD план (≥ 5)

| # | Test | Что проверяет |
|---|---|---|
| T1 | `buildDagFromEvents constructs nodes from task.queued events` | Pure unit: feed 3 `task.queued` events → DagView с 3 nodes status=`queued`. |
| T2 | `buildDagFromEvents transitions status on lifecycle events` | task.queued → started → completed → final node `done` с `durationMs` + `costUsd`. |
| T3 | `RunTimeline renders DAG with correct status colors` | RTL: 5 nodes с разными статусами → screenshot snapshot OR DOM check `data-status` атрибутов. |
| T4 | `Click failed node opens side panel with Retry button` | RTL: failed node click → side panel `getByRole('button', { name: /retry/i })` visible. |
| T5 | `Retry button POSTs to coordinator endpoint` | mock fetch → click Retry → confirmation Yes → 1 fetch call to `/api/runs/:id/tasks/:taskId/retry`. |
| T6 | `InlineApprovalPrompt visible on task.awaiting_approval event` | feed event → prompt renders с context message; Approve/Reject buttons interactive. |
| T7 | `ArtifactPanel previews JSON inline for ≤ 50 KB artifact` | mock artifact metadata + body → `<pre>` с pretty-printed JSON visible. |
| T8 | `useAgentRun reconnects on WS disconnect and replays events` | mock WS disconnect → reconnect → `events` array contains all originals (no dupes). |
| T9 | `Feature flag OFF: AgentRunCenter renders legacy ActivityPanel` | flag=false → ActivityPanel; flag=true → AgentRunCenter. |
| T10 | `a11y: DAG keyboard nav with Tab → next node, Enter → select` | jest-axe + manual Tab traversal — 0 violations. |

Все commit-ятся первым коммитом
`test(agent-run-ui): failing tests for timeline, side-panel, retry, approval`.

## 5. Acceptance Criteria (≥ 5)

- [ ] **AC-1:** `<RunTimeline />` рендерит DAG nodes + edges с layout
      detected auto (dagre/elk); supports zoom + pan; preserves run.status
      visual.
- [ ] **AC-2:** Real-time updates через `useAgentStream` (WT-31); UI обновляется
      ≤ 1s после события.
- [ ] **AC-3:** Per-task chip показывает status / cost (`$X.XXXX`) / duration
      (`X.Xs`) / artifact count.
- [ ] **AC-4:** Inline approval prompt появляется при `task.awaiting_approval`
      event; Approve/Reject POST-ит правильные endpoints; UI скрывает prompt
      после ответа.
- [ ] **AC-5:** Retry-failed-branch button работает; confirmation dialog +
      POST endpoint; UI визуально показывает re-enqueue.
- [ ] **AC-6:** ArtifactPanel показывает все артефакты run-а; inline preview
      для JSON/text ≤ 50 KB, image (PNG/JPG ≤ 2 MB); download link для остальных.
- [ ] **AC-7:** При `rox.feature.agent-run-ui.v1=false` рендерится legacy
      ActivityPanel; zero new code paths.
- [ ] **AC-8:** Bundle delta ≤ 120 KB gzip на renderer chunk (включая
      @xyflow/react + dagre).
- [ ] **AC-9:** WCAG 2.2 AA: axe-core 0 violations; full keyboard navigation
      по DAG (Tab → nodes, Enter → select, Esc → close panel).
- [ ] **AC-10:** Audit events `agent_run.viewed`, `agent_run.retry_requested`,
      `agent_run.approval_granted`, `agent_run.approval_rejected` emit-ятся
      через WT-08 sink.

## 6. Risks

| Risk | Mitigation |
|---|---|
| `@xyflow/react` bundle weight (~100 KB) | Lazy load chunk `agent-run-ui`; tree-shake unused features. |
| DAG layout slow для > 100 nodes | dagre + memoization; в Phase 5 — WebWorker offload. |
| WS reconnect storm при flaky network | Hook `useAgentRun` использует `useAgentStream` с built-in exp backoff (WT-31). |
| Race condition: approval clicked twice | Disable button после первого click + idempotency check на backend (WT-29 owns). |
| Artifact preview XSS risk | Render JSON через text-only viewer (`<pre>{JSON.stringify}</pre>`); no raw HTML injection; markdown — через safe renderer + DOMPurify. |
| Tenant isolation: cross-tenant runId | useAgentRun проверяет tenantScope через `useSession`; cross-tenant → empty state + audit `agent_run.cross_tenant_blocked`. |

## 7. Inspiration repos

| Repo | Integration type | Зачем |
|---|---|---|
| `xyflow/xyflow` (`@xyflow/react`) | dependency | DAG layout primitives (nodes, edges, zoom, pan, minimap). |
| `dagrejs/dagre` | dependency | Auto-layout algorithm для DAG. |
| `n8n-io/n8n` | reference_only | Workflow run timeline UX — per-node status badges + side-panel pattern. |
| `windmill-labs/windmill` | reference_only | Agent run visualization + retry-branch action. |
| `temporalio/web` | reference_only | Workflow execution UI: timeline, inline approval, artifact panel. |
| `mermaid-js/mermaid-live-editor` | reference_only | Mermaid-like DAG renderer fallback (если xyflow выгрузим в v2). |

## 8. Phase 5 swarm distribution

| Phase | Роли | Модель |
|---|---|---|
| Discovery | brainstormer, requirements-keeper, scope-analyzer, critic | opus-4.7-max |
| Design | prompt-writer, architect, **ux-guru** | opus-4.7-max |
| Impl tests | test-writer | opus-4.7-max |
| Impl code | implementer, super-coder | sonnet-4.6-medium |
| Impl review | reviewer | opus-4.7-max |
| Verification | verifier, critic, integrator | opus-4.7-max |
| Optimization | optimizer, 10x-improver | opus-4.7-max |

**UX-guru активен** — design Mission Control look (`design/03-ux-spec.md`):
DAG layout, color palette per status, side-panel layout, artifact preview tokens.

## 9. Связи

- **Зависит от:** WT-28 (coordinator REST + DAG metadata API), WT-29 (DAG
  runner + retry/approve endpoints), WT-31 (realtime WS + useAgentStream hook),
  WT-32 (artifact API).
- **Транзитивные scaffold-requests:**
  - WT-31: добавить `task.awaiting_approval` event type.
  - WT-29: добавить REST endpoints `/dag`, `/tasks/:id/retry`,
    `/tasks/:id/approve|reject`.
- **Блокирует:** — (terminal UI WT в Wave 2).

## 10. Verification protocol

- **Unit:** Pure tests для `buildDagFromEvents`, `dag-layout` adapters = 10
  tests above (5 unit, 5 RTL/E2E).
- **RTL:** `RunTimeline`, `TaskSidePanel`, `InlineApprovalPrompt`,
  `RetryBranchButton`, `ArtifactPanel`.
- **E2E:** Playwright happy path — flag ON → workspace → submit prompt →
  открыть run → timeline растёт live → click node → side panel → retry
  failed branch → confirm → UI обновляется.
- **3-machine:** Electron build + screenshots на всех 3 OS:
  - mac-14-arm: `agent-run-ui-mission-control.png` (full UI).
  - windows-2022: smoke + DAG render + retry click.
  - ubuntu-22: AppImage smoke + axe-core JSON report.
- **a11y:** jest-axe 0 violations; manual keyboard nav full traversal;
  screen reader spot-check (VoiceOver на mac, NVDA на Win).

## 11. Open questions

- (O-1) Layout engine: dagre vs elkjs? Dagre быстрее (~5x), elk даёт лучший
  ortho layout. UX-guru решает в Phase 2.
- (O-2) Inline approval timeout — auto-reject через 5 минут или wait
  indefinitely? Согласовать с WT-29 (state machine).
- (O-3) Artifact preview limits: 50 KB JSON, 2 MB image — финальные числа
  тюнить с WT-32 (bandwidth cost).
- (O-4) Run history list (предыдущие runs того же workspace) — в этом WT
  или отдельный? Решение: side-bar list — в WT-34; full search — отложено.
- (O-5) Mobile responsive: вертикальный DAG layout < 768px viewport?
  Решение от UX-guru.

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** watch-agent-run, retry-failed-branch, approve-step
- **UI surfaces affected:** AgentRunDAG, Timeline
- **Entities touched (WT-46 references):** N/A
- **Events emitted (WT-49 ActivityEvent):** run.opened, branch.retried.user_initiated
- **AI context implications (WT-48):** run-context
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** UI, perf
