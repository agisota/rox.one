# T010 — Option Graph schema for Spec Builder

## 1. Task summary
Added a shared Option Graph contract for Lego-style Spec Builder requirements. The new module defines required option categories, option schemas, dependency/exclusion rules, available-option filtering, deterministic execution-config derivation, and fixtures for common task shapes.

## 2. Repo context discovered
- `ProductMode`, `ValidationGate`, `ArtifactType`, and `ProductAgentRole` already live in `product-mode-registry.ts` and should remain the single execution vocabulary.
- `resolveProductModeExecutionConfig()` is the correct merge/dedupe path for mode defaults plus selected skills/agents/gates.
- T008/T009 established a safe pattern for shared workbench contracts: Zod schemas, deterministic helpers, direct package subpath exports, and dedicated tests.
- `showOptionGraph` already exists in mode UI panel config, but there was no domain model or resolver behind it.

## 3. Files inspected
- `packages/shared/src/workbench/product-mode-registry.ts`
- `packages/shared/src/workbench/default-workspace-bundle.ts`
- `packages/shared/src/workbench/index.ts`
- `packages/shared/package.json`
- `packages/shared/src/workbench/__tests__/product-mode-registry.test.ts`
- `packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts`
- `packages/shared/src/workbench/__tests__/prompt-rewrite-engine.test.ts`
- `packages/shared/src/workbench/__tests__/thinking-partner.test.ts`

## 4. Tests added first
- `packages/shared/src/workbench/__tests__/option-graph.test.ts`

## 5. Expected failing test output
Initial TDD run failed before implementation for the expected missing module:

```text
error: Cannot find module '../option-graph'
0 pass, 1 fail, 1 error
```

## 6. Implementation changes
- Added `packages/shared/src/workbench/option-graph.ts`.
- Added `OPTION_GRAPH_CATEGORIES` covering the required 20 categories.
- Added Zod schemas for option conditions, options, graphs, and fixtures.
- Added default options for output type, depth, audience, format, style, design, research, geography, recency, source requirements, API docs, security, compliance, testing, TDD, deliverables, diagrams, metrics, risks, and validation.
- Added resolver functions:
  - `validateOptionGraph`
  - `resolveOptionGraphOptions`
  - `resolveOptionGraphExecutionConfig`
  - `getOptionGraphFixture`
- Added deterministic fixtures:
  - `product-spec`
  - `code-task`
  - `market-research`
  - `presentation-review`
  - `prompt-rewrite`
- Added direct package export `@rox-agent/shared/workbench/option-graph`.
- Re-exported the module from `packages/shared/src/workbench/index.ts`.

## 7. Validation commands run
```text
bun test packages/shared/src/workbench/__tests__/option-graph.test.ts
```
Result: `5 pass, 0 fail, 19 expect() calls`.

```text
bun test packages/shared/src/workbench/__tests__/option-graph.test.ts packages/shared/src/workbench/__tests__/product-mode-registry.test.ts packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts packages/shared/src/workbench/__tests__/prompt-rewrite-engine.test.ts packages/shared/src/workbench/__tests__/thinking-partner.test.ts
```
Result: `25 pass, 0 fail, 269 expect() calls`.

```text
bun run typecheck:shared
bun run typecheck:electron
bun run validate:agent-contract
bun run validate:docs
git diff --check
bun run electron:build
```
Results: all passed. `electron:build` completed with existing chunk-size warnings only.

## 8. Passing test output summary
- Option Graph contract tests: passed.
- Workbench regression tests: passed.
- Shared and Electron typechecks: passed.
- Agent contract validator: passed.
- Architecture docs validator: passed.
- Whitespace diff check: passed.
- Electron build: passed.

## 9. Build output summary
`bun run electron:build` completed main, preload, renderer, resources, and assets build steps. Renderer produced the existing large chunk warnings, but exited successfully.

## 10. Remaining risks
- T010 intentionally does not render the Option Graph UI; T011 owns the Spec Builder screen.
- T010 intentionally does not persist selected options as artifacts; T012 owns Spec Compiler/export persistence.
- The skill slug runtime schema is duplicated locally to keep the direct option-graph module browser-safe and avoid importing Node-backed workspace installer code at runtime.

## 11. Acceptance criteria matrix
| Criterion | Status | Evidence |
| --- | --- | --- |
| Option category schema exists | PASS | `OPTION_GRAPH_CATEGORIES` includes all required categories |
| Option schema supports appliesWhen/requires/excludes/derived config fields | PASS | `OptionGraphOptionSchema` and tests cover invalid category, dependency, and exclusion behavior |
| Raw intent + selected options resolve available options | PASS | `resolveOptionGraphOptions` filters research/source dependencies and format exclusions |
| Selected options derive execution config | PASS | `resolveOptionGraphExecutionConfig` merges mode defaults with selected skills/agents/gates/artifacts |
| Common fixtures exist | PASS | Five deterministic fixtures added and market research snapshot tested |
| Conflicting options cannot both be selected | PASS | `format:markdown` + `format:json` rejection test passes |
| Tests pass | PASS | Targeted and regression workbench suites pass |
| Build passes | PASS | Electron build passes |
