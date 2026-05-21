# WT-50: SearchIndex (full-text + tag + relationship)

**Branch:** `feat/search-index`
**Base SHA:** `7c12d14ed6fd`
**Wave:** 1
**Priority:** P0
**Feature flag:** `rox.feature.search-index-v1` (default OFF)
**Parent epic:** PZD-122 (E11 Workspaces)
**Featurebase board:** Compounding (`6a0db1b591b619c8111329f2`)

## 1. Objective

Универсальный search index покрывающий все объекты ContentObject/Block/Tag/Source/Annotation/Relation. Один backend для global search + AI retrieval + command palette.

## 2. User goal

Cmd+K → пользователь печатает запрос → за <100ms видит relevant cards/notes/sources/whiteboards с tag фильтром, relationship фильтром (related-to), date range.

## 3. Files allowed

- `packages/shared/src/search/search-index.ts`
- `packages/shared/src/search/indexer.ts`
- `packages/shared/src/search/query-parser.ts`
- `packages/shared/src/search/__tests__/search-index.test.ts`
- `packages/server-core/src/search/sqlite-fts.ts` (FTS5 backend)
- `packages/server-core/src/search/__tests__/sqlite-fts.test.ts`

## 4. Files forbidden

- `packages/shared/src/core/content-object.ts` (WT-46)
- `packages/shared/src/core/relation.ts` (WT-47)
- root scaffolds

## 5. Depends on

- WT-46 (ContentObject), WT-47 (RelationService), WT-49 (ActivityEvent — для incremental reindex triggers)

## 6. Blocks

- WT-51 (Card Library — uses search), WT-34 (Agent Run UI — AI retrieval), WT-37 (Command palette в onboarding)

## 7. Functional requirements

- **FR-1**: SQLite FTS5 backend in local mode + abstraction layer для future ClickHouse/Postgres.
- **FR-2**: Indexed fields: ContentObject.title, Block.content, Tag.name, Source.metadata.title+description, Annotation.text, Relation.type+source/target_title.
- **FR-3**: Query parser: free-text + filters: `tag:foo`, `type:card`, `before:2026-05-01`, `relates-to:<id>`, `author:me`.
- **FR-4**: Incremental reindex via WT-49 subscriber on `content_object.updated`, `block.updated`, `relation.created`.
- **FR-5**: Tenant isolation — search results filtered by tenantId at query time.
- **FR-6**: Ranking: BM25 + recency boost + popularity (relation count).
- **FR-7**: Full reindex job: backfill via `bun run search:reindex` (admin).
- **FR-8**: API: `search(query, filters, limit, offset)` → `{results: ObjectRef[], facets, took_ms}`.

## 8. Non-functional requirements

- **NFR-1 perf**: query < 100ms p95 for 10k objects, < 200ms p99.
- **NFR-2 freshness**: index lag < 1s p95 after WT-49 event.
- **NFR-3 disk**: index ≤ 30% of source data size.
- **NFR-4 tenant isolation**: cross-tenant query returns 0 results.

## 9. Data model

FTS5 virtual table:
```sql
CREATE VIRTUAL TABLE search_index USING fts5(
  tenant_id UNINDEXED,
  object_id UNINDEXED,
  object_type UNINDEXED,
  title,
  body,
  tags,
  author_id UNINDEXED,
  created_at UNINDEXED,
  updated_at UNINDEXED,
  relation_count UNINDEXED,
  tokenize = 'porter unicode61'
);
```

## 10. API / IPC

- `search:query(query, filters, options)` → SearchResults
- `search:reindex(scope?)` → ReindexResult (admin)
- `search:facets(query, filters)` → Facets (counts by type/tag/author)
- `search:suggest(prefix, limit=10)` → Suggestions (typeahead)

## 11. UI/UX

No UI (consumed by command palette WT-37, Card Library WT-51, Agent Run WT-34).

## 12. Security / RBAC

- Tenant filter MANDATORY на каждом query (enforced via repository).
- Permission filter post-query: drop results user не имеет read.

## 13. TDD test list

- T-1: `index ContentObject title + Block content searchable`
- T-2: `query parser parses tag:/type:/before:/relates-to: filters`
- T-3: `incremental reindex on content_object.updated event < 1s`
- T-4: `cross-tenant query returns empty`
- T-5: `permission-filtered: user A search doesn't return user B's private cards`
- T-6: `BM25 ranking + recency boost`
- T-7: `facets returns counts by type/tag/author`
- T-8: `suggest typeahead < 50ms for 10-char prefix`
- T-9: `full reindex job processes 10k objects < 60s`
- T-10: `perf: query < 100ms p95 for 10k objects (benchmark)`

## 14. Acceptance criteria

- AC-1: 10 TDD pass.
- AC-2: Perf benchmark < 100ms p95.
- AC-3: Incremental reindex < 1s lag verified.
- AC-4: Cross-tenant + permission filter zero leak.
- AC-5: Reindex job processes 10k objects < 60s.
- AC-6: typecheck + lint exit 0.

## 15. 14+8-role plan

| Phase | Roles |
|---|---|
| Discovery | brainstormer, scope-analyzer, critic |
| Design | erd-writer, sequence-chart-writer, prompt-writer |
| Impl | test-writer, implementer, super-coder, reviewer |
| Verify | verifier, critic, integrator |
| Optimize | optimizer, observability-engineer (perf metrics) |

## 16. Verification protocol

- 3-machine + perf benchmark + load test (10k objects index + query).

## 17. Feature flag

`rox.feature.search-index-v1`, default OFF. Release cut: `foundation`.

## 18. Linear mapping

- Parent: PZD-122
- Child stories: "FTS5 schema + indexer", "Query parser + filters", "Incremental reindex subscriber", "Ranking BM25 + recency", "Reindex job + perf benchmark"

## 19. Featurebase mapping

- Board: Compounding
- Post alias: `wt-50-search-index`

## 20. Inspiration repos (5)

- https://github.com/fivetaku/insane-search — `reference_only` — fast SQLite-based search patterns.
- https://github.com/databendlabs/databend — `reference_only` — analytics search engine.
- https://github.com/safishamsi/graphify — `concept` — graph-aware search ranking.
- https://github.com/sansan0/bilibili-comment-analyzer — `reference_only` — full-text + filter search.
- https://github.com/assafelovic/gpt-researcher — `reference_only` — search + AI retrieval coupling.

## 21. Definition of done

- [ ] 10 TDD pass
- [ ] Perf < 100ms p95 verified
- [ ] Incremental reindex lag < 1s
- [ ] Cross-tenant + permission zero leak
- [ ] Reindex job 10k objects < 60s
- [ ] typecheck + lint exit 0

## 22. Open questions

- Q1: Vector embeddings — add semantic search in v1 or defer? **Defer to v2; v1 is FTS5 only.**
- Q2: Index storage location — single SQLite file vs sharded per-workspace? **Single file v1; shard если > 100k objects.**

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** cmd-k-search, ai-retrieval, typeahead-suggest
- **UI surfaces affected:** N/A (consumed by command palette, agent run UI)
- **Entities touched:** SearchIndex (virtual table)
- **Relations touched (WT-47):** Indexed for `relates-to:<id>` filter
- **Events emitted (WT-49):** `search.indexed`, `search.reindex.completed`
- **Subscribes to (WT-49):** `content_object.updated`, `block.updated`, `relation.created`, `tag.assigned`
- **AI context implications (WT-48):** AI retrieval uses search index for context expansion
- **12-gate artifacts required:** erd/index-schema.mmd, sequence/incremental-reindex.mmd, contracts/search-query.ts, evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** Quick Search + Search Everything
- **Risk axes:** data, security, perf
