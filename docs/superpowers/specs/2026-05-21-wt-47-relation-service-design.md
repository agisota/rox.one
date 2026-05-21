# WT-47: RelationService (typed bidirectional relations)

**Branch:** `feat/relation-service`
**Base SHA:** `7c12d14ed6fd`
**Wave:** 0+
**Priority:** P0
**Feature flag:** `rox.feature.relation-service-v1` (default OFF)
**Parent epic:** PZD-122 (E11 Workspaces)
**Featurebase board:** Compounding (`6a0db1b591b619c8111329f2`)
**Status:** Design

## 1. Objective

Centralized `Relation` table + bidirectional service. Backlinks, mentions, source citations, related cards, Whiteboard placements, AI citations — все через одну Relation table, **не ad-hoc arrays внутри карточки**.

## 2. User goal

Когда пользователь "линкает" одну карту к другой (через `[[mention]]`, drag-drop в Whiteboard, source citation), запись в Relation table — и любой обратный запрос (`getBacklinks(cardId)`) находит это автоматически без duplicate state.

## 3. Files allowed

- `packages/shared/src/core/relation.ts`
- `packages/shared/src/relation-service/relation-service.ts`
- `packages/shared/src/relation-service/__tests__/relation-service.test.ts`
- `packages/server-core/src/schema/relation.ts`
- `packages/server-core/src/migrations/20260521-relation.sql`
- `packages/server-core/src/__tests__/relation-migration.test.ts`

## 4. Files forbidden

- `packages/shared/src/core/content-object.ts` (WT-46 owns)
- `packages/shared/src/core/block.ts` (WT-46 owns)
- root `package.json`, `tsconfig.json`

## 5. Depends on

- WT-46 (ContentObject)

## 6. Blocks

- WT-48 (AIContextPacket), WT-50 (SearchIndex), WT-51 (Card Library backlinks UI), WT-52 (Whiteboard Placement is a Relation), WT-53 (Tags assignment is Relation), WT-55 (Annotations link via Relation), WT-57 (Graph view)

## 7. Functional requirements

- **FR-1**: `Relation` schema (Zod + TS): `{id (uuid v7), tenantId, sourceObjectId, targetObjectId, type, metadata?, createdAt, createdBy}`.
- **FR-2**: `RelationType` union: `'mentions' | 'related_to' | 'derived_from' | 'cites' | 'placed_on' | 'tagged_with' | 'authored_by' | 'attached_to' | 'annotated' | 'replied_to'`. Extensible через registry.
- **FR-3**: `getRelations(objectId, options)` returns BOTH outgoing AND incoming (bidirectional).
- **FR-4**: `getBacklinks(objectId, type?)` — convenience: incoming only, optional type filter.
- **FR-5**: `createRelation(source, target, type, metadata?)` — idempotent (same triple is no-op).
- **FR-6**: `deleteRelation(id)` — soft? hard? **HARD delete** (no soft for relations — easier to rebuild than to track tombstones).
- **FR-7**: Cascade: when ContentObject soft-deleted, related Relations marked `deletedAt` mirror. Hard-delete object → hard-delete relations.
- **FR-8**: Indices: `(tenantId, sourceObjectId, type)`, `(tenantId, targetObjectId, type)` для < 10ms bidirectional lookups.

## 8. Non-functional requirements

- **NFR-1 perf**: bidirectional getRelations < 10ms for object with 100 relations.
- **NFR-2 idempotency**: createRelation(A→B, type=X) twice is one row.
- **NFR-3 tenant isolation**: cross-tenant relations cannot be queried.
- **NFR-4 RelationType registry**: extensible without DB migration (string column, validated at API edge).

## 9. Data model

```typescript
type RelationType = 'mentions' | 'related_to' | 'derived_from' | 'cites'
                  | 'placed_on' | 'tagged_with' | 'authored_by' | 'attached_to'
                  | 'annotated' | 'replied_to';

interface Relation {
  id: string;          // uuid v7
  tenantId: string;
  sourceObjectId: string;
  targetObjectId: string;
  type: RelationType;
  metadata?: Record<string, unknown>;  // type-specific (e.g. placement: x/y/z, mention: block_id+offset)
  createdAt: string;
  createdBy: string;
}
```

Migration:
```sql
CREATE TABLE relations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  source_object_id UUID NOT NULL REFERENCES content_objects(id),
  target_object_id UUID NOT NULL REFERENCES content_objects(id),
  type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  UNIQUE (tenant_id, source_object_id, target_object_id, type)
);
CREATE INDEX idx_relations_src ON relations (tenant_id, source_object_id, type);
CREATE INDEX idx_relations_tgt ON relations (tenant_id, target_object_id, type);
ALTER TABLE relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY relations_tenant_iso ON relations
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

## 10. API / IPC

- `relation:create(input)` → Relation
- `relation:delete(id)` → void
- `relation:getRelations(objectId, options?)` → Relation[] (bidirectional)
- `relation:getBacklinks(objectId, type?)` → Relation[] (incoming only)
- `relation:countRelations(objectId, type?)` → number

## 11. UI/UX

No UI in this WT. Consumers (WT-51 Card backlinks panel, WT-57 Graph view) render UI.

## 12. Security / RBAC

- All queries tenant-isolated via RLS.
- Create permission check: user must have `read` on BOTH source and target (cannot relate to unseen object).
- Audit emit via WT-49: `relation.created`, `relation.deleted`.

## 13. TDD test list

- T-1: `createRelation persists with uuid v7 id`
- T-2: `createRelation idempotent — same triple twice is single row`
- T-3: `getRelations returns both outgoing and incoming`
- T-4: `getBacklinks returns incoming only, filtered by type`
- T-5: `cross-tenant getRelations returns empty (RLS)`
- T-6: `cascade on ContentObject soft-delete marks relations`
- T-7: `cascade on ContentObject hard-delete hard-deletes relations`
- T-8: `unique constraint blocks duplicate (src, tgt, type)`
- T-9: `getRelations < 10ms for 100 relations (perf test)`
- T-10: `createRelation denied when user lacks read on target`

## 14. Acceptance criteria

- AC-1: All 10 TDD tests pass.
- AC-2: Migration up+down reversible.
- AC-3: Perf: 100-relation getRelations < 10ms.
- AC-4: Idempotency verified via integration test.
- AC-5: RLS cross-tenant test blocks read.
- AC-6: typecheck + lint exit 0.

## 15. 14+8-role plan

| Phase | Roles | Output |
|---|---|---|
| Discovery | brainstormer, scope-analyzer, critic | docs |
| Design | erd-writer, prompt-writer | erd/relation.mmd, contracts/relation.ts |
| Impl | test-writer (opus), implementer, super-coder, reviewer | tests + code |
| Verify | verifier, critic, integrator | evidence |
| Optimize | optimizer | perf notes |

## 16. Verification protocol

- 3-machine: full test suite + perf benchmark.
- Migration test: up → seed 1000 relations → down → re-up → data preserved.

## 17. Feature flag

`rox.feature.relation-service-v1`, default OFF. Release cut: `foundation`.

## 18. Linear mapping

- Parent: PZD-122
- Child stories: "Relation schema + Zod + idempotency", "Bidirectional getRelations + indices", "Cascade + RLS + audit emit", "Perf benchmark"

## 19. Featurebase mapping

- Board: Compounding
- Post alias: `wt-47-relation-service`

## 20. Inspiration repos (5)

- https://github.com/agisota/obsidian-node-flow — `concept` — Obsidian-style backlinks model.
- https://github.com/LincZero/obsidian-node-flow — `concept` — Bidirectional relation visualization.
- https://github.com/safishamsi/graphify — `concept` — Knowledge graph as first-class.
- https://github.com/nocobase/nocobase — `reference_only` — Relation field as schema element.
- https://github.com/Ovyerus/prismaliser — `reference_only` — Prisma relation viz patterns.

## 21. Definition of done

- [ ] All 10 TDD tests pass
- [ ] Migration up+down reversible
- [ ] Perf < 10ms verified
- [ ] RLS cross-tenant blocked
- [ ] typecheck + lint exit 0
- [ ] 3-machine smoke pass
- [ ] Linear sub-issue Done, FB post Shipped

## 22. Open questions

- Q1: Relation directionality semantics — is `placed_on` directional (card → whiteboard) or symmetric? **Directional. Whiteboard is target, Card is source.**
- Q2: Cycle prevention для `related_to` (A→B→C→A)? **No restriction; cycles are valid for related_to but not for derived_from. Enforce per type.**

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** N/A (data layer)
- **UI surfaces affected:** N/A
- **Entities touched:** Relation (NEW), references ContentObject (WT-46)
- **Relations touched:** ВСЕ — это foundational service
- **Events emitted (WT-49):** `relation.created`, `relation.deleted`
- **AI context implications (WT-48):** Critical — AI context packet uses RelationService для citation traversal
- **Search index implications (WT-50):** Indexed by type for filter queries
- **12-gate artifacts required:** erd/relation.mmd, sequence/create-relation.mmd, contracts/relation.ts, evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** Backlinks/mentions/citations/placements — universal Relation table
- **Risk axes:** data, security, perf
