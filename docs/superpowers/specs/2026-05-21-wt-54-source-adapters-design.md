# WT-54: Source adapters (PDF, Web Clipper, Zotero, Readwise)

**Branch:** `feat/source-adapters`
**Wave:** 2 | **Priority:** P1 | **Flag:** `rox.feature.source-adapters-v1` (OFF) | **Cut:** sources
**Parent epic:** PZD-114 (E03 Sources/MCP) | **FB board:** Compounding (`6a0db1b591b619c8111329f2`)

## 1. Objective

Pluggable SourceDefinition contract + 4 initial adapters (PDF, Web Clipper, Zotero, Readwise) которые импортируют контент в ContentObject{type='source'} + cascading Annotations через WT-55.

## 2. User goal

User: drag PDF в Sources panel → adapter parses → создаёт Source object + per-section ContentObjects + Annotations highlights from PDF. Same flow для web URL (Web Clipper), Zotero library export, Readwise highlights.

## 3. Files allowed

- `packages/shared/src/source/source-definition.ts` (contract)
- `packages/shared/src/source/adapter-registry.ts`
- `packages/shared/src/source/adapters/pdf.ts`
- `packages/shared/src/source/adapters/web-clipper.ts`
- `packages/shared/src/source/adapters/zotero.ts`
- `packages/shared/src/source/adapters/readwise.ts`
- `packages/shared/src/source/__tests__/*.test.ts`

## 4. Files forbidden

WT-46/47 core, root scaffolds.

## 5. Depends on

WT-46 (ContentObject{type=source}), WT-47 (Relations: source-document → child objects via 'derived_from').

## 6. Blocks

WT-55 (Annotations link via Source).

## 7. Functional requirements

- **FR-1**: `SourceDefinition` contract: `{id, name, version, icon, fileTypes[], importFunc, oauthConfig?}`.
- **FR-2**: `importFunc(input) → {source, contentObjects, annotations}` — atomic transaction.
- **FR-3**: PDF adapter: extract text per page → ContentObject per heading-section, highlights → Annotations.
- **FR-4**: Web Clipper: scrape URL (cheerio/playwright), readability extract → ContentObject per heading + thumbnail.
- **FR-5**: Zotero: OAuth + bulk fetch → bibliographic metadata + attached PDFs.
- **FR-6**: Readwise: OAuth + highlights API → Annotations.
- **FR-7**: Idempotency: same source URL/file hash twice does not duplicate.
- **FR-8**: SSRF guard в Web Clipper (deny private IPs, localhost, file://).
- **FR-9**: OAuth secret storage via WT-09 secrets manager.

## 8. Non-functional requirements

- **NFR-1**: PDF import 100MB / 200 pages < 30s.
- **NFR-2**: Web Clipper SPA (JS-rendered) < 15s.
- **NFR-3**: Zotero bulk 1000 items < 5min.

## 9. Data model

Uses WT-46 ContentObject{type='source'} + Block. Source metadata fields: `{originalUrl, fileHash, mimeType, importedAt, adapterId, oauthAccountId?}`.

## 10. API / IPC

`source:import(adapterId, input)`, `source:list(filters)`, `adapter:register(definition)`, `oauth:connect(adapterId)`.

## 11. UI/UX

Adapter is backend; UI consumed by Sources page (separate module — TBD WT in v3) and CardInspector "Add source" button.

## 12. Security

SSRF guard (Web Clipper). OAuth tokens via WT-09 secrets manager. Per-adapter scope validation.

## 13. TDD test list

- T-1: `PDF adapter creates Source + per-section ContentObjects + highlights as Annotations`
- T-2: `Web Clipper readability extract preserves headings + paragraphs`
- T-3: `Web Clipper SSRF guard rejects 127.0.0.1, 10./172./192.168, file://`
- T-4: `Zotero OAuth flow + bulk fetch 100 items`
- T-5: `Readwise API mapping: highlights → Annotations`
- T-6: `idempotency: same PDF hash twice — no duplicate`
- T-7: `adapter registry validates SourceDefinition schema`
- T-8: `OAuth token stored via secrets manager (not plain DB)`
- T-9: `PDF 100MB / 200 pages < 30s perf`
- T-10: `Web Clipper SPA < 15s`

## 14. Acceptance criteria

- AC-1: 10 TDD pass.
- AC-2: 4 adapters functional in v1.
- AC-3: SSRF + OAuth security tests pass.
- AC-4: Perf benchmarks met.
- AC-5: typecheck + lint exit 0.

## 15. 14+8-role plan

Discovery: brainstormer/scope-analyzer/critic/cjm-writer. Design: erd-writer/sequence-chart-writer/prompt-writer. Impl: test-writer/implementer/super-coder/reviewer. Verify: verifier/critic/integrator. Optimize: optimizer.

## 16. Verification protocol

3-machine + adapter-specific smoke (real PDF, real URL, sandbox OAuth, mock Readwise).

## 17. Featurebase

Board: Compounding. Alias: `wt-54-source-adapters`.

## 18. Linear

PZD-114, 5 stories: SourceDefinition contract, PDF adapter, Web Clipper + SSRF, Zotero + Readwise, idempotency.

## 19-20. Inspiration repos

- https://github.com/MusiCode1/obsidian-web — `concept` — Web → Obsidian clipper.
- https://github.com/kepano/defuddle — `reference_only` (если применимо) — content extraction.
- https://github.com/agisota/visual-explainer — `reference_only` — content adapter pattern.
- https://github.com/HKUDS/CLI-Anything — `adapter` — universal CLI/file adapter wrapper.
- https://github.com/nutrient-document-processing — `reference_only` (если применимо) — PDF processing.

## 21. Definition of done

10 TDD pass, 4 adapters functional, SSRF + OAuth security verified, perf benchmarks met, typecheck/lint exit 0.

## 22. Open questions

- Q1: PDF library choice — pdf.js vs unpdf vs poppler? **unpdf (modern, smaller bundle); pdf.js fallback для preview render.**
- Q2: Web Clipper backend — local playwright vs cloud worker (Cloudflare)? **Local playwright for v1; cloud в v2 для better perf + parallelism.**

## 23. Mission control axes

- **Work type:** new_module (4 adapters + contract)
- **CJM scenarios:** import-pdf, clip-web-url, connect-zotero, sync-readwise
- **UI surfaces:** Adapter status indicators (TBD in Sources page WT)
- **Entities touched:** ContentObject{type=source}, Annotation (via WT-55)
- **Relations touched (WT-47):** derived_from (source → child sections)
- **Events emitted (WT-49):** source.imported, source.refreshed, oauth.connected
- **AI context (WT-48):** Sources visible в AI context with citations
- **Search index (WT-50):** Source metadata + content indexed
- **12-gate artifacts:** cjm/import-pdf.md, sequence/import-pdf.mmd, sequence/web-clip.mmd, contracts/source-definition.ts, evidence/{mac,win,linux}/
- **Heptabase parity:** PDF/Web/YouTube sources + annotations
- **Risk axes:** security (SSRF + OAuth), data, license
