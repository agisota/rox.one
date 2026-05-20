# T271 - Agent artifact right panel

## 1. Task summary

Implement a Claude/Codex Artifacts-style right-side panel for chat, with session-scoped artifact persistence, Preview/Code modes, sandboxed HTML rendering, and toolbar actions.

## 2. Repo context discovered

- `apps/electron/src/renderer/components/app-shell/AppShell.tsx` owns the shell layout and mounts `PanelStackContainer`.
- `PanelStackContainer` is the main peer-panel stack; existing comments identify the right sidebar as outside that container.
- `apps/electron/src/shared/types.ts` and `apps/electron/src/shared/route-parser.ts` already model right sidebar state for `files`, `history`, and `none`.
- Session persistence is file-backed under `packages/shared/src/sessions`, with `session.jsonl` plus per-session folders for attachments/plans/data/downloads.
- `packages/server-core/src/handlers/rpc/sessions.ts` already hosts session-scoped files and notes RPC.
- Existing HTML preview components block scripts; #271 needs a dedicated artifact sandbox path for interactive HTML.
- Current working tree had pre-existing dirty Rox Design main-process files before this task; #271 should avoid touching them.

## 3. Files inspected

- `AGENTS.md`
- `docs/tickets/T129-composer-artifact-clickthrough.md`
- `packages/shared/src/protocol/channels.ts`
- `packages/shared/src/protocol/routing.ts`
- `packages/shared/src/protocol/dto.ts`
- `packages/shared/src/sessions/types.ts`
- `packages/shared/src/sessions/storage.ts`
- `packages/shared/src/sessions/bundle.ts`
- `packages/shared/src/sessions/jsonl.ts`
- `packages/server-core/src/handlers/rpc/sessions.ts`
- `packages/server-core/src/handlers/session-manager-interface.ts`
- `packages/server-core/src/sessions/SessionManager.ts`
- `packages/server-core/src/sessions/session-persistence.ts`
- `apps/electron/src/shared/types.ts`
- `apps/electron/src/shared/route-parser.ts`
- `apps/electron/src/transport/channel-map.ts`
- `apps/electron/src/renderer/contexts/NavigationContext.tsx`
- `apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- `apps/electron/src/renderer/components/app-shell/PanelResizeSash.tsx`
- `apps/electron/src/renderer/components/right-sidebar/SessionFilesSection.tsx`

## 4. Tests added first

- `packages/shared/src/sessions/__tests__/artifacts.test.ts`
- `packages/server-core/src/handlers/rpc/__tests__/artifacts-rpc.test.ts`
- `apps/electron/src/shared/__tests__/route-parser-artifact-sidebar.test.ts`
- `apps/electron/src/renderer/components/artifacts/__tests__/artifact-sandbox.test.tsx`
- `apps/electron/src/renderer/components/artifacts/__tests__/artifact-panel.test.tsx`

## 5. Expected failing test output

`bun test packages/shared/src/sessions/__tests__/artifacts.test.ts apps/electron/src/shared/__tests__/route-parser-artifact-sidebar.test.ts apps/electron/src/renderer/components/artifacts/__tests__/artifact-sandbox.test.tsx apps/electron/src/renderer/components/artifacts/__tests__/artifact-panel.test.tsx packages/server-core/src/handlers/rpc/__tests__/artifacts-rpc.test.ts`

- `parseRightSidebarParam('artifact')` returned `undefined`.
- `upsertSessionArtifact` was not exported from `packages/shared/src/sessions/storage.ts`.
- `packages/server-core/src/handlers/rpc/artifacts.ts` did not exist.
- `apps/electron/src/renderer/components/artifacts/artifact-sandbox.ts` did not exist.
- `apps/electron/src/renderer/components/artifacts/ArtifactPanel.tsx` did not exist.

## 6. Implementation changes

- Added `AgentArtifact`, `AgentArtifactVersion`, `AgentArtifactType`, and `UpsertSessionArtifactInput` as shared session/protocol DTOs.
- Added file-backed artifact persistence at `sessions/{sessionId}/artifacts/artifacts.json`.
- Added `list/get/upsert/delete` artifact storage helpers plus title-derived stable upsert behavior so repeat edits update the same artifact unless a different id/title is supplied.
- Added `artifacts:list`, `artifacts:get`, `artifacts:upsert`, `artifacts:delete`, and `artifacts:changed` RPC channels, routing classification, push event typing, Electron API bindings, and server-core handlers.
- Added right-sidebar route support for `?sidebar=artifact` and `?sidebar=artifact/{artifactId}`.
- Added `ArtifactRail`, `ArtifactPanel`, and `artifact-sandbox` renderer components.
- Integrated the artifact rail into `AppShell` as the right-side panel outside `PanelStackContainer`, with persisted width and compact overlay behavior.
- Added Preview/Code modes and Copy, Download, Fullscreen, Close controls.
- Rendered HTML artifacts through a sandbox iframe with `sandbox="allow-scripts"` and no `allow-same-origin`; noninteractive sandbox helpers strip scripts and inline handlers.

## 7. Validation commands run

- `bun test packages/shared/src/sessions/__tests__/artifacts.test.ts apps/electron/src/shared/__tests__/route-parser-artifact-sidebar.test.ts apps/electron/src/renderer/components/artifacts/__tests__/artifact-sandbox.test.tsx apps/electron/src/renderer/components/artifacts/__tests__/artifact-panel.test.tsx packages/server-core/src/handlers/rpc/__tests__/artifacts-rpc.test.ts apps/electron/src/shared/__tests__/ipc-channels.test.ts packages/shared/src/protocol/__tests__/routing.test.ts`
- `bun run typecheck:shared`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:electron`
- `bun run electron:build:renderer`

## 8. Passing test output summary

- Targeted tests: 24 pass, 0 fail, 388 assertions.
- `typecheck:shared`: pass.
- `packages/server-core` `tsc --noEmit`: pass.
- `typecheck:electron`: pass.

## 9. Build output summary

- `electron:build:renderer`: pass; Vite transformed 5674 modules and completed production renderer build.
- Existing Vite warnings remained: dynamic import vars for `@shikijs/langs` / `@shikijs/themes`, and existing chunk-size warnings over 500 kB.

## 10. Remaining risks

- Full Office/Figma/browser embedding is intentionally outside the MVP and should follow after artifact panel foundations pass security gates.
- The existing dependency audit findings around document converters remain relevant before broad Office artifact ingestion.
- Pre-existing dirty Rox Design files must stay out of the #271 commit.
- Post-rebase note: the focused branch was rebased onto `origin/main` after
  PR #311 and PR #314 landed. T312 fixed unrelated Electron typecheck baseline
  blockers that were exposed while verifying this task.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Right-side resizable artifact panel opens without replacing chat | PASS | `AppShell` mounts `ArtifactRail` as the right peer of `PanelStackContainer` and persists `artifactPanelWidth` |
| First-class session artifact entity persists with versions | PASS | `packages/shared/src/sessions/__tests__/artifacts.test.ts` |
| Agent edits update active artifact/version history | PASS | Explicit-id and stable title-derived upsert tests both keep one artifact and append versions |
| Preview/Code modes supported | PASS | `apps/electron/src/renderer/components/artifacts/__tests__/artifact-panel.test.tsx` |
| HTML renders in safe sandbox iframe | PASS | `apps/electron/src/renderer/components/artifacts/__tests__/artifact-sandbox.test.tsx` checks `allow-scripts` without same-origin |
| Copy/Download/Fullscreen/Close controls exist | PASS | `ArtifactPanel` SSR test checks toolbar actions |
| Panel fits current design and compact mode | PASS | Panel uses existing button/tokens/shadows and compact absolute overlay behavior; renderer build passed |
| Targeted tests and validation pass | PASS | 24 targeted tests, three typechecks, and renderer build passed |

## 12. Post-rebase verification update

After rebasing the focused branch onto `origin/main` and applying T312 baseline
fixes:

- `bun test packages/shared/src/sessions/__tests__/artifacts.test.ts apps/electron/src/shared/__tests__/route-parser-artifact-sidebar.test.ts apps/electron/src/renderer/components/artifacts/__tests__/artifact-sandbox.test.tsx apps/electron/src/renderer/components/artifacts/__tests__/artifact-panel.test.tsx packages/server-core/src/handlers/rpc/__tests__/artifacts-rpc.test.ts apps/electron/src/shared/__tests__/ipc-channels.test.ts packages/shared/src/protocol/__tests__/routing.test.ts`
  - Result: 24 pass, 0 fail, 390 expectations.
- `bun run typecheck:shared`
  - Result: pass.
- `cd packages/server-core && bun run tsc --noEmit`
  - Result: pass.
- `bun run typecheck:electron`
  - Result: pass after T312 baseline fixes.
- `bun run electron:build:renderer`
  - Result: pass; existing Shiki dynamic-import and chunk-size warnings remain.
