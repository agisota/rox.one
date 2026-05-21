# WT-35 — Notes / Knowledge MVP — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for implementation (TDD-first)
**Ветка:** `feat/notes-mvp`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-35-notes-mvp/`
**Wave:** 2
**Priority:** P1
**Depends on:** WT-06 (workspace contract), WT-23 (storage backend)
**Blocks:** —
**Parent epic:** PZD-122 (E11 Workspaces / Personal Knowledge)
**FB board:** Frictionless UX (`6a0db1cbb0bb70b5d8d3f893`)
**Feature flag:** `rox.feature.notes-mvp` (default OFF, release cut "UI")

---

## 1. Контекст

ROX.ONE сегодня хранит много неструктурированных артефактов (агентские сессии, artifacts, tasks, prompts) — но **нет места, где пользователь сам пишет**. Любая сторонняя «вторая память» (Obsidian, Notion, Apple Notes) разрывает контекст ROX-сессии и заставляет переключать окно. WT-35 закрывает этот пробел минимальным Notes / Knowledge модулем, который:

1. Локально-first — пишет в существующий `~/.rox/workspaces/{workspaceId}/notes/*` (см. storage-backend из WT-23), без принудительного облака в v1.
2. Composable — каждая нота состоит из блоков (text/code/image/embed), как в Notion/AnyType.
3. Daily notes — автогенерируемая ежедневная страница (`daily/2026-05-21.md`) с шаблоном и backlinks.
4. Backlinks/graph — нота линкуется к sessions / artifacts / tasks через существующий entity-graph (см. `packages/shared/src/mentions/`).
5. AI-augmented — кнопка «Summarize» + on-save trigger извлекает action-items через session-tools-core (createTask).

Никакой full-text search engine — v1 использует существующий `packages/shared/src/search/`.

## 2. Цели и нецели

### 2.1 In scope

- Pages CRUD (`note.create/read/update/delete`) с локальным хранением `.md` + sidecar `.json` (block-tree).
- Block types: `text`, `code`, `image`, `embed` (link на ROX session/artifact/task).
- Daily notes: автосоздание при первом visit page `/notes/daily/today`; шаблон настраиваемый в settings.
- Backlinks: индекс `[[page-id]]` ссылок, отображается в правой панели.
- AI Summarize: кнопка в page header → вызывает `prompts/summarize-note.md` через существующий agent-fabric.
- On-save extract: trigger в `note.update` извлекает потенциальные task-кандидаты и предлагает `Add to Tasks?`.
- Link-to-graph: при вставке embed-блока сессии/артефакта появляется backlink в исходном объекте.
- i18n RU/EN.

### 2.2 Out of scope

- Облачная синхронизация (отдельно WT-24 sync v2; v1 — только local).
- Multiplayer realtime editing (CRDT) — defer.
- Полнотекстовый поиск с reranker (используем дефолтный `packages/shared/src/search/`).
- Сложные block-types: tables, kanban, whiteboard, embed iframe внешних сайтов.
- Шаринг ноты по публичной ссылке — WT-23-related backlog.
- Импорт из Obsidian/Notion/Apple Notes.

## 3. Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│  Renderer: NotesPage (apps/electron/src/renderer/pages/notes/)  │
│   ├─ NotesSidebar — список + daily / pinned / recent            │
│   ├─ NoteEditor — block-tree editor (slate-like minimal)        │
│   ├─ NoteHeader — title, AI-summarize button, link counter      │
│   └─ BacklinksPanel — обратные ссылки + entity-graph chips      │
└──────────────────────┬──────────────────────────────────────────┘
                       │ IPC: notes:*
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Main: apps/electron/src/main/notes/                            │
│   ├─ notes-service.ts — CRUD, daily-note auto-create            │
│   ├─ backlinks-indexer.ts — re-build index on save (debounced)  │
│   └─ block-extractor.ts — extracts mentions + task candidates   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Shared: packages/shared/src/notes/                             │
│   ├─ types.ts — Note, Block, BlockType, NotesIndex              │
│   ├─ block-schema.ts — Zod validation                           │
│   └─ summarize-prompt.ts — prompt builder (reuses /prompts)     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
       ~/.rox/workspaces/{ws}/notes/{noteId}/
          ├─ content.md        (markdown render для preview)
          ├─ blocks.json       (canonical block-tree)
          └─ meta.json         (id, title, tags, createdAt, updatedAt)
       ~/.rox/workspaces/{ws}/notes/daily/2026-05-21/...
       ~/.rox/workspaces/{ws}/notes/.index/backlinks.json
```

### 3.1 Ключевые файлы (files_allowed)

- `apps/electron/src/renderer/pages/notes/**`
- `apps/electron/src/main/notes/**`
- `apps/electron/src/main/ipc/notes-handlers.ts`
- `packages/shared/src/notes/**`
- `tests/unit/notes/**`
- `tests/integration/notes/**`
- `apps/electron/src/main/locales/en.notes.json`
- `apps/electron/src/main/locales/ru.notes.json`

### 3.2 files_forbidden

- `packages/shared/src/sessions/**` — read-only references (получаем через existing API).
- `packages/shared/src/mentions/**` — read-only reuse.
- `apps/electron/src/main/storage/**` — owned by WT-23.
- `package.json`, `tsconfig*.json`, `bun.lock` — scaffold-extension requests к WT-00.
- `packages/shared/src/feature-flags.ts` — owned by WT-07 (scaffold-extension).

### 3.3 Scaffold-extension requests

- WT-00: add `slate@^0.105.0` + `slate-react@^0.110.0` (минимальный block-editor).
- WT-00: add `remark@^15.0.0` + `remark-gfm@^4.0.0` (md ↔ block bridge).
- WT-07: register flag `rox.feature.notes-mvp` в `feature-flags.ts`.

## 4. TDD план (≥ 5 tests-first)

| # | Test name | What it asserts |
|---|---|---|
| T1 | `creates note with empty block tree and persists meta.json` | `notes.create({ title })` returns `Note` with `id`, file written. |
| T2 | `appends text block and round-trips through markdown` | Block-tree → markdown → block-tree остаётся идентичен (canonical form). |
| T3 | `daily note auto-creates on /notes/daily/today first visit` | Если файл отсутствует — создаётся из template; иначе reuses existing. |
| T4 | `backlinks index updates on save (debounced ≤300ms)` | После `notes.update` с `[[other-note]]` — backlinks.json содержит обратную ссылку в other-note. |
| T5 | `embed block linking to session ID adds backlink in session metadata` | Вставка `embed:session/abc` → session-mention API получает запись «mentioned in note X». |
| T6 | `summarize button invokes agent-fabric with note content` | Click → spawn agent с promptTemplate `summarize-note`; result inserted as new block. |
| T7 | `on-save extracts task candidates and emits suggestions` | Heuristic «TODO: ...» / «- [ ] ...» → `note.task-candidates` event с массивом строк. |
| T8 | `feature flag OFF hides Notes nav entry and IPC channel returns ENABLED=false` | При `rox.feature.notes-mvp=false` — sidebar не показывает entry; IPC ругается `FEATURE_DISABLED`. |
| T9 | `delete note removes files + clears backlinks pointing to it` | После delete — `.index/backlinks.json` не содержит висячих ссылок (cleanup). |

Все тесты commit-ятся первым коммитом `test(notes): failing tests for notes MVP` ДО любого impl-кода.

## 5. Acceptance Criteria (≥ 5)

1. **AC-1:** Создание/чтение/обновление/удаление ноты доступно через IPC `notes:create|read|update|delete`; renderer вызывает только через bridge.
2. **AC-2:** Daily note автогенерируется при первом visit `/notes/daily/today` (timezone из user preferences, UTC fallback) и не дублируется при повторных переходах в течение календарного дня.
3. **AC-3:** Block-tree поддерживает минимум четыре типа: `text`, `code` (с language tag), `image` (path/base64), `embed` (ROX session/artifact/task).
4. **AC-4:** Backlinks-индекс пересобирается debounced ≤300ms после save; правая панель показывает обратные ссылки с group-by entity-type.
5. **AC-5:** Кнопка «AI Summarize» работает через существующий agent-fabric (`packages/shared/src/agent/`) и вставляет результат как новый text-блок в конец ноты с пометкой `ai-generated=true`.
6. **AC-6:** On-save trigger извлекает task-кандидаты и публикует toast «Found N tasks — Add?»; согласие пользователя создаёт записи через `session-tools-core/handlers/create-task.ts` без дублей.
7. **AC-7:** При `rox.feature.notes-mvp=false` — Notes pages не рендерятся, IPC-handlers возвращают `{ ok: false, code: 'FEATURE_DISABLED' }`, audit emits zero notes-events.
8. **AC-8:** Локали RU/EN покрывают 100% строк UI; ru-копия проходит lint glossary («заметка», «ежедневная запись», «обратные ссылки»).

## 6. Risks

| Risk | Mitigation |
|---|---|
| Slate bundle size (~80KB) | Tree-shake; lazy-load NotesPage; контроль через `bundle-budget.json`. |
| Md ↔ block conversion lossy на edge-cases | Snapshot tests на канонических примерах + property-test для round-trip. |
| Backlinks index race conditions при rapid save | Debounce + single-writer queue per workspace. |
| Daily-note timezone drift | Use user preferences timezone; cron-style boundary test на 00:00 local. |
| AI Summarize cost overrun | Жёсткий token cap (≤4k input, ≤512 output); rate-limit 1 запрос/30s/note. |
| Conflict с WT-32 evidence-store именами файлов | Notes под `notes/`, evidence — `evidence/`; pre-merge gate сверяет. |

## 7. Inspiration repos

1. `obsidianmd/obsidian-api` — backlinks/graph patterns, daily notes UX (`reference_only`).
2. `streetwriters/notesnook` — local-first encrypted notes client (`reference_only`).
3. `anytypeio/anytype-ts` — object-oriented blocks editor (`reference_only`).
4. `outline/outline` — markdown block editor с embed-блоками (`reference_only`).
5. `ianstormtaylor/slate` — block-editor primitive (`dependency`).

## 8. Verification protocol

- **Unit:** `bun test tests/unit/notes/` — 9 tests above.
- **Integration:** `bun test tests/integration/notes/` — IPC round-trip, file-system layout, backlinks debounce.
- **3-machine:** screenshot Notes page (empty / one-note / daily-note) на mac-14-arm, windows-2022, ubuntu-22.
- **Smoke:** `notes-create-edit-summarize` E2E через playwright (если в test-suite доступен) или curl-driven IPC.

## 9. Definition of Done

- [x] Tests-first commit precedes any impl commit.
- [x] `bun run typecheck` exit 0.
- [x] `bun run lint` exit 0.
- [x] `bun test tests/unit/notes/` + `tests/integration/notes/` exit 0 (≥9 tests).
- [x] Bundle budget renderer increase ≤ 100 KB.
- [x] Backlinks index integrity verified by fixture (no dangling refs).
- [x] Feature flag OFF: zero notes IPC traffic, zero UI surface.
- [x] Screenshots Notes page на 3 OS приложены в evidence/wt-35/.
- [x] Locales RU/EN — 100% coverage.
- [x] Linear PZD sub-issue moved to "Ready for Merge".
