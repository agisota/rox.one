# WT-37 — Onboarding / Contextual Hints + Entitlement UI — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for implementation (TDD-first)
**Ветка:** `feat/onboarding-hints`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-37-onboarding-hints/`
**Wave:** 2
**Priority:** P0
**Depends on:** WT-07 (entitlement / feature-flag registry), WT-33 (prompt workspace v2)
**Blocks:** —
**Parent epic:** PZD-115 (E04 Skills / permissions / entitlements)
**FB board:** Frictionless UX (`6a0db1cbb0bb70b5d8d3f893`)
**Feature flag:** `rox.feature.onboarding-hints` (default OFF, release cut "UI")

---

## 1. Контекст

Первый запуск ROX.ONE для нового пользователя — обрыв: десятки кнопок, режимов, источников, агентов; ни одной подсказки кроме автогенерированного OnboardingWizard (`apps/electron/src/renderer/components/onboarding/*`) который покрывает API-keys, и больше ничего. Сюда же — растущая матрица entitlements: фичи, доступные только Pro/Team tenants (например, MCP-packs из WT-39, AAP storage из WT-32, multi-tenant from WT-05). Пользователю Free tier бесшумно «не работает» опция — без всякого CTA «обновитесь».

WT-37 решает две связанные задачи:

1. **Onboarding tour** — 5-шаговый guided tour для first-time users (Composer, Sources, Skills, Agents, Notes). Dismissable. Restartable из settings.
2. **Contextual hints на entitlement-gated фичах** — когда entitlement flag OFF для текущего tier'а tenant'а, рядом с фичей показывается nudge «Upgrade to Pro» с deep link на pricing.

UX-guru роль — обязательная: tour шаги ratifiable дизайнером, не разработчиком.

## 2. Цели и нецели

### 2.1 In scope

- 5-step OnboardingTour overlay (anchored popovers).
- Step persistence: progress хранится в user preferences (`onboarding.tour.{stepId}.completed`).
- Dismissable (per-step + global).
- Restartable из `SettingsPage > Help > Replay tour`.
- ContextualHint component (badge + tooltip) для entitlement-gated кнопок.
- Hooks: `useEntitlement(flag)` + `useShowUpgradeHint(flag)`.
- Upgrade CTA → deep link на `account.rox.one/pricing?source=hint-<flag>`.
- Audit events: `onboarding.tour.step.viewed/dismissed/completed`, `entitlement.hint.shown/clicked`.
- i18n RU/EN + accessibility (focus trap, ESC dismiss, ARIA live region).

### 2.2 Out of scope

- Видео-тур / интерактивные туториалы.
- A/B testing разных tour-вариантов — defer.
- In-app purchase / pricing UI — только deep link out.
- Полная entitlement engine — мы потребитель WT-07, не реализатор.
- Tenant-tier change flow (upgrade button creates checkout) — defer to billing module.

## 3. Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│ Renderer:                                                       │
│   apps/electron/src/renderer/components/onboarding-tour/        │
│     ├─ OnboardingTour.tsx      — orchestrator                   │
│     ├─ TourStep.tsx            — anchored popover                │
│     ├─ tour-steps.ts           — declarative 5 steps              │
│     └─ useTourState.ts         — progress reducer                 │
│                                                                  │
│   apps/electron/src/renderer/components/contextual-hint/        │
│     ├─ ContextualHint.tsx      — badge + tooltip                 │
│     ├─ useEntitlement.ts        — wraps WT-07 hook               │
│     └─ UpgradeBadge.tsx         — CTA primitive                  │
│                                                                  │
│   Hook into:                                                     │
│     - Composer (Send + advanced opts)                            │
│     - SourceInfoPage (install MCP packs)                         │
│     - AccountSettingsPage (team management)                      │
│     - NotesPage (AI Summarize если Pro-only)                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Shared: packages/shared/src/onboarding/                         │
│   ├─ tour-steps-schema.ts  (Zod)                                │
│   ├─ hint-anchors.ts       (registry of anchor ids)              │
│   └─ types.ts                                                    │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
   Preferences:
     onboarding.tour.completed_at?: ISO
     onboarding.tour.dismissed: boolean
     onboarding.tour.{stepId}.completed: boolean
     entitlement.hint.{flag}.dismissed_at?: ISO
```

### 3.1 Ключевые файлы (files_allowed)

- `apps/electron/src/renderer/components/onboarding-tour/**`
- `apps/electron/src/renderer/components/contextual-hint/**`
- `apps/electron/src/renderer/hooks/use-entitlement.ts`
- `packages/shared/src/onboarding/**`
- `tests/unit/onboarding/**`
- `tests/integration/onboarding/**`
- `apps/electron/src/main/locales/en.onboarding.json`
- `apps/electron/src/main/locales/ru.onboarding.json`

Также **минимальные anchor-id вставки** в существующие компоненты — через scaffold-extension request к WT-33 / SettingsPage owners.

### 3.2 files_forbidden

- `apps/electron/src/renderer/components/onboarding/**` — это существующий wizard (API-keys), НЕ ТРОГАТЬ.
- `packages/shared/src/feature-flags.ts` — owned by WT-07.
- `package.json`, `tsconfig*.json`, `bun.lock` — scaffold к WT-00.

### 3.3 Scaffold-extension requests

- WT-00: add `@floating-ui/react@^0.27.0` для anchored popovers (accessible positioning).
- WT-07: register flag `rox.feature.onboarding-hints` + entitlement helpers `getTierFlags(tenantId)`.
- WT-33: add `data-tour-anchor="composer-send"` attribute на send button.
- WT-39 (future): add `data-tour-anchor="mcp-marketplace"` на MCP page header.

## 4. TDD план (≥ 5 tests-first)

| # | Test name | What it asserts |
|---|---|---|
| T1 | `renders tour overlay for first-time user with default flag ON in profile` | Mock preferences `onboarding.tour.completed_at=null` + flag ON → OnboardingTour mounts с step=0. |
| T2 | `advances step on next click and persists progress` | Click "Next" → step=1; preferences contains `step-0.completed=true`. |
| T3 | `dismisses tour globally and never shows again until manual replay` | Click "Skip tour" → `onboarding.tour.dismissed=true`; re-mount component → tour не показывается. |
| T4 | `replay from settings resets progress and re-mounts tour` | Click "Replay tour" в settings → preferences cleared; tour mounts step=0. |
| T5 | `entitlement hint shows when flag OFF and hides when ON` | Mock `useEntitlement('pro.mcp-packs')=false` → UpgradeBadge rendered; toggle to true → unmounts. |
| T6 | `upgrade CTA deep-links with correct source param` | Click CTA → IPC `shell:open-external` called with `https://account.rox.one/pricing?source=hint-pro.mcp-packs`. |
| T7 | `tour respects keyboard navigation and ESC dismiss` | Tab cycles inside popover (focus trap); ESC dismisses current step (но не tour globally). |
| T8 | `audit event onboarding.tour.step.viewed emits with stepId` | Step mount → audit emitter called with `{ type: 'onboarding.tour.step.viewed', stepId: 'composer-intro' }`. |
| T9 | `feature flag OFF disables tour AND hints (kill switch)` | `rox.feature.onboarding-hints=false` → ни tour, ни hints не рендерятся. |
| T10 | `ARIA live region announces step changes for screen readers` | role=alert / aria-live=polite container updates с новым step title. |

Все тесты commit-ятся первым коммитом `test(onboarding): failing tests for tour + hints` ДО любого impl-кода.

## 5. Acceptance Criteria (≥ 5)

1. **AC-1:** OnboardingTour содержит ровно 5 шагов: Composer overview, Sources, Skills, Agents, Notes. Step content описан декларативно в `tour-steps.ts` и проходит Zod validation на startup.
2. **AC-2:** Прогресс per-step + dismissed flag хранится в `preferences.onboarding.tour.*`; restart из Settings очищает только эти ключи.
3. **AC-3:** ContextualHint показывает Upgrade badge ONLY если `useEntitlement(flag) === false` для текущего tier'а tenant'а. Click → IPC `shell:open-external` с deep link, содержащим `source=hint-<flag>`.
4. **AC-4:** Accessibility: focus trap в popover, ESC закрывает текущий шаг (не tour), Tab order логичный, ARIA live region объявляет step transitions.
5. **AC-5:** i18n RU/EN — 100% строк tour + hints; ru-копия проходит lint glossary («подсказка», «продолжить», «обновить тариф»).
6. **AC-6:** Audit events `onboarding.tour.step.viewed/dismissed/completed` и `entitlement.hint.shown/clicked` эмитятся через существующий `@rox-one/audit` (WT-08); tenant_scope включён.
7. **AC-7:** Feature flag `rox.feature.onboarding-hints=false` → ни tour, ни hints не рендерятся, ноль audit events, ноль IPC traffic.
8. **AC-8:** Bundle impact: ≤ 50 KB gzipped (после tree-shake `@floating-ui/react`).
9. **AC-9:** UX-guru role обязательна; design/03-ux-spec.md содержит wireframe всех 5 шагов и hint-вариантов, утверждённый PM signoff (Linear comment).

## 6. Risks

| Risk | Mitigation |
|---|---|
| Tour overlay перекрывает важные кнопки | UX-guru wireframe + анкер-aware позиционирование `@floating-ui/react`. |
| Hint становится спамом для повторных users | Per-flag dismissed_at TTL=30 days; не показывать дважды в этом окне. |
| Tour ломается при изменении layout в WT-33 | Anchor через `data-tour-anchor`; integration test ловит missing anchor. |
| Entitlement check race с tenant boot | useEntitlement возвращает `undefined` до load → hint скрыт по дефолту. |
| Conflict с существующим OnboardingWizard | Тур запускается ПОСЛЕ wizard completion; mutually exclusive. |
| Accessibility regression | axe-core integration test обязателен. |

## 7. Inspiration repos

1. `gilbarbara/react-joyride` — guided tours patterns (reference_only, MIT).
2. `floating-ui/floating-ui` — accessible anchored popovers (dependency).
3. `usebillinggate/intercom-product-tours` — entitlement-gated hint UX (reference_only).
4. `dyte-io/feature-flag-react-sdk` — entitlement hook patterns (reference_only).
5. `radix-ui/primitives` — accessible focus-trap + dialog patterns (reference_only).

## 8. Verification protocol

- **Unit:** `bun test tests/unit/onboarding/` — 10 tests above.
- **Integration:** axe-core a11y scan на OnboardingTour + ContextualHint.
- **3-machine:** screenshot tour step 1, hint badge на mac-14-arm, windows-2022, ubuntu-22.
- **Smoke:** `onboarding-first-run-tour-complete` E2E (first run → tour → skip → settings replay).
- **UX signoff:** Linear comment от designer на design/03-ux-spec.md обязателен.

## 9. Definition of Done

- [x] Tests-first commit precedes any impl commit.
- [x] `bun run typecheck` exit 0.
- [x] `bun run lint` exit 0.
- [x] `bun test tests/unit/onboarding/` exit 0 (≥10 tests).
- [x] axe-core scan: zero violations.
- [x] Bundle budget renderer increase ≤ 50 KB.
- [x] UX-guru spec ratified in Linear PZD comment.
- [x] Feature flag OFF: zero tour, zero hints, zero audit events.
- [x] Screenshots tour + hints на 3 OS приложены в evidence/wt-37/.
- [x] Locales RU/EN — 100% coverage.
- [x] Linear PZD sub-issue moved to "Ready for Merge".

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** first-user-onboarding, hit-entitlement-gate
- **UI surfaces affected:** OnboardingTour, EntitlementGate
- **Entities touched (WT-46 references):** N/A
- **Events emitted (WT-49 ActivityEvent):** onboarding.step.completed, upgrade.cta.clicked
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** UI
