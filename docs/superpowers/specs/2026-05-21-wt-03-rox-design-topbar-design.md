# WT-03: ROX Design TopBar UX + hotkey

**Branch:** `feat/rox-design-topbar`
**Base SHA:** `fac6f228069c`
**Wave:** 0
**Priority:** P0
**Feature flag:** `rox.feature.rox-design.topbar-button` (default OFF; включается на Foundation Cut)
**Status:** Design — awaiting implementation

---

## 1. Objective

Дать пользователю явный путь открыть Rox Design embed: visible "ROX DESIGN" кнопка в TopBar + glob hotkey `Cmd/Ctrl+Shift+D` с 4 visible states (idle / starting / active / failed). Подключает recovery banner UI к crash event'у WT-02. Single-click recovery замыкает loop "embed died → user sees → user heals".

## 2. User goal

Designer/agent-driven дизайнер видит кнопку с liquid glass affordance, нажимает (или жмёт Cmd+Shift+D), embed открывается в правой панели; если сложился — banner показывает понятное "ROX DESIGN не отвечает — попробовать снова", recovery = 1 click без рестарта приложения.

## 3. Files allowed

- `apps/electron/src/renderer/components/TopBar.tsx`
- `apps/electron/src/renderer/components/AppShell.tsx`
- `apps/electron/src/renderer/components/RoxDesignButton.tsx`
- `apps/electron/src/renderer/components/RoxDesignCrashBanner.tsx`
- `apps/electron/src/renderer/contexts/NavigationContext.tsx`
- `apps/electron/src/renderer/contexts/RoxDesignLifecycleContext.tsx`
- `apps/electron/src/renderer/pages/RoxDesignPage.tsx`
- `apps/electron/src/renderer/hooks/useRoxDesignHotkey.ts`
- `apps/electron/src/renderer/__tests__/RoxDesignButton.test.tsx`
- `apps/electron/src/renderer/__tests__/RoxDesignCrashBanner.test.tsx`
- `apps/electron/src/renderer/__tests__/useRoxDesignHotkey.test.tsx`
- `apps/electron/src/renderer/__tests__/navigation-route-parser.test.ts`
- `apps/electron/src/main/rox-design-hotkey.ts`
- `apps/electron/src/main/__tests__/rox-design-hotkey.test.ts`
- `docs/ux/rox-design-topbar-2026-05-21.md`
- `docs/worklog/WT-03.md`

## 4. Files forbidden

- `apps/electron/src/main/rox-design-runtime-manager.ts` (WT-02)
- `apps/electron/src/main/rox-design-ipc.ts` (WT-02)
- `apps/electron/src/main/rox-design-fs.ts` (WT-02)
- `apps/electron/src/main/rox-design-view-policy.ts` (WT-02)
- `apps/electron/src/main/rox-design-view-manager.ts` (WT-02)
- `scripts/prepare-rox-design-runtime.ts` (WT-02)
- `scripts/check-rox-design-runtime-payload.ts` (WT-02)
- `electron-builder.yml` (WT-01)
- `packages/design-*/**` (out of scope)
- `apps/electron/src/main/locales/*.json` (через scaffold-extension к WT-20)

## 5. Depends on

WT-00 (snapshot). WT-02 (crash IPC event contract — consumes без modify).

## 6. Blocks

WT-33 (prompt-workspace-v2) — depends on RoxDesignButton + lifecycle context. WT-37 (onboarding-hints) — будет добавлять hint к TopBar button.

## 7. Functional requirements

1. **FR-03.1 (button)** TopBar получает `<RoxDesignButton />` справа от существующих nav-items, с лейблом "ROX DESIGN" (i18n key `rox-design.topbar.label`), icon = liquid-glass design pencil. Click → dispatch `navigation.openRoxDesignPanel` к `NavigationContext`.
2. **FR-03.2 (states)** 4 visible button states управляются `RoxDesignLifecycleContext`:
   - `idle` (default): static color, click opens panel.
   - `starting`: animated spinner overlay, click disabled but accessible.
   - `active`: filled background, click = focus existing panel.
   - `failed`: red accent + alert dot, click = show crash banner.
   Каждый state имеет дискретный data-testid: `rox-design-button-{state}`.
3. **FR-03.3 (hotkey)** Registered global `Cmd+Shift+D` (macOS) / `Ctrl+Shift+D` (Win/Linux) через `globalShortcut.register` в main + dispatched IPC `rox-design:hotkey` к renderer. Renderer triggers same action как button click. Hotkey is `Cmd+Shift+D` (NOT collide с `Cmd+D` bookmark — confirmed).
4. **FR-03.4 (crash banner)** `RoxDesignCrashBanner` отображается над embed panel когда `RoxDesignLifecycleContext.state === 'crashed'`, с текстом (i18n) "ROX DESIGN не отвечает" + кнопка "Попробовать снова". Click invokes IPC `rox-design:recover`; transitions через `recovering` → `ready` (или остается `crashed` после 3 attempts).
5. **FR-03.5 (route)** Browser-style URL `rox://design` парсится в `navigation-route-parser.ts` — отображает RoxDesignPage. Используется для deep-link из AAP (post-WT-02 уже emit'ит navigate event).
6. **FR-03.6 (a11y)** Button — focusable, role=button, aria-label localized, aria-pressed reflects `active` state. Banner — role=alert, aria-live=assertive. Hotkey announced в screen-reader-friendly tooltip on hover.
7. **FR-03.7 (i18n)** Все user-facing строки в `apps/electron/src/main/locales/{ru,en}.json` через scaffold-extension к WT-20.
8. **FR-03.8 (feature-flag)** Все 7 FR гейтятся `rox.feature.rox-design.topbar-button`. При OFF — button не видна; hotkey не зарегистрирован; banner не рендерится.

## 8. Non-functional requirements

- **NFR-03.1 (perf)** Button render <16ms (1 frame на 60Hz); lifecycle context update <8ms.
- **NFR-03.2 (a11y)** WCAG 2.2 AA: keyboard nav order (Tab to button → Enter), contrast 4.5:1, focus-visible ring.
- **NFR-03.3 (i18n)** RU + EN; готовность к будущим locale (key structure stable).
- **NFR-03.4 (security)** Hotkey не перехватывает в context где embed iframe focused (no key-event leak).
- **NFR-03.5 (audit)** Click + hotkey + recovery emit к WT-08 shim: `ui.rox-design.opened`, `ui.rox-design.hotkey-fired`, `ui.rox-design.recover-clicked`.
- **NFR-03.6 (bundle)** Adds <5KB to renderer bundle (gzipped).

## 9. Data model touched

- **RoxDesignLifecycleContext**:
  ```ts
  type RoxDesignLifecycleContextValue = {
    state: RuntimeLifecycleState;     // imported from WT-02 contract
    lastTransitionAtUtc: string;
    lastError?: { code: string; message: string };
    open: () => void;
    focus: () => void;
    recover: () => Promise<void>;
  };
  ```
- **Route schema** (`navigation-route-parser.ts`):
  ```ts
  const ROX_DESIGN_ROUTE = z.object({ scheme: z.literal('rox'), host: z.literal('design'), path: z.string().optional() });
  ```

## 10. API / IPC / RPC touched

- **IPC consumer:** `rox-design:lifecycle` (renderer receives RuntimeLifecycleEvent from WT-02).
- **IPC consumer:** `rox-design:hotkey` (main emits → renderer reacts).
- **IPC invoke:** `rox-design:recover` (renderer → main, returns recovery result).
- **NavigationContext action:** `navigation.openRoxDesignPanel` (new action type).

## 11. UI/UX touched

- **TopBar:** новая кнопка ROX DESIGN справа от nav-items, до user-avatar dropdown. 4 visible states.
- **AppShell:** добавляет `RoxDesignLifecycleProvider` обёртку над routes.
- **RoxDesignPage:** правая панель (existing) теперь host'ит crash banner + lifecycle indicator.
- **CrashBanner:** banner-style alert над embed iframe; CTA "Попробовать снова".

## 12. Security / RBAC implications

- Button visibility — gated by feature flag (FR-03.8); RBAC `rox.feature.rox-design.topbar-button` не отдаётся read-only users в Foundation Cut (default OFF в production).
- Hotkey global — может conflict с другими apps; check via `globalShortcut.isRegistered` перед register; fallback warning if conflict.
- Recovery IPC: validate origin — только trusted renderer process (existing `validateIpcSender` pattern).

## 13. TDD test list

1. `describe('RoxDesignButton', () => it('должно рендерить state="idle" по умолчанию с aria-label из locale'))`.
2. `describe('RoxDesignButton', () => it('должно рендерить state="failed" с alert-dot когда context.state="crashed"'))`.
3. `describe('RoxDesignButton', () => it('должно вызвать context.open() при click когда state="idle"'))`.
4. `describe('useRoxDesignHotkey', () => it('должно dispatch open action при Cmd+Shift+D на macOS'))` — mock platform=darwin.
5. `describe('useRoxDesignHotkey', () => it('должно dispatch open action при Ctrl+Shift+D на win32 и linux'))`.
6. `describe('RoxDesignCrashBanner', () => it('должно рендериться когда context.state="crashed" и invoke recover() при CTA click'))`.
7. `describe('navigation-route-parser', () => it('должно парсить rox://design в openRoxDesignPanel action'))`.
8. `describe('rox-design-hotkey (main)', () => it('должно register Cmd+Shift+D на boot и unregister на quit'))`.
9. `describe('feature-flag', () => it('должно скрывать button + не регистрировать hotkey когда flag=OFF'))`.

## 14. Acceptance criteria

1. **AC-03.1** Button visible в TopBar при flag=ON; screenshot evidence на 3 machines.
2. **AC-03.2** 4 visible states рендерятся корректно (idle/starting/active/failed) — visual regression test с 4 screenshots.
3. **AC-03.3** Cmd+Shift+D / Ctrl+Shift+D opens panel; logged в audit shim.
4. **AC-03.4** Crash banner показывается в <100ms после receiving `rox-design:lifecycle` event с state='crashed'.
5. **AC-03.5** "Попробовать снова" click invokes recovery; UI transitions correctly (crashed → recovering → ready).
6. **AC-03.6** A11y axe-core 0 violations на TopBar + Banner.
7. **AC-03.7** Bundle delta <5KB gzipped (validate через bundle-budget.yml workflow).
8. **AC-03.8** Feature flag OFF — button скрыта, hotkey not registered, banner не рендерится.
9. **AC-03.9** Deep-link `rox://design` parsed correctly и opens panel.

## 15. 14-role plan

| Phase | Role | Model | Expected output |
|---|---|---|---|
| Discovery | brainstormer | opus-max | `discovery/01-vision.md` — почему TopBar (not sidebar) |
| Discovery | requirements-keeper | opus-max | 9 AC + DoD |
| Discovery | scope-analyzer | opus-max | 16 файлов scope; не пересекается с WT-02 |
| Discovery | critic | opus-max | UX gap analysis vs current flow |
| Design | prompt-writer | opus-max | `design/01-impl-plan.md` |
| Design | architect | opus-max | `design/02-plan-review.md` |
| Design | UX-guru | opus-max | `design/03-ux-spec.md` — 4 button states + banner mockup (handoff WT-02 copy) |
| Impl | test-writer | opus-max | 9 failing tests Section 13 (RTL + Vitest) |
| Impl | implementer | sonnet-medium | TopBar/AppShell/Button impl |
| Impl | super-coder | sonnet-medium | Hotkey main+renderer + route parser |
| Impl | reviewer | opus-max | a11y-focused code review |
| Verify | verifier | opus-max | 3-machine + axe-core + visual regression |
| Verify | critic | opus-max | AC vs evidence + UX critique |
| Verify | integrator | opus-max | conflict scan vs WT-02; bundle-budget check |
| Optimize | optimizer | opus-max | render <16ms; bundle delta minimize |
| Optimize | 10x-improver | opus-max | future: command palette integration (WT-33 hook) |

## 16. Verification protocol

3-machine: **YES, все 3** — UI обязан рендериться идентично на 3 платформах.

- `mac-14-arm`: build `.dmg`, launch, screenshot TopBar 4 states + crash banner.
- `windows-2022`: build `.exe`, launch, hotkey Ctrl+Shift+D test.
- `ubuntu-22`: AppImage launch headless xvfb, axe-core a11y scan.

Дополнительно:
- Visual regression (Playwright) — 4 button states + banner.
- axe-core scan на TopBar + RoxDesignPage.
- Bundle-budget check: delta ≤5KB.

Smoke list:
1. button visible 3 platforms
2. hotkey works 3 platforms
3. crash banner rendered <100ms
4. recovery completes (когда WT-02 IPC available)
5. axe-core 0 violations
6. bundle delta ≤5KB

## 17. Feature flag configuration

- **Name:** `rox.feature.rox-design.topbar-button`
- **Default:** OFF
- **Release cut:** `foundation`
- **Registry location:** `packages/shared/src/feature-flags/registry.ts` (WT-07 owns; scaffold-extension request)

## 18. Linear mapping

- **Parent epic:** PZD-116 (E05 — Design System).
- **Child stories:**
  - "🎨 TopBar — ROX DESIGN button (4 states)"
  - "⌨️ Hotkey Cmd/Ctrl+Shift+D"
  - "🚨 Crash banner UI + recovery CTA"
  - "🔗 Deep-link rox://design"
  - "♿ A11y axe-core 0 violations"
- **Existing PZD-* to attach:**
  - "Open Design embed: AAP-driven navigation в правой панели" (already under PZD-116) — partial coverage (banner side).

## 19. Featurebase mapping

- Board: `Frictionless UX` (id `6a0db0e7d1e3f457181dd1dd`)
- Post alias: `wt-03-rox-design-topbar-button`
- Status lifecycle: planned → in-progress → shipped
- Changelog draft (на merge): "ROX DESIGN — открой в один клик из TopBar"

## 20. Inspiration repos

- `https://github.com/intentui/intentui` (E05, `partial_port`) — React Aria Components + Tailwind, a11y-first; прямой референс для button states + banner role=alert.
- `https://github.com/elevenlabs/ui` (E05, `reference_only`) — shadcn/ui multimodal component library; референс для action-button visual treatment.
- `https://github.com/icantcodefyi/dot-matrix-animations` (E05, `direct_reuse`) — 28 dot-matrix loader SVGs (~4KB each, no runtime); usable как `starting` state spinner.
- `https://github.com/xFalzz/macos-clone` (E05, `reference_only`) — macOS desktop в web; вдохновение для liquid glass affordance кнопки.
- `https://github.com/shadcnblocks/kibo` (E05, `partial_port`) — composable shadcn/ui registry; pattern для RoxDesignButton как library-grade component.

## 21. Definition of done

1. Все 9 failing tests из Section 13 → passing.
2. `bun run typecheck && bun run lint && bun test apps/electron/src/renderer/__tests__/RoxDesign*.test.tsx` exit 0.
3. 9 AC из Section 14 верифицированы.
4. 3-machine screenshots attached к PZD-116 sub-issue.
5. axe-core 0 violations.
6. Bundle delta ≤5KB gzipped.
7. Feature flag OFF — никаких видимых изменений.
8. Worklog заполнен.
9. Linear sub-issues closed.
10. Featurebase changelog draft created.

## 22. Open questions

| # | Question | Proposed resolution |
|---|---|---|
| 1 | Иконка для button — liquid-glass pencil или иной design language? | liquid-glass pencil (consistent с macOS aesthetic per Q16 master); fallback к solid SVG на Windows/Linux. |
| 2 | Hotkey collision detection — что делать если Cmd+Shift+D занят? | Warn на boot через notification + log audit; fallback не регистрируем (button остаётся доступной). |
| 3 | Banner — приоритет над embed iframe (z-index) или inline в panel header? | banner inline над iframe (внутри panel) — preserves embed visibility для context; full-overlay только при `crashed` 3+ minutes. |
| 4 | Click behaviour когда state="active" — focus уже открытой панели или open new tab? | focus existing panel; double-click → maximize panel (future, не в этом WT). |
| 5 | `rox://design/component/<name>` глубокие пути — поддерживаем сейчас или defer к WT-33? | базовый `rox://design` сейчас; sub-paths defer к WT-33 (prompt workspace deep-link). |
