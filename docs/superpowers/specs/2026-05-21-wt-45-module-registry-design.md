# WT-45: ModuleRegistry (typed ModuleDefinition + sidebar/routes/panels)

**Branch:** `feat/module-registry`
**Base SHA:** `7c12d14ed6fd` (chore/wt-specs-2026-05-21 v1 spec commit)
**Wave:** 0+
**Priority:** P0
**Feature flag:** `rox.feature.modules.registry-v1` (default OFF)
**Parent epic:** PZD-122 (E11 Workspaces)
**Featurebase board:** Compounding (`6a0db1b591b619c8111329f2`)
**Status:** Design — awaiting implementation

## 1. Objective

Создать typed `ModuleDefinition` registry, на котором базируются ВСЕ будущие модули продукта (Notes, Whiteboard, Calendar, Mail, Day-tracker, Cards). Без registry каждый новый модуль вшивается вручную в `TopBar.tsx` / sidebar / router — это antipattern, который v2 устраняет.

## 2. User goal

Когда команда добавляет новый workspace-модуль (например, Whiteboard), он автоматически появляется в sidebar, получает свой route, panel container, AI context provider — без правок 5+ файлов TopBar/AppShell/router/i18n.

## 3. Files allowed

- `packages/shared/src/modules/module-registry.ts`
- `packages/shared/src/modules/module-definition.ts` (ModuleDefinition interface)
- `packages/shared/src/modules/__tests__/module-registry.test.ts`
- `apps/electron/src/renderer/components/sidebar/ModuleSidebar.tsx`
- `apps/electron/src/renderer/router/module-routes.tsx`
- `apps/electron/src/renderer/__tests__/module-sidebar.test.tsx`

## 4. Files forbidden

- `TopBar.tsx`, `AppShell.tsx` (WT-03 owns these — расширяются через registry, не правятся напрямую)
- `apps/electron/src/renderer/router/index.tsx` (root router — добавить лишь ModuleRoutes mount-point через WT-03 scaffold-request)
- Any file outside `packages/shared/src/modules/**` и `apps/electron/src/renderer/components/sidebar/**`

## 5. Depends on

- WT-00 (snapshot + branch hygiene, base SHA pinning)

## 6. Blocks

- WT-51 (Card Library), WT-52 (Whiteboard), WT-35 (Notes), WT-36 (Day tracking), WT-37 (Onboarding hints) — all UI modules depend on Registry

## 7. Functional requirements

- **FR-1**: `ModuleDefinition` schema (Zod + TS): `{id, title, icon, routes[], contentTypes[], actions[], permissions[], aiContextProvider?, sidebarOrder, enabledByFlag?}`.
- **FR-2**: `ModuleRegistry.register(module)` — idempotent, throws on duplicate id.
- **FR-3**: `ModuleRegistry.unregister(id)` — для testing + feature-flag-off rollback.
- **FR-4**: `ModuleRegistry.list()` — returns sorted by `sidebarOrder`, filtered by enabled flags.
- **FR-5**: `<ModuleSidebar />` React component reads registry, renders nav items с icon/title/badge.
- **FR-6**: Route resolution: `module-routes.tsx` mounts `<Routes>` для each registered module's `routes[]`.
- **FR-7**: Per-module permission gate via `permissions[]` — hidden in sidebar если user не имеет required scope.
- **FR-8**: AI context provider hook (`useModuleAIContext(moduleId)`) returns module's `aiContextProvider()` output для WT-48 AIContextPacket builder.

## 8. Non-functional requirements

- **NFR-1 perf**: register/list operations < 5ms for 20 modules.
- **NFR-2 testability**: 100% branch coverage on ModuleRegistry class.
- **NFR-3 i18n**: title strings via i18n key, not hardcoded; respects locale switch.
- **NFR-4 a11y**: ModuleSidebar passes axe-core check; keyboard nav (↑/↓) between items.
- **NFR-5 bundle**: ModuleRegistry adds ≤ 5 KB to bundle.

## 9. Data model

`ModuleDefinition` (NEW, in `packages/shared/src/modules/module-definition.ts`):
```typescript
interface ModuleDefinition {
  id: string;                        // kebab-case unique: 'cards', 'whiteboard', 'notes'
  title: string;                     // i18n key, NOT raw text
  icon: string;                      // lucide icon name
  routes: ModuleRoute[];
  contentTypes: ContentObjectType[]; // links to WT-46 — e.g. ['card', 'note']
  actions: ModuleAction[];           // command palette entries
  permissions: PermissionScope[];    // RBAC required (e.g. 'workspace:read')
  aiContextProvider?: () => AIContextPacket;  // WT-48
  sidebarOrder: number;
  enabledByFlag?: string;            // feature flag name (e.g. 'rox.feature.cards-mvp')
}
```

## 10. API / IPC

No new IPC — pure renderer-side registry. Module registration happens at app boot via static imports from `packages/shared/src/modules/registered/*.ts`.

## 11. UI/UX

- `<ModuleSidebar />`: vertical list of icons + labels, active state highlight, badge for unread/new.
- States: idle / hover / active / disabled-locked (entitlement gate).
- Keyboard: ↑/↓ navigate, Enter activate, Cmd/Ctrl+1..9 jump-to.

## 12. Security / RBAC

- Permission scope check via WT-14 Roles engine. Sidebar entry hidden if denied.
- AI context provider must NOT leak data from other modules — каждый provider scoped к своему `moduleId`.

## 13. TDD test list

- T-1: `should register module idempotently — second register returns existing`
- T-2: `should throw on duplicate module id with different content`
- T-3: `should list modules sorted by sidebarOrder`
- T-4: `should filter modules by enabledByFlag — flag OFF hides module`
- T-5: `should filter modules by user permissions — denied scope hides module`
- T-6: `<ModuleSidebar /> renders all enabled modules in order`
- T-7: `<ModuleSidebar /> highlights active module based on current route`
- T-8: `<ModuleSidebar /> passes axe-core a11y check`
- T-9: `module-routes.tsx mounts all registered routes`
- T-10: `useModuleAIContext returns packet for registered module`

## 14. Acceptance criteria

- AC-1: ≥ 5 modules can be registered without TopBar.tsx edits.
- AC-2: Sidebar reflects registry changes within next render frame.
- AC-3: Cmd/Ctrl+1 opens first module's primary route.
- AC-4: Disabling feature flag removes module from sidebar within 1s (HMR).
- AC-5: User without `workspace:read` permission sees no sidebar entries.
- AC-6: Bundle size delta ≤ 5 KB measured via existing bundle-budget gate.
- AC-7: All 10 TDD tests pass + axe-core clean.

## 15. 14-role plan

| Phase | Role | Model | Output |
|---|---|---|---|
| Discovery | brainstormer, requirements-keeper, scope-analyzer, critic | opus-max | discovery/01-04.md |
| Discovery | cjm-writer | opus-max | cjm/register-new-module.md |
| Design | erd-writer, sequence-chart-writer, prompt-writer | opus-max | erd/entities.mmd, sequence/register.mmd, contracts/module.ts |
| Design | ui-inventory-writer | opus-max | ui-inventory/sidebar.md |
| Impl | test-writer | opus-max | failing tests committed first |
| Impl | implementer, super-coder | sonnet-medium | code + green typecheck |
| Verify | verifier, critic, integrator | opus-max | 3-machine evidence + review |
| Optimize | optimizer, 10x-improver | opus-max | optimization notes |

## 16. Verification protocol

- 3-machine builds (mac-14-arm, windows-2022, ubuntu-22).
- Smoke: bun test packages/shared/src/modules + RTL ModuleSidebar.
- Screenshots: sidebar in light/dark + with 5 modules registered.

## 17. Feature flag

`rox.feature.modules.registry-v1`, default OFF. Release cut: `foundation`.

## 18. Linear mapping

- Parent epic: PZD-122 (E11 Workspaces)
- Child stories: "Registry contract + tests", "Sidebar UI + a11y", "Permission gate", "AI context provider hook"
- Attachments: FB post URL.

## 19. Featurebase mapping

- Board: Compounding (`6a0db1b591b619c8111329f2`)
- Post alias: `wt-45-module-registry`

## 20. Inspiration repos (5)

- https://github.com/nocobase/nocobase — `concept` — extensible plugin/module registry pattern.
- https://github.com/wasp-lang/open-saas — `reference_only` — modular SaaS module config.
- https://github.com/devxoul/vibe-notion — `reference_only` — Notion-style module sidebar.
- https://github.com/RSSNext/Folo — `reference_only` — Electron sidebar pattern.
- https://github.com/agisota/multica — `concept` — universal multi-content registry.

## 21. Definition of done

- [ ] All 10 TDD tests pass
- [ ] Typecheck + lint exit 0
- [ ] 3-machine smoke pass + screenshots
- [ ] Bundle delta ≤ 5 KB
- [ ] axe-core 0 violations
- [ ] Linear sub-issue Done, FB post Shipped
- [ ] feature flag flips ON in `foundation` release cut

## 22. Open questions

- Q1: ModuleDefinition static imports vs dynamic plugin loading? Static for v1.
- Q2: Cross-module action conflicts (e.g. two modules claim Cmd+N) — registry rejects on register? **Yes — throw with conflict details.**

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** register-new-module, switch-active-module
- **UI surfaces affected:** Sidebar (left), Module-host panel
- **Entities touched (WT-46):** ModuleDefinition (new), references ContentObjectType
- **Relations touched (WT-47):** N/A (registry is metadata, not relations)
- **Events emitted (WT-49):** `module.registered`, `module.activated`
- **AI context implications (WT-48):** Exposes per-module `aiContextProvider()` hook — required dependency for WT-48
- **Search index implications (WT-50):** Module titles/descriptions indexed for command palette
- **12-gate artifacts required:** cjm/register-new-module.md, erd/entities.mmd, sequence/register.mmd, ui-inventory/sidebar.md, evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A (это инфраструктура — Heptabase modules hardcoded, мы более extensible)
- **Risk axes:** UI, perf
