# WT-55: Annotations (Source-range pinned)

**Branch:** `feat/annotations` | **Wave:** 2 | **Priority:** P1 | **Flag:** `rox.feature.annotations-v1` (OFF) | **Cut:** ui
**Parent epic:** PZD-117 (E06) | **FB board:** Frictionless UX (`6a0db0e7d1e3f457181dd1dd`)

## 1. Objective
Highlight/note/underline annotations pinned к Source-range (PDF page+bbox OR text char-range). Each Annotation может породить Card (via Relation type='annotated').

## 2. User goal
User читает PDF → highlights text → создаётся Annotation → клик "Create card from selection" → создаётся ContentObject{type=card} с blocks из highlight + WT-47 Relation type='annotated' к Source.

## 3. Files allowed
- `packages/shared/src/annotations/annotation.ts`
- `packages/server-core/src/migrations/20260521-annotations.sql`
- `packages/shared/src/annotations/__tests__/*.test.ts`
- `apps/electron/src/renderer/components/annotations/AnnotationOverlay.tsx`
- `apps/electron/src/renderer/components/annotations/AnnotationToolbar.tsx`
- `apps/electron/src/renderer/components/annotations/__tests__/*.test.tsx`

## 4. Files forbidden
WT-46/47/54 cores, root scaffolds.

## 5. Depends on
WT-46 (ContentObject — anchor object), WT-47 (Relation 'annotated'), WT-54 (Source adapters).

## 6. Blocks
WT-51 (CardInspector source-refs panel).

## 7. Functional requirements
- **FR-1**: Annotation schema: `{id, sourceId, contentObjectId, range: TextRange | BBox, type: 'highlight'|'note'|'underline'|'strikethrough', color, text?, createdBy, createdAt}`.
- **FR-2**: `TextRange { startBlockId, startOffset, endBlockId, endOffset }` для text-based content.
- **FR-3**: `BBox { page, x, y, w, h }` для PDF.
- **FR-4**: "Create card from annotation" — создаёт ContentObject{type=card} + блоки из annotation text + Relation type='annotated' к Source.
- **FR-5**: Multi-color palette (8 colors default).
- **FR-6**: Export annotations as markdown / JSON (per source).

## 8. Non-functional requirements
- **NFR-1**: render 100 annotations на PDF page < 100ms.
- **NFR-2**: a11y: annotations have aria-label с text + color.

## 9. Data model
```typescript
type AnnotationRange = TextRange | BBox;
interface Annotation { id, tenantId, sourceId, contentObjectId?, range: AnnotationRange, type, color, text?, createdBy, createdAt, deletedAt? }
```

## 10-12. API/UI/Security
`annotation:create/list/update/delete/export`. Overlay rendered on top of PDFViewer / BlockViewer. Tenant-isolated.

## 13. TDD test list
T-1: highlight text creates TextRange annotation. T-2: PDF bbox annotation persists. T-3: "Create card from annotation" creates Card + Relation type='annotated'. T-4: multi-color palette + custom. T-5: export markdown preserves source refs. T-6: a11y aria-label present. T-7: cross-tenant blocked. T-8: render 100 annotations < 100ms. T-9: soft-delete + restore. T-10: annotation на удалённом source — graceful "Source deleted" overlay.

## 14. AC
10 TDD + 3-machine + axe + typecheck/lint clean.

## 15-22. Roles / Verification / FB / Linear / Inspiration
Standard 14+8-role plan. Linear PZD-117, 5 stories. FB alias `wt-55-annotations`. Inspiration: https://github.com/MusiCode1/obsidian-web (concept), https://github.com/agisota/Markdansi (reference_only), https://github.com/nutrient-document-processing (reference_only — PDF.js annotation patterns), https://github.com/RSSNext/Folo (reference_only), https://wiki.heptabase.com/ (concept — PDF annotations).

## 23. Mission control axes
- **Work type:** new_module
- **CJM scenarios:** highlight-pdf-text, add-note-to-highlight, create-card-from-annotation, export-annotations
- **UI surfaces:** AnnotationOverlay (on PDFViewer + BlockViewer), AnnotationToolbar (floating)
- **Entities touched:** Annotation (NEW), references Source + ContentObject
- **Relations touched (WT-47):** annotated (annotation → source), derived_from (card → annotation)
- **Events emitted (WT-49):** annotation.created, annotation.deleted, card.created (when from annotation)
- **AI context (WT-48):** Annotations included с citations
- **Search index (WT-50):** annotation.text indexed
- **Heptabase parity:** PDF annotations + card-from-annotation
- **Risk axes:** UI, data
