# WT-53: Tags + TagProperty + TagAssignment

**Branch:** `feat/tags-properties`
**Wave:** 2 | **Priority:** P1 | **Flag:** `rox.feature.tags-v1` (OFF) | **Cut:** ui
**Parent epic:** PZD-117 (E06) | **FB board:** Frictionless UX (`6a0db0e7d1e3f457181dd1dd`)

## 1. Objective

Tags + TagProperty (database-like views): `Tag {id, name, color, parent_tag_id?}`, `TagProperty {tag_id, key, type, default_value}`, `TagAssignment {object_id, tag_id, property_values}`. Hierarchical tags, typed property values, filterable views.

## 2. User goal

User: tag card "research" — adds Tag. Tag "research" has property "status" (enum: idea/active/archived). User filters CardLibrary by tag=research + status=active.

## 3. Files allowed

- `packages/shared/src/core/tag.ts`
- `packages/shared/src/core/tag-property.ts`
- `packages/shared/src/core/tag-assignment.ts`
- `packages/server-core/src/migrations/20260521-tags.sql`
- `packages/shared/src/tag-service/*` + `__tests__/`
- `apps/electron/src/renderer/components/tags/TagPicker.tsx`, `TagInspector.tsx`

## 4. Files forbidden

WT-46/47 core files, root scaffolds.

## 5. Depends on

WT-46 (ContentObject — tagged), WT-47 (RelationService — uses 'tagged_with' for backlinks), WT-50 (SearchIndex — tag facet).

## 6. Blocks

WT-51 tag UI inside CardInspector, WT-57 graph tag-filter.

## 7. Functional requirements

- **FR-1**: Tag hierarchy (max depth 5), unique name per workspace.
- **FR-2**: TagProperty types: `text | number | enum | date | boolean | url`.
- **FR-3**: TagAssignment stores per-assignment property_values JSON.
- **FR-4**: Inherited tags: child tag inherits parent's properties.
- **FR-5**: Filter API: `getByTag(workspaceId, tagName, propertyFilters?)`.
- **FR-6**: TagPicker UI: typeahead, create-on-the-fly, color preview.
- **FR-7**: WT-47 Relation type='tagged_with' для backlinks (find all cards with tag X).
- **FR-8**: Audit emit `tag.assigned`, `tag.unassigned`, `tag.created`.

## 8. Non-functional requirements

- **NFR-1**: getByTag < 50ms for tag with 1000 assignments.
- **NFR-2**: TagPicker typeahead < 100ms.

## 9. Data model

```typescript
interface Tag { id, tenantId, workspaceId, name, color, parentTagId?, createdAt }
interface TagProperty { id, tagId, key, type: 'text'|'number'|'enum'|'date'|'boolean'|'url', defaultValue?, enumOptions?: string[] }
interface TagAssignment { id, tenantId, objectId, tagId, propertyValues: Record<string, unknown>, createdAt, createdBy }
```

## 10. API / IPC

`tag:create/list/update/delete`, `tagProperty:*`, `tagAssignment:assign/unassign/list`, `getByTag(workspaceId, tagName, propertyFilters?)`.

## 11. UI/UX

TagPicker (inline popover на CardInspector): search input + tag-list + "+ Create" + color swatches. Hover: tag color stripe.

## 12. Security

Tenant + workspace isolation. Assignment requires `write` on object.

## 13. TDD test list

- T-1: `create tag with parent enforces depth ≤ 5`
- T-2: `unique tag name per workspace` (case-insensitive)
- T-3: `TagProperty type validation: enum requires options[]`
- T-4: `inherited tags propagate properties from parent`
- T-5: `getByTag returns objects + filter by propertyValue`
- T-6: `TagPicker typeahead < 100ms for 100 tags`
- T-7: `assign creates WT-47 Relation type='tagged_with'`
- T-8: `audit emit on assign/unassign/create`
- T-9: `cross-tenant tag query returns empty`
- T-10: `axe-core clean on TagPicker`

## 14. Acceptance criteria

- AC-1: 10 TDD pass.
- AC-2: 3-machine screenshots.
- AC-3: Perf benchmarks met.
- AC-4: axe-core clean.
- AC-5: typecheck + lint exit 0.

## 15. 14+8-role plan

Discovery: brainstormer/scope-analyzer/critic/cjm-writer. Design: erd-writer/ui-inventory-writer/ux-guru/prompt-writer. Impl: test-writer (opus)/implementer/super-coder/reviewer. Verify: verifier/critic/integrator. Optimize: optimizer.

## 16. Verification protocol

3-machine + perf test 1000 assignments < 50ms + axe.

## 17-19. Featurebase/Linear

Linear PZD-117 (E06), 5 child stories. FB: Frictionless UX, alias `wt-53-tags-properties`.

## 20. Inspiration repos

- https://wiki.heptabase.com/ — `concept` — Heptabase Tags + Tag Properties.
- https://github.com/nocobase/nocobase — `reference_only` — typed property fields.
- https://github.com/Developer-Mike/obsidian-advanced-canvas — `reference_only` — tag-driven canvas views.
- https://github.com/TfTHacker/obsidian-canvas-candy — `reference_only` — tag visualization.
- https://github.com/RSSNext/Folo — `reference_only` — tagging UX in feed reader.

## 21. Definition of done

10 TDD pass, 3-machine screenshots, axe clean, typecheck/lint exit 0, FB/Linear synced.

## 22. Open questions

- Q1: Property type validation at API edge vs DB constraint? **API edge (Zod) for v1; DB column-typed в v2.**
- Q2: Tag color palette — preset or custom? **Preset 12 colors + custom hex.**

## 23. Mission control axes

- **Work type:** new_module
- **CJM scenarios:** create-tag, assign-tag-to-card, filter-by-tag-property
- **UI surfaces:** TagPicker (popover), TagInspector (tag detail panel)
- **Entities touched:** Tag, TagProperty, TagAssignment
- **Relations touched (WT-47):** tagged_with
- **Events emitted (WT-49):** tag.created, tag.assigned, tag.unassigned
- **AI context (WT-48):** Tag membership included в context preview
- **Search index (WT-50):** Tag facet indexed
- **12-gate artifacts:** cjm/assign-tag.md, erd/tag.mmd, ui-inventory/tag-picker.md, evidence/{mac,win,linux}/
- **Heptabase parity:** Tags + Tag Properties (database-like views)
- **Risk axes:** UI, data
