# T540-answer-package-schema

Status: DONE

## Goal

Add a shared `AgentAnswerPackage` schema and pure helper layer so agent responses can be represented as structured output packages before any UI, persistence migration, or provider runtime integration.

## Scope

- Add a pure shared workbench module for AnswerPackage types/schemas.
- Cover message, memory, execution, retrieval, and audit sections.
- Link packages to current session, message, artifact, tool, and source references without changing existing session JSONL or artifact storage formats.
- Export the module through the existing workbench aggregate export.

## Out of scope

- Changing `SessionManager`.
- Changing session JSONL storage.
- Changing artifact RPC/protocol files already touched by the current dirty artifact-panel branch.
- UI panels for notes, tasks, graph, or answer package inspection.
- Provider runtime changes that make live agents emit packages.

## Required validation

- `bun test packages/shared/src/workbench/__tests__/answer-package.test.ts`
- `bun run typecheck:shared`
- `git diff --check`

## Acceptance criteria

- [x] Tests are written first and fail before implementation.
- [x] `AgentAnswerPackageSchema` parses a complete package.
- [x] Package helpers reject invalid confidence values and empty required IDs.
- [x] `createAgentAnswerPackage` preserves structured refs without mutating input.
- [x] `summarizeAgentAnswerPackage` returns counts/metadata without leaking full markdown/content.
- [x] Worklog is complete.
- [x] Required validation passes or blockers are recorded.
