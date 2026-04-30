# T030 Browser Research Integration

## 1. Task summary

Add a shared browser research integration policy that gates web search/fetch/browser tooling by product mode, validation gates, and permission mode without making real browser or network calls in tests.

## 2. Repo context discovered

- The ticket file `docs/tickets/T030-browser-research-integration.md` is a placeholder and points back to the master backlog.
- Session browser control exists through `packages/shared/src/agent/browser-tools.ts` and `browser-tool-runtime.ts`.
- Browser tool permission tests currently allow browser tools in safe/ask/allow-all at the tool-name level.
- Web search tooling exists in `packages/pi-agent-server/src/tools/search/create-search-tool.ts`.
- Workbench product modes already model `research`, `review`, and `board` with `fact_check` validation gates.
- `packages/shared/src/workbench` is the existing home for pure product/workflow policy modules.
- T030 can start as a shared policy layer that composes existing browser/search surfaces without invoking them.

## 3. Files inspected

- `docs/tickets/T030-browser-research-integration.md`
- `packages/shared/src/agent/browser-tools.ts`
- `packages/shared/src/agent/browser-tool-runtime.ts`
- `packages/shared/src/agent/__tests__/browser-tools-permissions.test.ts`
- `packages/pi-agent-server/src/tools/search/create-search-tool.ts`
- `packages/shared/src/workbench/product-mode-registry.ts`
- `packages/shared/src/workbench/default-workspace-bundle.ts`
- `packages/shared/src/workbench/__tests__/product-mode-registry.test.ts`
- `packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts`

## 4. Tests added first

- `packages/shared/src/workbench/__tests__/browser-research-integration.test.ts`
  - enables web search, web fetch, and browser tool for research mode with `fact_check` in ask mode
  - keeps `browser_tool` disabled in safe mode while allowing non-browser research tools
  - denies all tools when `fact_check` is missing
  - denies unsupported product modes by default
  - resolves duplicate requested tool subsets deterministically

## 5. Expected failing test output

`bun test packages/shared/src/workbench/__tests__/browser-research-integration.test.ts`

```text
error: Cannot find module '../browser-research-integration'
0 pass
1 fail
1 error
```

## 6. Implementation changes

- Added `packages/shared/src/workbench/browser-research-integration.ts`.
- Added stable tool IDs for `web_search`, `web_fetch`, and `browser_tool`.
- Added a shared resolver that gates tools by supported product mode, required `fact_check` validation gate, and permission mode.
- Enabled supported modes: `research`, `review`, and `board`.
- Kept `browser_tool` disabled outside ask mode while still allowing non-browser research helpers in safe mode.
- Added deterministic requested-tool deduplication using canonical tool order.
- Exported the module from `packages/shared/src/workbench/index.ts`.

## 7. Validation commands run

- `bun test packages/shared/src/workbench/__tests__/browser-research-integration.test.ts`
- `bun run typecheck:shared`
- `git diff --check`
- `bun test packages/shared/src/workbench/__tests__/browser-research-integration.test.ts packages/shared/src/workbench/__tests__/product-mode-registry.test.ts packages/shared/src/agent/__tests__/browser-tools-permissions.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:electron`
- `bun run validate:docs`
- `bun run electron:build`

## 8. Passing test output summary

- Targeted T030 test: 5 pass, 0 fail, 15 expect calls.
- Workbench/browser regression slice: 14 pass, 0 fail, 179 expect calls.
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

- This is a shared policy/integration resolver; it does not yet wire UI controls or runtime tool creation to the resolver.
- Existing low-level browser tool permission tests still allow browser tools by tool name; T030 adds a workbench-level gate rather than changing global permission semantics.
- No real web search/browser execution was performed, by design.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Browser research tools are resolved through a shared integration policy | Pass | `browser-research-integration.ts` |
| No real browser/search/network calls happen in tests | Pass | pure resolver unit tests |
| Research tools require a fact-check validation gate | Pass | missing gate test denies all tools |
| `browser_tool` is ask-mode gated | Pass | safe-mode test disables browser automation |
| Unsupported product modes deny tools by default | Pass | build-mode denial test |
| Shared typecheck passes | Pass | `bun run typecheck:shared` |
| Relevant build passes | Pass | `bun run electron:build` |
