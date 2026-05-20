# T540 AnswerPackage Schema

## 1. Task summary

Add a shared, pure `AgentAnswerPackage` schema so ROX.ONE can represent an agent answer as structured message, memory, execution, retrieval, and audit data before wiring UI or persistence migrations.

## 2. Repo context discovered

- Existing workbench shared modules live under `packages/shared/src/workbench` and export through `packages/shared/src/workbench/index.ts`.
- Existing schema-heavy modules use Zod and Bun tests.
- Current session persistence is JSONL in `packages/shared/src/sessions/jsonl.ts`.
- Current session artifact storage is in progress in the dirty branch under `packages/shared/src/sessions/artifacts.ts` and `packages/server-core/src/handlers/rpc/artifacts.ts`.
- Existing mission/workbench structures already model mission runs, agent packages, agent runs, artifacts, validation gates, and review artifacts.
- The first AnswerPackage slice should be pure shared schema/helper code only, avoiding dirty protocol/session artifacts files.

## 3. Files inspected

- `packages/shared/src/workbench/index.ts`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/experience-state.ts`
- `packages/shared/src/workbench/mission-lifecycle.ts`
- `packages/shared/src/workbench/tdd-task-generator.ts`
- `packages/shared/src/workbench/review-board.ts`
- `packages/shared/src/sessions/types.ts`
- `packages/shared/src/sessions/artifacts.ts`
- `packages/shared/src/audit/audit-event-store.ts`

## 4. Tests added first

- `packages/shared/src/workbench/__tests__/answer-package.test.ts`
  - parses a complete structured answer package
  - rejects invalid confidence values and empty required IDs
  - creates a parsed package without mutating caller input
  - summarizes counts and metadata without leaking full answer content

## 5. Expected failing test output

`bun test packages/shared/src/workbench/__tests__/answer-package.test.ts`

```text
error: Cannot find module '../answer-package'
0 pass
1 fail
1 error
```

## 6. Implementation changes

- Added `packages/shared/src/workbench/answer-package.ts`.
- Added Zod schemas and exported TypeScript types for:
  - `AgentAnswerPackage`
  - `ContextRef`
  - `SourceRef`
  - `NoteDraft`
  - `BlockDraft`
  - `ClaimDraft`
  - `DecisionDraft`
  - `TaskDraft`
  - `ReminderDraft`
  - `FollowUpDraft`
  - `AgentRunDraft`
  - `RetrievalTrace`
  - `ToolUse`
- Added `createAgentAnswerPackage(input)` as a pure parser/normalizer.
- Added `summarizeAgentAnswerPackage(input)` as a content-safe metadata/count summary.
- Exported the module from `packages/shared/src/workbench/index.ts`.
- PR branch cleanup changed the schema import from `zod/v4` to `zod` so the shared package works with the repository's root `zod` dependency and package peer range instead of requiring the v4 subpath.

## 7. Validation commands run

- `bun test packages/shared/src/workbench/__tests__/answer-package.test.ts`
- `bun run typecheck:shared`
- `bun run validate:docs`
- `git diff --check`

## 8. Passing test output summary

- Initial red test failed because `../answer-package` did not exist.
- Targeted test after implementation: 4 pass, 0 fail, 15 expect calls.
- `bun run typecheck:shared` passed.
- `bun run validate:docs` passed in the clean PR worktree.
- `git diff --check` passed.

## 9. Build output summary

Not applicable unless shared typecheck requires broader build validation.

## 10. Remaining risks

- The current dirty artifact-panel branch already touches artifact/session/protocol surfaces. This task must avoid those files except for the safe workbench aggregate export.
- The schema is an enabling contract only; no live provider emits `AgentAnswerPackage` in this task.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Tests written first and failed | Passed | Missing module failure captured above |
| Complete package parses | Passed | `answer-package.test.ts` |
| Invalid IDs/confidence rejected | Passed | `answer-package.test.ts` |
| Helper preserves refs without mutation | Passed | `answer-package.test.ts` |
| Summary avoids full content leakage | Passed | `answer-package.test.ts` |
| Shared typecheck passes | Passed | `bun run typecheck:shared` |
| Clean PR worktree can resolve schema dependency | Passed | `zod` import plus targeted Bun test |
