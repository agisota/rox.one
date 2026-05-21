# WT-46: ContentObject + Block universal schema

**Branch:** `feat/content-object-schema`
**Base SHA:** `7c12d14ed6fd`
**Wave:** 0+
**Priority:** P0
**Feature flag:** `rox.feature.content-object-v1` (default OFF)
**Parent epic:** PZD-122 (E11 Workspaces)
**Featurebase board:** Compounding (`6a0db1b591b619c8111329f2`)
**Status:** Design

## 1. Objective

Корневая объектная модель. Universal `ContentObject` + `Block` schema, на которой Card, Note, Source, Journal, Task, DesignArtifact, File — это **типы одного объекта**, не отдельные таблицы. Без этого Heptabase-like layer невозможен.

## 2. User goal

Команда добавляет новый тип контента (e.g. Whiteboard) одной строкой в enum + миграции, без изобретения новых tables/storage/relations.

## 3. Files allowed

- `packages/shared/src/core/content-object.ts`
- `packages/shared/src/core/block.ts`
- `packages/shared/src/core/__tests__/content-object.test.ts`
- `packages/server-core/src/schema/content-object.ts`
- `packages/server-core/src/migrations/20260521-content-object.sql`
- `packages/server-core/src/__tests__/content-object-migration.test.ts`

## 4. Files forbidden

- `packages/shared/src/core/user.ts` (WT-04), `tenant.ts` (WT-05), `workspace.ts` (WT-06)
- root `package.json`, `tsconfig.json`

## 5. Depends on

- WT-04 (User), WT-06 (Workspace, Tenant ID)

## 6. Blocks

- WT-47, WT-48, WT-49, WT-50, WT-51, WT-52, WT-53, WT-54, WT-55, WT-56, WT-57, WT-58 (everything Object-Platform + Heptabase)

## 7. Functional requirements

- **FR-1**: `ContentObject` Zod + TS: `{id (uuid v7), tenantId, workspaceId, type, title, blocks[], metadata, createdAt, updatedAt, deletedAt?, createdBy}`.
- **FR-2**: `ContentObjectType` union: `'card' | 'note' | 'journal' | 'source' | 'task' | 'design_artifact' | 'file' | 'whiteboard'`. Open for extension via module registry.
- **FR-3**: `Block` schema: `{id, contentObjectId, order, type, content, attributes}`. Types: text/heading/code/image/embed/quote/list_item/todo.
- **FR-4**: DB migration up/down: tables `content_objects`, `blocks` с indices (tenant_id, workspace_id, type, deleted_at), foreign keys.
- **FR-5**: Soft-delete: `deletedAt` timestamp, NOT hard delete. Cascade soft-delete blocks at object soft-delete.
- **FR-6**: Block ordering: monotonic `order` float — insert via averaging neighbors (avoids reordering ripple).
- **FR-7**: `metadata` JSON column для type-specific extension (e.g. card color, journal date).
- **FR-8**: Tenant + workspace isolation: ALL queries MUST scope by tenantId; foreign key to workspace.

## 8. Non-functional requirements

- **NFR-1 perf**: list 1000 objects with 10 blocks each in < 50ms (single tenant).
- **NFR-2 migration safety**: up+down reversible; data preservation on down.
- **NFR-3 schema stability**: backward-compatible until v2 migration.
- **NFR-4 security**: RLS (row-level security) policy enforced; cross-tenant read blocked.

## 9. Data model

```typescript
type ContentObjectType = 'card' | 'note' | 'journal' | 'source' | 'task'
                       | 'design_artifact' | 'file' | 'whiteboard';

interface ContentObject {
  id: string;          // uuid v7 (time-sortable)
  tenantId: string;
  workspaceId: string;
  type: ContentObjectType;
  title: string;
  blocks: Block[];     // ordered by Block.order
  metadata: Record<string, unknown>;
  createdAt: string;   // ISO 8601
  updatedAt: string;
  deletedAt?: string;
  createdBy: string;   // userId
}

interface Block {
  id: string;
  contentObjectId: string;
  order: number;       // float — averaged inserts
  type: 'text' | 'heading' | 'code' | 'image' | 'embed' | 'quote' | 'list_item' | 'todo';
  content: string;     // markdown for text/heading, URL for image, code blob, etc.
  attributes: Record<string, unknown>;  // type-specific (e.g. heading level, code lang, todo checked)
}
```

## 10. API / IPC

- `contentObject:create(input)` → ContentObject
- `contentObject:get(id)` → ContentObject
- `contentObject:list(filters)` → ContentObject[]
- `contentObject:update(id, patch)` → ContentObject
- `contentObject:softDelete(id)` → void
- `contentObject:restore(id)` → ContentObject
- `block:insert(contentObjectId, position, block)` → Block (with computed order)
- `block:reorder(blocks)` → void

## 11. UI/UX

No UI in this WT (pure data layer). Consumers (WT-51 Card Library, WT-52 Whiteboard, etc.) render their own UI on top.

## 12. Security / RBAC

- Every query MUST include tenantId filter (enforced via repository pattern).
- RLS policy `content_objects_tenant_isolation`: SELECT/UPDATE/DELETE filtered by `current_setting('app.tenant_id')`.
- Audit emit on create/update/delete via WT-49 ActivityEvent.

## 13. TDD test list

- T-1: `create ContentObject persists + retrievable by id`
- T-2: `list filtered by type returns only matching`
- T-3: `softDelete sets deletedAt, retains row, blocks also soft-deleted`
- T-4: `restore clears deletedAt`
- T-5: `block insert at middle uses averaged order`
- T-6: `block reorder preserves order monotonicity`
- T-7: `cross-tenant query blocked by RLS`
- T-8: `metadata JSON validates per-type schema (card requires color, journal requires date)`
- T-9: `migration up + down roundtrip preserves data`
- T-10: `uuid v7 ids are time-sortable`

## 14. Acceptance criteria

- AC-1: All 10 TDD tests pass.
- AC-2: Migration up + down reversible (test harness verifies data preservation).
- AC-3: 1000 objects × 10 blocks list < 50ms (perf benchmark).
- AC-4: Cross-tenant read attempt returns empty (not exception).
- AC-5: All 8 content types validate per-type metadata schema.
- AC-6: typecheck + lint exit 0.

## 15. 14+8-role plan

| Phase | Roles | Output |
|---|---|---|
| Discovery | brainstormer, requirements-keeper, scope-analyzer, critic, cjm-writer (low; no UI) | docs |
| Design | erd-writer, prompt-writer, data-refresh-rule-keeper | erd/entities.mmd, contracts/content-object.ts, refresh-rules.md |
| Impl | test-writer (opus), implementer, super-coder, reviewer | tests + code |
| Verify | verifier, critic, integrator | evidence + review |
| Optimize | optimizer, 10x-improver | perf notes |

## 16. Verification protocol

- 3-machine: mac/win/linux full test suite.
- Perf benchmark: 1000 × 10 blocks list time.
- Migration test: up → seed → down → verify data preserved.

## 17. Feature flag

`rox.feature.content-object-v1`, default OFF. Release cut: `foundation`.

## 18. Linear mapping

- Parent: PZD-122 (E11 Workspaces)
- Child stories: "ContentObject schema + Zod + tests", "Block schema + ordering", "Migration up/down + RLS", "Per-type metadata schemas"

## 19. Featurebase mapping

- Board: Compounding
- Post alias: `wt-46-content-object`

## 20. Inspiration repos (5)

- https://github.com/nocobase/nocobase — `concept` — Universal content collection abstraction.
- https://github.com/RSSNext/Folo — `concept` — Multi-type content unified model.
- https://github.com/wasp-lang/open-saas — `reference_only` — Entity schema patterns.
- https://github.com/agisota/multica — `concept` — Universal content registry.
- https://github.com/Mail-0/Zero — `reference_only` — Multi-type message-as-object model.

## 21. Definition of done

- [ ] All 10 TDD tests pass
- [ ] Migration up+down reversible test green
- [ ] RLS cross-tenant test passes
- [ ] Perf benchmark < 50ms for 1000×10
- [ ] typecheck + lint exit 0
- [ ] 3-machine smoke pass
- [ ] Linear sub-issue Done, FB post Shipped

## 22. Open questions

- Q1: Block ordering precision — float vs Lexorank? **Float for v1 (averaging works); migrate to Lexorank if collision > 0.1%.**
- Q2: Metadata schema validation — Zod per type at API edge OR DB constraint? **Zod at edge для v1, DB constraint в v2.**

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** N/A (pure data layer)
- **UI surfaces affected:** N/A
- **Entities touched:** ContentObject (NEW), Block (NEW)
- **Relations touched (WT-47):** N/A (relations introduced in WT-47)
- **Events emitted (WT-49):** `content_object.created`, `content_object.updated`, `content_object.deleted`, `content_object.restored`, `block.inserted`, `block.reordered`
- **AI context implications (WT-48):** Foundational — AI context packets reference ContentObject ids
- **Search index implications (WT-50):** Index ContentObject.title + Block.content
- **12-gate artifacts required:** erd/entities.mmd, sequence/create-content-object.mmd, contracts/content-object.ts, refresh-rules.md, evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** Card → ContentObject{type=card}, universal model где Heptabase has card-only-in-library invariant
- **Risk axes:** data, security
