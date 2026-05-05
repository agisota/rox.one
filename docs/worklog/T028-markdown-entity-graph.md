# T028 Markdown Entity Graph MVP

## 1. Task summary

Implement a minimal shared markdown entity graph builder for ROX ONE workbench documents.

## 2. Repo context discovered

- The ticket file `docs/tickets/T028-markdown-entity-graph.md` is a placeholder and points back to the master backlog.
- Existing workbench business logic lives in `packages/shared/src/workbench`.
- Existing workbench modules are pure TypeScript with Bun unit tests under `packages/shared/src/workbench/__tests__`.
- `packages/shared/src/workbench/index.ts` is the aggregate workbench export surface.
- `@rox-agent/shared` exposes `./workbench` in `packages/shared/package.json`; individual workbench subpath exports exist for earlier modules, but T028 can start from the aggregate export.
- No existing markdown entity graph module was found.
- Existing markdown renderer and overlay code lives in `packages/ui`, but this MVP can be implemented as shared parsing logic without UI or file IO.

## 3. Files inspected

- `docs/tickets/T028-markdown-entity-graph.md`
- `packages/shared/src/workbench/index.ts`
- `packages/shared/src/index.ts`
- `packages/shared/package.json`
- `packages/shared/src/workbench/option-graph.ts`
- `packages/shared/src/workbench/__tests__/option-graph.test.ts`
- `packages/ui/src/components/markdown/*`
- `packages/ui/src/lib/file-classification.ts`

## 4. Tests added first

- `packages/shared/src/workbench/__tests__/markdown-entity-graph.test.ts`
  - extracts document, heading, entity, tag, and reference nodes
  - creates deterministic mention/tag/reference edges
  - attaches pre-heading references to the document node
  - ignores fenced code blocks
  - summarizes graph counts without returning markdown content

## 5. Expected failing test output

`bun test packages/shared/src/workbench/__tests__/markdown-entity-graph.test.ts`

```text
error: Cannot find module '../markdown-entity-graph'
0 pass
1 fail
1 error
```

## 6. Implementation changes

- Added `packages/shared/src/workbench/markdown-entity-graph.ts`.
- Added zod schemas and exported TypeScript types for graph nodes, edges, and graph shape.
- Implemented `buildMarkdownEntityGraph` for document, heading, `[[wikilink]]`, markdown link, and `#tag` extraction.
- Implemented deterministic slug IDs, sorted node/edge output, duplicate node suppression, and duplicate edge suppression.
- Implemented fenced code block skipping for triple-backtick and tilde fences.
- Implemented `summarizeMarkdownEntityGraph` count output that does not return source markdown content.
- Exported the module from `packages/shared/src/workbench/index.ts`.

## 7. Validation commands run

- `bun test packages/shared/src/workbench/__tests__/markdown-entity-graph.test.ts`
- `bun test packages/shared/src/workbench/__tests__/markdown-entity-graph.test.ts packages/shared/src/workbench/__tests__/option-graph.test.ts`
- `bun run typecheck:shared`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:electron`
- `bun run validate:docs`
- `git diff --check`
- `bun run electron:build`

## 8. Passing test output summary

- Targeted T028 test: 3 pass, 0 fail, 6 expect calls.
- Workbench regression slice: 8 pass, 0 fail, 25 expect calls.
- Shared typecheck: pass.
- Server-core typecheck: pass.
- Electron typecheck: pass.
- Docs validation: pass.
- Whitespace diff check: pass.

## 9. Build output summary

`bun run electron:build` completed successfully:

- main/preload/renderer/resource/assets build steps passed
- existing Vite chunk-size and jotai deprecation warnings were emitted
- no build errors

## 10. Remaining risks

- MVP parser is regex-based and intentionally limited; it is not a full CommonMark AST.
- Inline code spans are now ignored for entity/tag/reference extraction, but the parser is still not a full markdown AST.
- No UI graph visualization is included in this ticket; the closure here is shared graph truth and edge-case parsing.
- No persistent graph index or cross-document graph merge is included yet.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Extracts document, heading, entity, tag, and reference nodes from markdown | Pass | `markdown-entity-graph.test.ts` |
| Creates deterministic mention/tag/reference edges | Pass | `markdown-entity-graph.test.ts` |
| Deduplicates repeated nodes and edges | Pass | repeated `[[Design Team]]` yields one node and one mention edge |
| Ignores fenced code blocks | Pass | code-fence test excludes code entity, tag, and link |
| Avoids IO, network, and executable markdown behavior | Pass | pure shared function; no filesystem/network/browser APIs |
| Shared typecheck passes | Pass | `bun run typecheck:shared` |
| Relevant build passes | Pass | `bun run electron:build` |
| Inline code spans are ignored | Pass | 2026-05-05 test excludes hidden entity/tag/reference inside inline code |
| Wikilink anchors and aliases normalize deterministically | Pass | 2026-05-05 test maps `[[Design System#Tokens|token map]]` to `entity:design-system` |

## 12. 2026-05-05 closure pass

### Tests added first

- Extended `packages/shared/src/workbench/__tests__/markdown-entity-graph.test.ts` with a red test for inline code masking and wikilink anchors/aliases.

### Expected failing output

`bun test packages/shared/src/workbench/__tests__/markdown-entity-graph.test.ts`

```text
3 pass
1 fail
error: expected graph without inline-code entities, received entity:hidden-entity, reference:hidden-md, tag:hidden
```

### Implementation changes

- Added inline code masking before wikilink, markdown-link, and tag extraction.
- Extended wikilink parsing to accept `[[Page#Anchor|alias]]` and normalize it to the page entity.

### Validation commands and results

- `bun test packages/shared/src/workbench/__tests__/markdown-entity-graph.test.ts` -> 4 pass, 0 fail, 8 expect calls.
- `bun test packages/shared/src/workbench/__tests__/markdown-entity-graph.test.ts packages/shared/src/workbench/__tests__/browser-research-integration.test.ts packages/shared/src/workbench/__tests__/option-graph.test.ts packages/shared/src/workbench/__tests__/product-mode-registry.test.ts packages/shared/src/agent/__tests__/browser-tools-permissions.test.ts` -> 25 pass, 0 fail, 211 expect calls.
- `bun run typecheck:shared` -> pass.
- `git diff --check` -> pass.

### Acceptance update

Status: DONE. The remaining UI graph visualization and persistent cross-document index are future scope, not blockers for the shared entity graph ticket.
