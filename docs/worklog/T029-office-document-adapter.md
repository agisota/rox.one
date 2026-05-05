# T029 Office Document Adapter

## 1. Task summary

Introduce a testable server-side Office document adapter boundary for converting Office attachments to markdown without invoking real conversion tools in unit tests.

## 2. Repo context discovered

- The ticket file `docs/tickets/T029-office-document-adapter.md` is a placeholder and points back to the master backlog.
- Office attachments are currently converted inside `packages/server-core/src/handlers/rpc/files.ts` using `markitdown-js` directly.
- Attachment metadata already supports `type: 'office'` and `markdownPath`.
- Shared file helpers classify `.docx`, `.xlsx`, `.pptx`, `.doc`, `.xls`, and `.ppt` as Office attachments.
- Electron resources already ship Python document tools and smoke tests for `docx-tool`, `xlsx-tool`, `pptx-tool`, and `markitdown`.
- `packages/server-core/src/services` is the existing service boundary for testable server logic.

## 3. Files inspected

- `docs/tickets/T029-office-document-adapter.md`
- `packages/server-core/src/handlers/rpc/files.ts`
- `packages/server-core/src/services/index.ts`
- `packages/server-core/package.json`
- `packages/shared/src/utils/files.ts`
- `packages/shared/src/agent/claude-agent.ts`
- `packages/ui/src/lib/file-classification.ts`
- `packages/ui/src/components/chat/attachment-helpers.tsx`
- `apps/electron/resources/scripts/markitdown_cli.py`
- `apps/electron/resources/scripts/tests/test_docx_tool_smoke.py`

## 4. Tests added first

- `packages/server-core/src/services/office-document-adapter.test.ts`
  - verifies conversion through an injected fake converter and fake writer
  - rejects empty/whitespace conversion output without writing markdown
  - wraps converter failures with attachment context
  - asserts logs do not include converted markdown content

## 5. Expected failing test output

`bun test packages/server-core/src/services/office-document-adapter.test.ts`

```text
error: Cannot find module './office-document-adapter'
0 pass
1 fail
1 error
```

## 6. Implementation changes

- Added `packages/server-core/src/services/office-document-adapter.ts`.
- Added `convertOfficeDocumentToMarkdown` with injectable converter, injectable markdown writer, and optional logger.
- Added empty/whitespace output rejection before markdown files are written.
- Added contextual error wrapping using the user-facing attachment name.
- Exported the adapter from `packages/server-core/src/services/index.ts`.
- Replaced direct Office conversion logic in `packages/server-core/src/handlers/rpc/files.ts` with the adapter boundary while keeping the existing `MarkItDown` converter as the runtime backend.
- Normalized `markitdown.convert()` null results into `{ textContent: null }` so the adapter owns empty-result handling.

## 7. Validation commands run

- `bun test packages/server-core/src/services/office-document-adapter.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `git diff --check`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `bun run validate:docs`
- `bun run test:doc-tools`
- `bun run electron:build`

## 8. Passing test output summary

- Targeted T029 adapter test: 3 pass, 0 fail, 8 expect calls.
- Server-core typecheck: pass.
- Whitespace diff check: pass.
- Shared typecheck: pass.
- Electron typecheck: pass.
- Docs validation: pass.
- Document-tool smoke tests: 19 pass, OK.
- Note: first `bun run test:doc-tools` attempt failed in sandbox because `uv` could not read `/Users/marklindgreen/_tooling/cache/uv/sdists-v9/.git`; rerun with escalated filesystem access passed.

## 9. Build output summary

`bun run electron:build` completed successfully:

- main/preload/renderer/resource/assets build steps passed
- existing Vite chunk-size and jotai deprecation warnings were emitted
- no build errors

## 10. Remaining risks

- Adapter unit tests cover the service boundary and Worker F added handler-level `STORE_ATTACHMENT` coverage with an injected fake converter.
- Runtime conversion still depends on `markitdown-js` behavior and local native dependencies.
- Error messages still include converter error text for user diagnosability; callers must avoid embedding secrets in converter exceptions.

## 12. Worker F handler integration closeout — 2026-05-05

### Дополнительный repo context

- `convertOfficeDocumentToMarkdown` already supported fake converter injection, but `packages/server-core/src/handlers/rpc/files.ts` still constructed `new MarkItDown()` directly inside the `STORE_ATTACHMENT` path.
- That meant handler acceptance could only be proven through the real runtime converter, not by a deterministic fake-provider contract.

### Tests added first

- Added `packages/server-core/src/handlers/rpc/files.test.ts` handler integration coverage:
  - `file:storeAttachment` stores an Office attachment;
  - the handler calls an injected fake `OfficeDocumentConverter`;
  - the returned attachment includes `markdownPath`;
  - the generated markdown file contains deterministic read-only fallback content from the fake provider.

### Expected failing output

`bun test packages/server-core/src/handlers/rpc/files.test.ts` failed before implementation for the expected reason:

```text
Failed to store attachment: Failed to convert "deck.docx" to readable format: Cannot convert ...
0 pass
2 fail
```

### Implementation changes

- Added optional `officeDocumentConverter` to `HandlerDeps`.
- Updated `STORE_ATTACHMENT` to use `deps.officeDocumentConverter` when provided and keep the existing `MarkItDown` converter as the runtime default.
- This keeps tests fake-provider-only while preserving existing production behavior.

### Validation commands run

- `bun test packages/server-core/src/handlers/rpc/files.test.ts`
- `bun test packages/server-core/src/handlers/rpc/files.test.ts packages/server-core/src/handlers/__tests__/file-manager-scopes.test.ts packages/server-core/src/services/office-document-adapter.test.ts`
- `bun run --filter @craft-agent/server-core typecheck`
- `bun run validate:agent-contract`

### Passing output summary

- Handler/runtime + existing scope/adapter tests: `10 pass, 0 fail, 25 expect() calls`.
- Server-core typecheck: pass.
- Agent contract validation: pass, `11 skills, 48 tickets, 7 required docs`.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Office conversion is behind an injectable adapter boundary | Pass | `packages/server-core/src/services/office-document-adapter.ts` |
| Unit tests use fake converter and fake writer, not real Office/LLM/S3 tools | Pass | `office-document-adapter.test.ts` |
| Empty conversion output is rejected | Pass | empty output test |
| Conversion failures are wrapped with attachment context | Pass | failure wrapping test |
| Existing attachment handler uses the adapter | Pass | `packages/server-core/src/handlers/rpc/files.ts` |
| `STORE_ATTACHMENT` RPC path is covered with a fake Office converter | Pass | `packages/server-core/src/handlers/rpc/files.test.ts` verifies injected converter usage and markdown fallback |
| Server-core typecheck passes | Pass | `cd packages/server-core && bun run tsc --noEmit` |
| Relevant build passes | Pass | `bun run electron:build` |
