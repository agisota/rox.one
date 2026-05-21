# WT-57: Graph view (relationship visualization)

**Branch:** `feat/graph-view` | **Wave:** 3 | **Priority:** P2 | **Flag:** `rox.feature.graph-view-v1` (OFF) | **Cut:** ui
**Parent epic:** PZD-117 (E06) | **FB board:** Frictionless UX (`6a0db0e7d1e3f457181dd1dd`)

## 1. Objective
Global graph view ContentObject nodes + Relation edges. Filter by tag/type/date/relation-type. Focus on single object's neighborhood (1-2-3 hops).

## 2. User goal
User: opens Graph → sees all cards/notes/sources as nodes, relations as edges → filter "show only related_to from this card 2 hops" → zoom → click node → opens detail.

## 3. Files allowed
- `apps/electron/src/renderer/pages/graph/GraphView.tsx`
- `apps/electron/src/renderer/pages/graph/GraphCanvas.tsx`
- `apps/electron/src/renderer/pages/graph/GraphFilters.tsx`
- `apps/electron/src/renderer/pages/graph/__tests__/*.test.tsx`
- `packages/shared/src/graph/graph-builder.ts` (BFS/DFS helpers)

## 4. Files forbidden
WT-46/47/52 cores. Root scaffolds.

## 5. Depends on
WT-46, WT-47, WT-52 (canvas patterns reused).

## 6. Blocks
None.

## 7. Functional requirements
- **FR-1**: GraphBuilder: from `{objects[], relations[]}` → React Flow / vis-network nodes+edges.
- **FR-2**: Filters: object type, tag, date range, relation type, hop depth (1-3).
- **FR-3**: Focus mode: click node → highlight neighborhood + dim others.
- **FR-4**: Performance: 1000 nodes + 5000 edges < 200ms initial; 60 FPS pan/zoom.
- **FR-5**: Click node → opens detail в right panel.
- **FR-6**: Mini-map в углу для navigation.

## 8. Non-functional requirements
- **NFR-1**: perf 1000 nodes < 200ms.
- **NFR-2**: a11y: keyboard nav для filters; canvas с aria-label.
- **NFR-3**: bundle: xyflow ≤ 100 KB (re-used from WT-52).

## 9. Data model
No new entities. Reads WT-46 + WT-47.

## 10-12. API/UI/Security
`graph:build(filters)` → `{nodes, edges}`. Tenant-isolated. Permission-filtered (drop unseen objects).

## 13. TDD test list
T-1: build from 100 objects + 500 relations. T-2: filter by tag drops non-matching. T-3: focus mode dims non-neighbor nodes. T-4: hop-depth 2 includes 2-hop neighbors. T-5: perf 1000 nodes < 200ms. T-6: 60 FPS pan/zoom. T-7: click node opens detail. T-8: cross-tenant: shows zero nodes. T-9: permission-filter excludes denied. T-10: a11y keyboard filter nav.

## 14. AC
10 TDD + 3-machine + axe-clean + bundle gate + typecheck/lint exit 0.

## 15-22. Standard
Roles: standard. Linear PZD-117, 4 stories. FB alias `wt-57-graph-view`. Inspiration: https://github.com/agisota/reaflow (partial_port), https://github.com/Ovyerus/prismaliser (reference_only), https://github.com/safishamsi/graphify (concept — graph rendering), https://github.com/hijohnnylin/neuronpedia (reference_only), https://github.com/d3/d3 (adapter — d3-force for layout).

## 23. Mission control axes
- **Work type:** new_module
- **CJM scenarios:** explore-graph, focus-node-neighborhood, filter-graph
- **UI surfaces:** GraphView, GraphCanvas, GraphFilters, MiniMap
- **Entities touched:** ContentObject, Relation (read-only)
- **Relations touched (WT-47):** ALL (graph displays all)
- **Events emitted (WT-49):** graph.opened
- **AI context (WT-48):** N/A (read-only viz)
- **Search index (WT-50):** N/A (uses Relations directly)
- **Heptabase parity:** Map of Content / global graph
- **Risk axes:** UI, perf
