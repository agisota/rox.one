# WT-33 — Prompt workspace modernization v2 — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for Phase 1 (Discovery)
**Branch:** `feat/prompt-workspace-v2`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-33-prompt-workspace-v2/`
**Wave:** 2 (UI cut)
**Priority:** P0
**Depends on:** WT-03 (Rox Design topbar — UI shell baseline)
**Blocks:** WT-37 (Onboarding hints v2)
**Parent epic:** PZD-112 (E01 — Composer)
**FB board:** Frictionless UX
**Feature flag:** `rox.feature.composer.workspace-v2` (default OFF, release cut "UI")

---

## 1. Контекст и цель

Composer-pillar 4 (T234, M.10) внедрил `ComposerHistoryState` и переключение
режимов через панель из 6 кнопок. После 6 месяцев feedback:

- Юзеры не находят все 6 режимов на mobile / small viewport.
- "Mode switching" воспринимается как переход на новый экран — теряется контекст
  prompt-а.
- Cmd+K палитра существует в shell, но не для command-композиции (только для
  поиска).
- История prompt-ов хранится глобально, не по режиму.

**Цель WT-33** — модернизированный composer:

1. **6 режимов:** `chat | task | design | research | code | document` — те же,
   но как inline switcher над input-полем (segmented control), а не overlay.
2. **Quick-command palette (Cmd+K):** 6 commands (`/new-task`, `/new-doc`,
   `/research`, `/design`, `/code`, `/chat`) — открывают composer уже в нужном
   режиме с pre-filled prompt prefix.
3. **Mode-scoped `ComposerHistoryState`** (см. T234): история разделена per
   mode; навигация ↑/↓ внутри текущего режима.
4. **Mode persistence per session:** последний режим запоминается на
   workspace + restoring на reopen.
5. **Empty-state guidance per mode:** 1-line placeholder + 2-3 example
   prompts (контекстуально для tier + entitlement).

UX-guru role активирована (см. master Section 4.2).

После merge — флаг OFF, существующий composer работает как был. Release cut
"UI" включает v2 для всех; legacy code remains for 1 release под флагом, потом
удаляется в WT-33-cleanup story.

## 2. Скоуп

### 2.1 Входит

- `apps/electron/src/renderer/components/composer/ComposerV2.tsx` —
  главный composer container (заменяет `Composer.tsx` через флаг).
- `apps/electron/src/renderer/components/composer/ModeSwitcher.tsx` —
  segmented control с 6 modes, keyboard ←/→ navigation.
- `apps/electron/src/renderer/components/composer/ModeEmptyState.tsx` —
  per-mode placeholder + example prompts.
- `apps/electron/src/renderer/components/composer/QuickCommandPalette.tsx` —
  Cmd+K dialog (shadcn `Dialog` + `Command`).
- `apps/electron/src/renderer/components/composer/useComposerMode.ts` —
  hook для state (mode, session persistence через WT-23 storage).
- `apps/electron/src/renderer/components/composer/useComposerHistoryV2.ts` —
  per-mode history (расширение T234 `ComposerHistoryState`).
- `apps/electron/src/renderer/components/composer/__tests__/**` — RTL tests.
- `packages/shared/src/composer/mode.ts` — `ComposerMode` enum + zod-схема +
  `ModeMeta` (icon, labelKey, placeholderKey, exampleKeys).
- `packages/shared/src/composer/quick-commands.ts` — registry 6 commands +
  `parseQuickCommand(input)` returns `{mode, prefilledPrompt}`.
- `packages/shared/src/composer/index.ts` — re-export.
- `apps/electron/src/renderer/locales/{en,ru}/composer-v2.json` — locale
  keys (placeholders, examples, mode labels).
- `tests/unit/composer/**`.
- `tests/integration/renderer/composer/**` — Vitest + RTL.
- `tests/e2e/composer-v2.spec.ts` — Playwright happy path.
- `wt-meta/wt-33.yaml`.

### 2.2 Вне скоупа

- Backend changes для composer (zero — prompts sending unchanged).
- Mode → agent pipeline routing (owned WT-15/WT-28).
- Voice input — отдельный отложенный WT.
- AI-suggest prompts — отложен на v3.
- Existing `Composer.tsx` — НЕ ТРОГАТЬ; новый файл сосуществует, флаг
  решает который рендерить в `ComposerHost`.

### 2.3 Forbidden globs

- `apps/electron/src/renderer/components/composer/Composer.tsx` — legacy,
  read-only (НЕ удалять в этом WT).
- `apps/electron/src/renderer/components/composer/ComposerHost.tsx` —
  изменения только через scaffold-extension (single line: import v2 + flag
  branch).
- `packages/shared/src/prompts/**` — owned PZD-112 baseline (do not touch
  existing prompts).
- `package.json`, `tsconfig*.json`, `bun.lock` (WT-00).

## 3. Архитектура

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ComposerHost.tsx (existing, minor scaffold-extension)                  │
│    flag rox.feature.composer.workspace-v2                               │
│       ├─ off → <Composer />        (legacy)                             │
│       └─ on  → <ComposerV2 />                                           │
│                                                                         │
│  ComposerV2.tsx                                                         │
│    ├─ <ModeSwitcher mode={mode} onChange={setMode} />                   │
│    │     segmented control: chat | task | design | research | code |    │
│    │     document; keyboard ← →; aria role="radiogroup"                 │
│    ├─ <ModeEmptyState mode={mode} examples={examples[mode]} />          │
│    │     visible when input empty                                       │
│    ├─ <PromptInput value/onChange/onSubmit>                             │
│    │     reuses existing textarea component                             │
│    └─ <QuickCommandPalette open={openCmdK} />                           │
│         Cmd+K shortcut (`useKeyboardShortcut`)                          │
│         6 commands: /new-task, /new-doc, /research, /design, /code,     │
│         /chat                                                           │
│                                                                         │
│  Persistence layer:                                                     │
│    useComposerMode(workspaceId)                                         │
│       ├─ read: WT-23 storage `workspace/{wid}/composer-mode`            │
│       ├─ write: debounced 300ms                                         │
│    useComposerHistoryV2(workspaceId, mode)                              │
│       ├─ extends T234 ComposerHistoryState contract                     │
│       ├─ separate stack per mode (`history.<mode>`)                     │
│       └─ ↑/↓ navigates within current mode only                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 `ComposerMode` schema

```ts
export const ComposerMode = z.enum([
  'chat', 'task', 'design', 'research', 'code', 'document',
]);
export type ComposerMode = z.infer<typeof ComposerMode>;

export interface ModeMeta {
  id:             ComposerMode;
  iconName:       string;         // lucide-react icon
  labelKey:       string;         // i18n
  placeholderKey: string;
  exampleKeys:    string[];       // 2-3 keys
  quickCommand:   string;         // '/chat' etc.
  defaultEntry:   boolean;        // первая загрузка
}

export const MODE_REGISTRY: Record<ComposerMode, ModeMeta> = { … };
```

### 3.2 Quick-command parser

```ts
export function parseQuickCommand(input: string): QuickCommandResult | null {
  // matches `/<cmd>(\s+(.*))?$`
  // returns { mode, prefilledPrompt } or null
}
```

6 commands строго:
- `/chat` → mode=`chat`
- `/new-task` → mode=`task`, prefix=`Создай задачу: `
- `/new-doc` → mode=`document`, prefix=`Новый документ: `
- `/research` → mode=`research`, prefix=`Исследуй: `
- `/design` → mode=`design`, prefix=`Спроектируй: `
- `/code` → mode=`code`, prefix=`Напиши код: `

### 3.3 ComposerHistoryState v2 (см. T234)

T234 ввёл flat `ComposerHistoryState`: `{entries: PromptEntry[], cursor: int}`.
v2 расширяет — `Record<ComposerMode, ComposerHistoryState>`. Хук
`useComposerHistoryV2(workspaceId, mode)` отдаёт стек только текущего mode.

Backward compat: при первом запуске v2 — migrate legacy flat history в
`chat` stack; emit one-time audit event `composer.history.migrated`.

### 3.4 Ключевые файлы (files_allowed)

См. список в 2.1.

### 3.5 Scaffold-extension requests

- WT-00: уже доступны `cmdk@^1.0`, `lucide-react@^0.4` (проверено в legacy).
- WT-00: ничего нового, кроме одной строки import в `ComposerHost.tsx`
  (scaffold-extension с reason `feature flag branch`).
- WT-20 (i18n owner): добавить ключи `composer.modes.*`, `composer.examples.*`
  в `apps/electron/src/main/locales/{en,ru}.json` — scaffold-extension к
  WT-20 с конкретным diff.

## 4. TDD план (≥ 5)

| # | Test | Что проверяет |
|---|---|---|
| T1 | `ModeSwitcher renders 6 modes and supports ←/→ navigation` | RTL: 6 radios, focus + ArrowRight → focus next, ArrowLeft → previous, Enter → onChange. |
| T2 | `parseQuickCommand maps /new-task to {mode:'task', prefilledPrompt:'Создай задачу: '}` | Unit: all 6 commands parsed correctly; invalid command → null. |
| T3 | `useComposerHistoryV2 maintains separate stacks per mode` | hook test: push entry in `chat`, switch to `code`, history empty; switch back → chat history visible. |
| T4 | `Cmd+K opens palette and selecting command sets mode` | RTL: keyboard Cmd+K → palette visible; click `/new-task` → mode=`task`, prefilledPrompt visible. |
| T5 | `Mode persistence: setMode writes to storage and restores on remount` | RTL + mocked storage: setMode `code` → debounced write; remount → initial mode `code`. |
| T6 | `Empty-state shows mode-specific examples` | Empty input + mode `research` → 3 example chips visible с правильными locale keys. |
| T7 | `Legacy history migration on first v2 load` | mocked legacy `history` array → on v2 mount → all entries в `chat` stack + audit emit `composer.history.migrated`. |
| T8 | `Feature flag OFF renders legacy Composer` | RTL: flag=false → `<Composer />` mount; flag=true → `<ComposerV2 />` mount. |
| T9 | `Accessibility: 6 modes have aria-labels, palette has aria-modal` | axe-core scan; jest-axe assertion violations=0. |

Все commit-ятся первым коммитом
`test(composer/v2): failing tests for ModeSwitcher, palette, history`.

## 5. Acceptance Criteria (≥ 5)

- [ ] **AC-1:** `<ModeSwitcher />` рендерит 6 modes как segmented control;
      keyboard ←/→ + Enter работает; ARIA role=radiogroup.
- [ ] **AC-2:** Cmd+K (Ctrl+K на Win/Linux) открывает `QuickCommandPalette`;
      6 commands доступны; selecting устанавливает mode + prefilledPrompt.
- [ ] **AC-3:** `useComposerHistoryV2` обеспечивает per-mode history stacks;
      `↑/↓` навигация внутри текущего mode не leak-ит другие.
- [ ] **AC-4:** Mode persists per workspace через WT-23 storage; restore при
      reopen workspace.
- [ ] **AC-5:** Empty-state показывает 2-3 example prompts с i18n-keys
      (en + ru локали есть для всех 6 modes).
- [ ] **AC-6:** При `rox.feature.composer.workspace-v2=false` ComposerHost
      рендерит legacy `<Composer />`, zero new code paths executed.
- [ ] **AC-7:** Bundle delta ≤ 60 KB gzip на renderer chunk.
- [ ] **AC-8:** WCAG 2.2 AA: axe-core 0 violations, full keyboard nav без
      mouse, focus visible во всех 6 mode buttons + palette.
- [ ] **AC-9:** Audit event `composer.mode.changed` emit-ится на каждый
      ручной mode-switch (debounced 1s), но НЕ при initial restore.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Регрессия T234 ComposerHistoryState | Backward compat migration + audit emit; legacy interface остается в shared/composer/legacy.ts (read-only). |
| Cmd+K конфликт с system shortcuts (Spotlight на macOS) | На mac mod=Cmd+K работает inside app focus only; existing keymap проверить через `useKeyboardShortcut` allowlist. |
| Mobile / narrow viewport: 6 modes не помещаются в segmented | Responsive: < 480px — segmented свёртывается в dropdown с тем же ARIA контрактом. |
| Storage write spam (mode flips per second) | Debounce 300ms + batch на blur/unmount. |
| i18n drift (ru/en) | Lint script `scripts/check-i18n-parity.ts` запускается в pre-merge gate. |

## 7. Inspiration repos

| Repo | Integration type | Зачем |
|---|---|---|
| `pacocoursey/cmdk` | dependency | Cmd+K палитра — accessible primitive. |
| `vercel/ai-chatbot` | reference_only | Modern chat composer UX, mode switching pattern. |
| `langchain-ai/open-canvas` | reference_only | Multi-mode prompt composer + history-per-mode. |
| `radix-ui/primitives` | dependency | RadioGroup + Dialog primitives для accessible segmented control + palette. |
| `shadcn-ui/ui` | reference_only | Visual tokens для Command, Dialog, RadioGroup. |

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

**UX-guru активен** — выдаёт wireframe + style tokens для ModeSwitcher,
empty-state и palette (см. `design/03-ux-spec.md`).

## 9. Связи

- **Зависит от:** WT-03 (Rox Design topbar — visual tokens baseline),
  WT-23 (storage — composer-mode persistence), WT-20 (i18n — locale keys
  scaffold-extension).
- **Блокирует:** WT-37 (Onboarding hints v2 — показывает hint per mode),
  WT-34 (Agent Run UI потребляет mode для filter).

## 10. Verification protocol

- **Unit:** Vitest + zod = parser/registry/migration helpers.
- **RTL:** ModeSwitcher, QuickCommandPalette, ComposerV2 = 9 tests above.
- **E2E:** Playwright happy path — open app → toggle flag → open
  workspace → Cmd+K → /new-task → submit prompt → mode persists после reload.
- **3-machine:** Electron build + smoke на mac/win/linux:
  - mac-14-arm: skin screenshot `composer-v2-light.png` + `composer-v2-dark.png`.
  - windows-2022: smoke composer-v2 launch + Cmd+K open + mode-switch.
  - ubuntu-22: AppImage smoke + a11y axe-core JSON report.
- **a11y:** jest-axe 0 violations + manual keyboard nav проверка через
  Playwright `pressTab` цикл.

## 11. Open questions

- (O-1) Mobile responsive < 480 — dropdown layout: native `<select>` или
  custom (consistent с segmented стилем)? UX-guru ratifies в Phase 2.
- (O-2) Audit event `composer.mode.changed` — emit on every change или
  только when user-initiated (отличить от restore)? Текущий спек: skip
  restore + debounce 1s.
- (O-3) Voice input integration — отложен; нужно ли reserved button slot в
  ModeSwitcher для будущей extensibility? Решение: нет (extensibility через
  ModeRegistry, не UI slot).
- (O-4) Cmd+K dialog: full-screen overlay или modal 600x400? Решение от UX-guru.
