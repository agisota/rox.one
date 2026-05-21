# WT-52: Whiteboard + Placement (canvas separate from cards)

**Branch:** `feat/whiteboard-placement`
**Base SHA:** `7c12d14ed6fd`
**Wave:** 2
**Priority:** P1
**Feature flag:** `rox.feature.whiteboard-placement-v1` (default OFF)
**Parent epic:** PZD-117 (E06)
**Featurebase board:** Frictionless UX (`6a0db0e7d1e3f457181dd1dd`)

## 1. Objective

**Heptabase whiteboard model**: visual canvas, где Card ≠ Whiteboard item. Card = ContentObject{type=card}, Whiteboard item = Placement (objectId × whiteboardId × x/y/size/zIndex/style). Same card может быть на МНОГИХ whiteboards через separate Placements.

## 2. User goal

User: открывает Whiteboard → drag-drop existing card → создаётся Placement (НЕ duplicating Card) → move card → updates Placement only → delete Placement → Card остаётся в Library. Same card на Whiteboard A и B независимо двигается.

## 3. Files allowed

- `packages/shared/src/core/placement.ts`
- `packages/shared/src/core/whiteboard.ts`
- `packages/server-core/src/schema/placement.ts`
- `packages/server-core/src/migrations/20260521-placement-whiteboard.sql`
- `apps/electron/src/renderer/pages/whiteboard/Whiteboard.tsx`
- `apps/electron/src/renderer/pages/whiteboard/Canvas.tsx`
- `apps/electron/src/renderer/pages/whiteboard/CardOnCanvas.tsx`
- `apps/electron/src/renderer/pages/whiteboard/Toolbar.tsx`
- `apps/electron/src/renderer/pages/whiteboard/Selection.tsx`
- `apps/electron/src/renderer/pages/whiteboard/__tests__/*.test.tsx`

## 4. Files forbidden

- `packages/shared/src/core/content-object.ts` (WT-46)
- `packages/shared/src/core/relation.ts` (WT-47)
- `apps/electron/src/renderer/pages/cards/*` (WT-51)
- root scaffolds

## 5. Depends on

- WT-46 (ContentObject — Whiteboard is type='whiteboard')
- WT-47 (RelationService — Placement uses 'placed_on' type INTERNALLY or has its own table — see Q1)
- WT-51 (Card Library — BlockEditor reused for inline card edit)

## 6. Blocks

- WT-57 (Graph view), WT-58 (Public sharing — whiteboard serialization)

## 7. Functional requirements

- **FR-1**: Whiteboard = ContentObject{type='whiteboard'}, with metadata: `{backgroundColor, canvasSize, defaultZoom}`.
- **FR-2**: `Placement` schema: `{id, tenantId, whiteboardId, objectId, x, y, width, height, zIndex, style, collapsed, createdAt}` — separate table.
- **FR-3**: **HARD INVARIANT**: Card cannot exist exclusively on a whiteboard. Card has identity in ContentObject; Placement only refs.
- **FR-4**: Drag-drop card from CardLibrary panel → creates Placement at drop coords; does NOT clone Card.
- **FR-5**: Move/resize: updates Placement only (Card untouched).
- **FR-6**: Delete Placement (right-click → Remove from whiteboard) — removes ONLY placement, card stays.
- **FR-7**: Connection arrows between Placements: creates WT-47 Relation type='related_to' between the two ContentObjects (not Placements).
- **FR-8**: Same card on 2 boards: 2 Placements with same objectId. Independent x/y/zIndex.
- **FR-9**: Canvas: drag/zoom/pan via wheel + space-drag; selection box; multi-select; group drag.
- **FR-10**: Toolbar: select | new card on canvas | new arrow | new section | text block | search | AI.

## 8. Non-functional requirements

- **NFR-1 perf**: render 500 placements + 200 arrows < 300ms initial; 60 FPS pan/zoom.
- **NFR-2 a11y**: keyboard nav for non-canvas controls; canvas itself has aria-label + alt navigation list.
- **NFR-3 i18n**: All visible strings via i18n.
- **NFR-4 bundle**: Canvas library (xyflow or konva) ≤ 100 KB gzipped.

## 9. Data model

```typescript
interface Whiteboard extends ContentObject {
  type: 'whiteboard';
  metadata: {
    backgroundColor: string;     // hex
    canvasSize: { w: number; h: number };
    defaultZoom: number;
  };
  // blocks unused for whiteboard (canvas is separate); could store title-block only
}

interface Placement {
  id: string;          // uuid v7
  tenantId: string;
  whiteboardId: string;  // ContentObject.id where type='whiteboard'
  objectId: string;      // ContentObject.id of placed object (any type)
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  style?: { color?: string; opacity?: number };
  collapsed: boolean;
  createdAt: string;
}
```

## 10. API / IPC

- `placement:create(whiteboardId, objectId, position)` → Placement
- `placement:update(id, patch)` → Placement
- `placement:delete(id)` → void
- `placement:list(whiteboardId)` → Placement[]
- `whiteboard:create(input)` → Whiteboard (delegates to WT-46 contentObject:create)

## 11. UI/UX

**UI Inventory:**

| Surface | Element | Hover | Tooltip | Empty | Error | Loading | Keyboard |
|---|---|---|---|---|---|---|---|
| Whiteboard top toolbar | Select tool | bg-accent | "Select (V)" | — | — | — | V |
| Toolbar | New card | scale 1.02 | "New card (C)" | — | — | — | C |
| Toolbar | New arrow | bg-accent | "Connect cards (A)" | — | — | — | A |
| Toolbar | Search overlay | bg-accent | "Search this board (⌘F)" | "No matches" | — | spinner | ⌘F |
| Card on canvas | drag handle | cursor-grab | — | — | — | — | drag |
| Card on canvas | resize corners | resize cursor | — | — | — | — | drag |
| Card on canvas | context menu | bg-accent | "Card actions" | — | — | — | menu key |
| Card on canvas | "Remove from board" | red text | "Card stays in Library" | — | — | — | Del |
| Card on canvas | "Delete card" | red text | "DELETES from Library!" | — | confirm modal | spinner | ⇧Del |
| Connection arrow | hover thicken | accent | "Click to edit relation" | — | — | — | — |
| Canvas (background) | empty state | — | — | "Drag a card here to start" | — | — | — |

## 12. Security / RBAC

- Placement create requires `read` on objectId + `write` on whiteboardId.
- Cross-workspace placement blocked (whiteboard + object must be same workspace).
- AI on whiteboard: AIContextPacket scope='whiteboard' (WT-48).

## 13. TDD test list

- T-1: **CRITICAL** `drag card from Library → creates Placement, Card NOT cloned`
- T-2: **CRITICAL** `delete Placement → Card remains in Library`
- T-3: **CRITICAL** `delete Card from CardDetail → also removes all Placements (cascade)`
- T-4: `same card on 2 whiteboards: 2 Placements with same objectId, independent coords`
- T-5: `move card on canvas updates Placement only (Card.updatedAt unchanged)`
- T-6: `connection arrow creates Relation type='related_to' between OBJECTS not Placements`
- T-7: `multi-select group-drag updates multiple Placements atomically`
- T-8: `perf: 500 placements 60 FPS pan/zoom`
- T-9: `cross-workspace placement blocked`
- T-10: `axe-core clean on toolbar + accessibility nav for canvas`
- T-11: `Bundle: canvas lib ≤ 100 KB gzipped`

## 14. Acceptance criteria

- AC-1: 11 TDD pass — **Card ≠ Placement invariant verified by T-1/T-2/T-3**.
- AC-2: 3-machine screenshots (mac+win+linux, light+dark).
- AC-3: Perf benchmark 500 placements / 60 FPS.
- AC-4: Bundle gate passes.
- AC-5: axe-core clean.
- AC-6: typecheck + lint exit 0.

## 15. 14+8-role plan

| Phase | Roles |
|---|---|
| Discovery | brainstormer, requirements-keeper, scope-analyzer, critic, cjm-writer |
| Design | erd-writer, sequence-chart-writer, ui-inventory-writer, ux-guru, prompt-writer |
| Impl | test-writer (opus, critical invariant tests first), implementer, super-coder, reviewer |
| Verify | verifier (special focus on T-1/T-2/T-3), critic, integrator |
| Optimize | optimizer (60 FPS), 10x-improver |

## 16. Verification protocol

- 3-machine + canvas perf test (Puppeteer trace 60 FPS).
- Bundle budget gate.
- Manual chaos test: создать 100 placements того же card на разных boards, verify independent moves.

## 17. Feature flag

`rox.feature.whiteboard-placement-v1`, default OFF. Release cut: `ui`.

## 18. Linear mapping

- Parent: PZD-117
- Child stories: "Placement schema + migration", "Canvas component (xyflow)", "Drag-drop from Library", "Connection arrows via Relations", "Perf 60 FPS"

## 19. Featurebase mapping

- Board: Frictionless UX
- Post alias: `wt-52-whiteboard-placement`

## 20. Inspiration repos (5)

- https://wiki.heptabase.com/fundamental-elements — `concept` — **Card ≠ Placement** invariant directly from Heptabase doctrine.
- https://github.com/agisota/reaflow — `partial_port` — node-graph canvas (xyflow alternative).
- https://github.com/agisota/meta2d.js — `reference_only` — 2D canvas library.
- https://github.com/protectwise/troika — `reference_only` — high-perf canvas rendering.
- https://github.com/vercel-labs/tersa — `reference_only` — modern canvas UX.

## 21. Definition of done

- [ ] 11 TDD pass (including 3 CRITICAL invariant tests)
- [ ] 3-machine screenshots (light + dark)
- [ ] Perf 60 FPS on 500 placements
- [ ] Bundle ≤ 100 KB canvas lib
- [ ] axe-core clean
- [ ] typecheck + lint exit 0
- [ ] Manual chaos test: 100 placements same card on 5 boards, all independent

## 22. Open questions

- Q1: Placement as own table OR Relation type='placed_on' with metadata={x,y,...}? **Own table — Placement-specific fields (x/y/z/style) deserve typed schema, not JSON in Relation.metadata.**
- Q2: Canvas library — xyflow vs konva vs custom Pixi? **xyflow (React-native, great DX, sufficient perf for v1; revisit Pixi if 1000+ placements needed).**

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** create-whiteboard, drag-card-to-board, move-card, connect-cards, same-card-two-boards
- **UI surfaces affected:** Whiteboards (sidebar entry), Canvas, Toolbar, Card-on-canvas, Selection
- **Entities touched:** Whiteboard (ContentObject{type=whiteboard}), Placement (NEW table)
- **Relations touched (WT-47):** related_to (for connection arrows)
- **Events emitted (WT-49):** whiteboard.created, placement.created, placement.moved, placement.deleted, arrow.created
- **AI context implications (WT-48):** scope='whiteboard' — AI sees all Placements + objects
- **Search index implications (WT-50):** Placement metadata indexed for whiteboard filter
- **12-gate artifacts required:** cjm/drag-card-to-board.md, cjm/connect-cards.md, erd/whiteboard-placement.mmd, sequence/drag-drop.mmd, ui-inventory/whiteboard.md, evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** Whiteboards — **Card ≠ Placement invariant**, central spatial canvas
- **Risk axes:** UI, perf, data
