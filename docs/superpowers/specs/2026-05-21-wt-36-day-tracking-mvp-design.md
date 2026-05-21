# WT-36 — Day Tracking MVP — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for implementation (TDD-first)
**Ветка:** `feat/day-tracking-mvp`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-36-day-tracking-mvp/`
**Wave:** 2
**Priority:** P1
**Depends on:** WT-06 (workspace contract)
**Blocks:** —
**Parent epic:** PZD-122 (E11 Workspaces / Personal Knowledge)
**FB board:** Frictionless UX (`6a0db1cbb0bb70b5d8d3f893`)
**Feature flag:** `rox.feature.day-tracking` (default OFF, release cut "UI")

---

## 1. Контекст

Пользователь ROX.ONE проводит весь день в десктопном приложении, но **никакой view «как прошёл день» не существует**: куда уходят часы, какие сессии завершились, какой output получился — всё разлито по логам, артефактам и tasks. WT-36 строит минимальную панель «Today», которая агрегирует уже существующие данные (агентские сессии, артефакты, tasks, calendar placeholder) и добавляет один новый источник — **manual focus sessions** (Pomodoro-style start/stop с категорией).

Это НЕ time tracker уровня RescueTime: никакого screen-tracking ОС, никакого keyboard logger, никакой шпионской телеметрии. Только то, что пользователь сам инициировал.

## 2. Цели и нецели

### 2.1 In scope

- «Today» view: единый timeline + summary cards (4-6 виджетов).
- Manual focus sessions: start/stop с категорией (work / learning / writing / meeting / break / other).
- Aggregated timeline: agent sessions (ROX agents), focus sessions, task completions, manual events.
- Daily review: markdown editor (reuse Notes BlockEditor из WT-35) + кнопка «AI Daily Summary».
- Link to tasks / notes / calendar placeholder (показывает «coming soon» если no provider).
- Persistence: `~/.rox/workspaces/{ws}/day-tracking/{YYYY-MM-DD}/timeline.json` + `review.md`.
- i18n RU/EN.

### 2.2 Out of scope

- OS screen / app tracking (RescueTime, ActivityWatch) — defer until explicit user consent UX готов.
- Calendar integration реально с Google/MS — placeholder only (WT-40 spike).
- Team-shared dashboards / leaderboards — defer.
- Goal-setting / habit tracking / streaks — defer.
- Mobile companion — out of cycle.
- Pomodoro-style notifications с принудительными перерывами — soft hint only.

## 3. Архитектура

```
┌──────────────────────────────────────────────────────────────────┐
│ Renderer: TodayPage (apps/electron/src/renderer/pages/today/)    │
│  ├─ TimelineColumn — chronological list of events                │
│  ├─ SummaryCards — focus minutes, agent sessions, tasks done     │
│  ├─ FocusSessionControl — start/stop + category picker            │
│  ├─ DailyReviewEditor — markdown / blocks (BlockEditor reuse)    │
│  └─ AiSummaryButton — invokes prompts/daily-summary.md           │
└──────────────────────┬───────────────────────────────────────────┘
                       │ IPC: day-tracking:*
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ Main: apps/electron/src/main/day-tracking/                       │
│  ├─ tracker-service.ts — focus session lifecycle                 │
│  ├─ timeline-aggregator.ts — merges agent / task / focus events  │
│  └─ daily-review-service.ts — review.md persistence               │
└──────────────────────┬───────────────────────────────────────────┘
                       │ reads (no write):
                       ▼
   ├─ packages/shared/src/sessions/ (agent sessions index)
   ├─ packages/shared/src/agent/    (task completion events)
   └─ Notes (WT-35) blocks read API
                       │
                       ▼
   ~/.rox/workspaces/{ws}/day-tracking/{YYYY-MM-DD}/
      ├─ focus-sessions.json   (append-only)
      ├─ timeline.json          (computed, cached)
      └─ review.md              (user-authored)
```

### 3.1 Ключевые файлы (files_allowed)

- `apps/electron/src/renderer/pages/today/**`
- `apps/electron/src/main/day-tracking/**`
- `apps/electron/src/main/ipc/day-tracking-handlers.ts`
- `packages/shared/src/day-tracking/**`
- `tests/unit/day-tracking/**`
- `tests/integration/day-tracking/**`
- `apps/electron/src/main/locales/en.day-tracking.json`
- `apps/electron/src/main/locales/ru.day-tracking.json`

### 3.2 files_forbidden

- `packages/shared/src/sessions/**` — read-only reuse.
- `packages/shared/src/agent/**` — read-only reuse.
- `apps/electron/src/renderer/pages/notes/**` — owned by WT-35 (мы импортируем только BlockEditor primitive).
- `package.json`, `tsconfig*.json`, `bun.lock` — scaffold-extension к WT-00.
- `packages/shared/src/feature-flags.ts` — owned by WT-07.

### 3.3 Scaffold-extension requests

- WT-00: add `date-fns@^3.6.0` для timezone-aware date math.
- WT-07: register flag `rox.feature.day-tracking` в `feature-flags.ts`.
- WT-35: export `BlockEditor` component для reuse в DailyReviewEditor (read-only import).

## 4. TDD план (≥ 5 tests-first)

| # | Test name | What it asserts |
|---|---|---|
| T1 | `starts focus session and persists start event` | `dayTracking.startFocus({ category: 'work' })` → append-only json содержит запись с `startedAt`, `category`, `id`. |
| T2 | `stops focus session and computes duration_ms` | После `stop(id)` — запись содержит `endedAt`, `durationMs > 0`, derived `category`. |
| T3 | `aggregates timeline from agent sessions + focus + tasks` | Mock 2 agent sessions + 1 focus + 1 task → timeline.json содержит 4 events, отсортированных по timestamp. |
| T4 | `daily review markdown persists and round-trips` | Save `review.md` → read возвращает идентичный markdown. |
| T5 | `AI Daily Summary invokes agent-fabric with timeline + review` | Click → prompt получает timeline.json + review.md как context; результат записан в `review.md` как secondary block. |
| T6 | `timezone boundary respects user preferences` | User TZ=Europe/Moscow; event at 23:55 local → попадает в today; event at 00:05 local → в tomorrow. |
| T7 | `feature flag OFF hides Today nav and IPC returns FEATURE_DISABLED` | При `rox.feature.day-tracking=false` — sidebar entry скрыт; IPC `day-tracking:*` отвечает ошибкой. |
| T8 | `concurrent focus sessions disallowed` | Попытка `startFocus` при активной сессии → `Result.err({ code: 'ALREADY_ACTIVE' })`. |
| T9 | `calendar placeholder renders coming-soon when no provider` | TimelineColumn показывает badge «Calendar integration coming soon» при `providers.calendar.length === 0`. |

Все тесты commit-ятся первым коммитом `test(day-tracking): failing tests for MVP` ДО любого impl-кода.

## 5. Acceptance Criteria (≥ 5)

1. **AC-1:** Manual focus sessions имеют lifecycle `idle → active → ended`; одна активная сессия за раз; persists append-only.
2. **AC-2:** Timeline объединяет минимум 3 источника (agent sessions, focus sessions, completed tasks) с единым `TimelineEvent` контрактом (`{ id, kind, startedAt, endedAt, label, refId }`).
3. **AC-3:** Daily review хранится как markdown; используется `BlockEditor` из WT-35 (read-only import), без дублирования кода.
4. **AC-4:** AI Daily Summary — single prompt, не более 4k input tokens; результат aпендится к `review.md` под секцией `## AI Summary` с timestamp.
5. **AC-5:** Timezone-aware: «today» определяется по user preference TZ; UTC хранение, локальный display.
6. **AC-6:** Calendar placeholder отображается с явной надписью «Coming soon» и ссылкой на WT-40 changelog.
7. **AC-7:** Feature flag OFF → нулевое UI, IPC, audit, нулевые читающие вызовы к sessions/agent shared модулям.
8. **AC-8:** Никаких background processes для OS-screen-tracking; чистый sweep `git grep -i "activewindow\|screencapture\|keylogger"` возвращает ноль.

## 6. Risks

| Risk | Mitigation |
|---|---|
| User confuses focus-session с agent-session | UX-guru wireframe + explicit category icons + tooltip. |
| Timeline aggregator perf при 1000+ events/day | Computed cache `timeline.json`; rebuild lazy. |
| Daily review двойная запись от AI Summary | Префикс `## AI Summary {iso-ts}` + idempotency на iso-ts. |
| Privacy concerns "вы шпионите?" | Documentation explicitly states "no screen/keyboard tracking"; security review WT-44 не требуется. |
| Conflict с WT-35 BlockEditor API | Зафиксировать минимальный read-only interface в WT-35 как public; integration test. |
| Time zone drift на DST переходах | date-fns + property tests на DST boundary. |

## 7. Inspiration repos

1. `ActivityWatch/activitywatch` — local-first time tracker архитектура (reference_only, MPL-2.0; берём только концепцию append-only events).
2. `toggl/track-cli` — Pomodoro-style focus session UX (reference_only).
3. `simonw/datasette` — timeline view patterns (reference_only).
4. `obsidianmd/obsidian-releases` — daily notes UX inspiration (reference_only).
5. `date-fns/date-fns` — timezone math (dependency).

## 8. Verification protocol

- **Unit:** `bun test tests/unit/day-tracking/` — 9 tests above.
- **Integration:** `bun test tests/integration/day-tracking/` — IPC, timezone, aggregator merging.
- **3-machine:** screenshot Today page (empty / mid-day / end-of-day) на mac-14-arm, windows-2022, ubuntu-22.
- **Smoke:** `day-tracking-start-stop-review` E2E (focus start → 5s → stop → review save → AI summary).
- **Privacy sweep:** grep gate ensures no `activeWindow`, `screencapture`, `keylogger` symbols introduced.

## 9. Definition of Done

- [x] Tests-first commit precedes any impl commit.
- [x] `bun run typecheck` exit 0.
- [x] `bun run lint` exit 0.
- [x] `bun test tests/unit/day-tracking/` + integration exit 0 (≥9 tests).
- [x] Bundle budget renderer increase ≤ 60 KB.
- [x] Privacy sweep clean.
- [x] Feature flag OFF: zero IPC, zero UI surface.
- [x] Screenshots Today page на 3 OS приложены в evidence/wt-36/.
- [x] Locales RU/EN — 100% coverage.
- [x] Linear PZD sub-issue moved to "Ready for Merge".

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** start-focus-session, daily-review
- **UI surfaces affected:** TodayView, FocusSession
- **Entities touched (WT-46 references):** FocusSession
- **Events emitted (WT-49 ActivityEvent):** focus.started, focus.completed
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** Journals adjacent
- **Risk axes:** UI
