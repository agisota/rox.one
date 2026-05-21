# WT-51: Card Library MVP (UI on ContentObject type=card)

**Branch:** `feat/card-library-mvp`
**Base SHA:** `7c12d14ed6fd`
**Wave:** 2
**Priority:** P1
**Feature flag:** `rox.feature.card-library-mvp` (default OFF)
**Parent epic:** PZD-117 (E06 Artifacts/viewers) — Heptabase parity
**Featurebase board:** Frictionless UX (`6a0db0e7d1e3f457181dd1dd`)

## 1. Objective

Heptabase-like Card Library: central UI на ContentObject{type='card'}. Cards are universal repositories of knowledge, переиспользуются в Whiteboards через Placement (WT-52).

## 2. User goal

User: открывает Cards в sidebar → видит список всех cards с filters (tag, date, search) → клик создаёт + opens CardDetail для редактирования blocks → backlinks panel показывает связанные cards через WT-47 Relations.

## 3. Files allowed

- `apps/electron/src/renderer/pages/cards/CardLibrary.tsx`
- `apps/electron/src/renderer/pages/cards/CardDetail.tsx`
- `apps/electron/src/renderer/pages/cards/CardInspector.tsx`
- `apps/electron/src/renderer/pages/cards/BlockEditor.tsx`
- `apps/electron/src/renderer/pages/cards/hooks/useCards.ts`
- `apps/electron/src/renderer/pages/cards/hooks/useCardDetail.ts`
- `apps/electron/src/renderer/pages/cards/__tests__/*.test.tsx`

## 4. Files forbidden

- `packages/shared/src/core/content-object.ts` (WT-46)
- `packages/shared/src/core/relation.ts` (WT-47)
- `apps/electron/src/renderer/components/sidebar/*` (WT-45 owns sidebar — register Card module через registry)
- root scaffolds

## 5. Depends on

- WT-45 (ModuleRegistry — register 'cards' module)
- WT-46 (ContentObject type=card data layer)
- WT-47 (RelationService — backlinks via 'mentions' + 'related_to' types)
- WT-50 (SearchIndex — filter/search)

## 6. Blocks

- WT-52 (Whiteboard — uses BlockEditor for card content)
- WT-56 (Journals — uses same Block editor)
- WT-58 (Public sharing — card serialization)

## 7. Functional requirements

- **FR-1**: CardLibrary page: list view (grid+list toggle), search box, tag filter, type filter, sort by created/updated/title.
- **FR-2**: "+ New card" button + Cmd/Ctrl+N keyboard creates ContentObject{type=card} in current workspace, opens CardDetail.
- **FR-3**: CardDetail: title input (autosave on blur), BlockEditor (rich blocks: text/heading/code/image/embed/quote/list/todo), Cmd+Enter save, Esc cancel-revert.
- **FR-4**: CardInspector (right panel): metadata (tenant/workspace/createdBy/createdAt/updatedAt), tags (WT-53), backlinks list (via WT-47), source refs, ActivityEvent timeline (WT-49), AI summarize button (WT-48).
- **FR-5**: Context menu (right-click on card row): delete (soft via WT-46), duplicate, share (WT-58), open-in-new-tab.
- **FR-6**: Register 'cards' ModuleDefinition via WT-45 (sidebarOrder, icon='card', routes=['/cards', '/cards/:id'], contentTypes=['card']).
- **FR-7**: Mentions [[link]] syntax in BlockEditor creates WT-47 Relation type='mentions'.

## 8. Non-functional requirements

- **NFR-1 perf**: CardLibrary list 1000 cards < 200ms initial render + virtual scroll.
- **NFR-2 a11y**: WCAG 2.2 AA, axe-core 0 violations, keyboard nav (↑/↓ list, Enter open, Cmd+N new).
- **NFR-3 i18n**: All visible strings via i18n keys.
- **NFR-4 bundle**: Add ≤ 50 KB to bundle (BlockEditor heaviest).

## 9. Data model

Uses WT-46 ContentObject{type='card'} + Block. No new entities.

## 10. API / IPC

Uses WT-46 contentObject:* + WT-47 relation:* + WT-50 search:* — no new IPC.

## 11. UI/UX

**UI Inventory (gate 06 deliverable):**

| Surface | Element | Hover | Tooltip | Empty | Error | Loading | Keyboard |
|---|---|---|---|---|---|---|---|
| CardLibrary toolbar | "+ New" | scale 1.02 | "Create new card (⌘N)" | — | toast on fail | spinner | ⌘N |
| CardLibrary toolbar | Search box | border accent | — | "Type to search…" | inline error | spinner | ⌘F focus |
| CardLibrary toolbar | Tag filter | dropdown indicator | "Filter by tag" | "No tags yet" | — | — | ⌘⇧T |
| Card row | title | underline | — | — | — | skeleton | Enter open |
| Card row | context menu (...) | bg-accent | "Card actions" | — | — | — | menu key |
| CardDetail | title input | border accent | — | "Untitled" | red border | — | Tab to body |
| CardDetail | BlockEditor block | + button on left | — | "Press / for blocks" | inline | spinner | / for menu, ⌘/ shortcut |
| CardInspector | Backlinks | hover row underline | "X cards mention this" | "No backlinks yet" | — | spinner | — |

## 12. Security / RBAC

- All queries scoped by tenantId (via WT-46 RLS).
- "Share" action requires `workspace:share` permission (WT-14).
- AI summarize uses WT-48 permission-filtered context.

## 13. TDD test list

- T-1: `CardLibrary renders 100 cards in < 200ms`
- T-2: `+ New button creates card + opens detail (route changes)`
- T-3: `Cmd+N keyboard shortcut creates card`
- T-4: `Search query filters card list via WT-50`
- T-5: `BlockEditor / menu inserts block`
- T-6: `[[mention]] creates WT-47 Relation type='mentions'`
- T-7: `CardInspector backlinks shows incoming relations`
- T-8: `Context menu delete soft-deletes via WT-46`
- T-9: `axe-core 0 violations on CardLibrary + CardDetail`
- T-10: `i18n smoke: switch locale → labels update`
- T-11: `Bundle delta ≤ 50 KB measured via bundle-budget gate`

## 14. Acceptance criteria

- AC-1: All 11 TDD pass.
- AC-2: 3-machine screenshots (light + dark theme).
- AC-3: Bundle gate passes.
- AC-4: axe-core clean.
- AC-5: typecheck + lint exit 0.
- AC-6: Linear sub-issue Done, FB post Shipped.

## 15. 14+8-role plan

| Phase | Roles |
|---|---|
| Discovery | brainstormer, requirements-keeper, scope-analyzer, critic, cjm-writer |
| Design | erd-writer (relations only), ui-inventory-writer, ux-guru, prompt-writer |
| Impl | test-writer (opus), implementer, super-coder, reviewer |
| Verify | verifier, critic, integrator |
| Optimize | optimizer, 10x-improver |

## 16. Verification protocol

- 3-machine builds + RTL + axe + screenshots (light/dark).
- Bundle budget gate.

## 17. Feature flag

`rox.feature.card-library-mvp`, default OFF. Release cut: `ui`.

## 18. Linear mapping

- Parent: PZD-117
- Child stories: "CardLibrary list + virtual scroll", "CardDetail + BlockEditor + autosave", "CardInspector + backlinks", "Cmd+N + context menu", "Module registration via WT-45"

## 19. Featurebase mapping

- Board: Frictionless UX
- Post alias: `wt-51-card-library`

## 20. Inspiration repos (5)

- https://wiki.heptabase.com/ — `concept` — Heptabase Card Library core UX patterns.
- https://github.com/devxoul/vibe-notion — `concept` — Notion-style block editor.
- https://github.com/backnotprop/prompt-tower — `reference_only` — multi-block prompt UI.
- https://github.com/RecapAI/Recap — `reference_only` — note-taking card layout.
- https://github.com/agisota/portal — `reference_only` — knowledge-management UX.

## 21. Definition of done

- [ ] 11 TDD pass
- [ ] 3-machine screenshots present (light + dark)
- [ ] Bundle delta ≤ 50 KB
- [ ] axe-core 0 violations
- [ ] typecheck + lint exit 0
- [ ] Linear sub-issue Done, FB post Shipped

## 22. Open questions

- Q1: BlockEditor library — TipTap vs ProseMirror vs custom? **TipTap (built on ProseMirror, better DX, smaller bundle).**
- Q2: Mentions auto-complete UI position — inline popover or sidebar? **Inline popover anchored to caret.**

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** create-card, edit-card-blocks, find-backlinks, search-cards
- **UI surfaces affected:** Cards page (left sidebar entry), CardLibrary, CardDetail, CardInspector
- **Entities touched:** ContentObject{type=card}, Block
- **Relations touched (WT-47):** mentions, related_to, tagged_with
- **Events emitted (WT-49):** card.created, block.updated, mention.created via Relation
- **AI context implications (WT-48):** AI summarize button uses scope='card'
- **Search index implications (WT-50):** Heavy reader — list/filter/search
- **12-gate artifacts required:** cjm/create-card.md, cjm/edit-blocks.md, ui-inventory/card-library.md, ui-inventory/card-detail.md, evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** Card Library — central card repository
- **Risk axes:** UI, perf
