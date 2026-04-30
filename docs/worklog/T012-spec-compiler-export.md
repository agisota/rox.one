# T012 — Spec Compiler and export

## 1. Task summary
Implemented a shared, deterministic Spec Compiler for Agent Workbench. It converts raw input, selected option graph IDs, product mode, and permission mode into a validated `WorkbenchSpec` artifact with metadata, validation gates, implementation tasks, export formats, and a persistence adapter seam.

## 2. Repo context discovered
- `packages/shared/src/workbench/product-mode-registry.ts` owns product modes, artifact types, agent roles, and validation gates.
- `packages/shared/src/workbench/option-graph.ts` owns selectable requirement options and derived execution config.
- `apps/electron/src/renderer/components/workbench/spec-builder-state.ts` owns the current UI preview state and should consume the shared compiler in a later wiring task to avoid preview/export drift.
- Existing session persistence should remain the later durable storage seam; T012 uses a `WorkbenchSpecArtifactStore` adapter plus memory fake rather than writing directly to session files.

## 3. Files inspected
- `packages/shared/src/workbench/option-graph.ts`
- `packages/shared/src/workbench/product-mode-registry.ts`
- `packages/shared/src/workbench/index.ts`
- `packages/shared/package.json`

## 4. Tests added first
Added `packages/shared/src/workbench/__tests__/spec-compiler.test.ts` before implementation.

Covered:
- Spec schema validation.
- Deterministic compile output and metadata.
- Invalid option dependency failure.
- Markdown, JSON, YAML, and TASKS.md exports.
- Fake artifact persistence adapter.

## 5. Expected failing test output
Initial test run failed before implementation for the expected reason:

```text
error: Cannot find module '../spec-compiler'
0 pass
1 fail
1 error
```

A follow-up run initially failed because `bun install` had been run in the previous worktree shell context, not T012. After running `bun install --frozen-lockfile` in this worktree, tests exercised the new compiler normally.

## 6. Implementation changes
- Added `packages/shared/src/workbench/spec-compiler.ts`.
- Added `WorkbenchSpecSchema`, task/risk/validation schemas, compiled artifact metadata, and output format schema.
- Added `compileWorkbenchSpec()` using `resolveOptionGraphExecutionConfig()` as the source of truth.
- Added deterministic exports:
  - Markdown
  - JSON
  - simple deterministic YAML
  - `TASKS.md`
- Added `WorkbenchSpecArtifactStore` adapter contract.
- Added `createMemorySpecArtifactStore()` and `saveCompiledWorkbenchSpec()` for tests and future workspace/session integration.
- Added `./workbench/spec-compiler` package export and aggregate workbench export.

## 7. Validation commands run
```text
bun install --frozen-lockfile
bun test packages/shared/src/workbench/__tests__/spec-compiler.test.ts
bun test packages/shared/src/workbench/__tests__/spec-compiler.test.ts packages/shared/src/workbench/__tests__/option-graph.test.ts apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx
bun run typecheck:shared
bun run typecheck:electron
bun run validate:agent-contract
bun run validate:docs
git diff --check
bun run electron:build
```

## 8. Passing test output summary
```text
spec-compiler.test.ts: 5 pass, 0 fail, 1 snapshot, 17 expect() calls
adjacent regression pack: 15 pass, 0 fail, 1 snapshot, 63 expect() calls
```

## 9. Build output summary
`bun run electron:build` passed:
- main process build verified
- preload builds verified
- renderer production build completed
- resources/assets copied

Existing Vite chunk-size warnings remain present and are not introduced by T012.

## 10. Remaining risks
- Spec Builder UI still uses its local preview helper; a later task should wire it to the shared compiler for export parity.
- Durable workspace/session persistence is intentionally represented by an adapter seam, not a real session write.
- YAML serializer is intentionally small and deterministic for this schema; it is not a general-purpose YAML emitter.

## 11. Acceptance criteria matrix
| Criterion | Status | Evidence |
| --- | --- | --- |
| Spec schema exists | PASS | `WorkbenchSpecSchema` added and tested |
| Compiler converts raw input + selected options + mode config into spec | PASS | `compileWorkbenchSpec()` tests pass |
| Markdown export exists | PASS | Inline snapshot test passes |
| JSON export exists | PASS | JSON parse assertion passes |
| YAML export exists | PASS | YAML output assertion passes |
| TASKS.md export exists | PASS | TASKS.md output assertion passes |
| Artifact metadata includes createdAt/mode/labels/gates | PASS | deterministic metadata assertion passes |
| Persistence adapter/fake exists | PASS | memory store test passes |
| Invalid selected options fail cleanly | PASS | dependency violation test passes |
| Shared/electron typecheck passes | PASS | `typecheck:shared`, `typecheck:electron` passed |
| Desktop build passes | PASS | `electron:build` passed |
