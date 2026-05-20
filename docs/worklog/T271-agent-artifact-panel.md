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

## 12. Hosted CI follow-up - 2026-05-20

### Task summary

Unblock PR #301 hosted gates after merging `main` into the artifact-panel branch. The remaining failures were workflow/runtime-smoke infrastructure issues, not artifact panel behavior:

- `macOS Sequoia ARM64 packaged launch` failed during `bun install --frozen-lockfile` because `@vscode/ripgrep` postinstall downloaded a GitHub Release without an authenticated `GITHUB_TOKEN`, ending in HTTP 403.
- `Rox Design xvfb smoke - AppImage` prepared the runtime payload and launched, but the assertion grepped for a broad `RoxDesignRuntimeManager` marker that the app never emitted before the headless startup branch.

### Repo context discovered

- `.github/workflows/cross-platform-launch.yml` had three `Install dependencies` steps without per-step `GITHUB_TOKEN` env.
- `.github/workflows/mac-diag-smoke.yml` already documents the same ripgrep/GitHub-release issue and passes `GITHUB_TOKEN: ${{ github.token }}`.
- `apps/electron/src/main/index.ts` constructs `RoxDesignRuntimeManager` before the `isHeadless` branch, so a diagnostic startup marker there proves the packaged app wired the manager even when `ROX_HEADLESS=1` skips window creation.
- `.github/workflows/rox-design-xvfb-smoke.yml` already passes `GITHUB_TOKEN` at the `xvfb-smoke` job level, but the AAP harness install step did not have install-scoped auth.

### Files inspected

- `.github/workflows/cross-platform-launch.yml`
- `.github/workflows/rox-design-xvfb-smoke.yml`
- `.github/workflows/mac-diag-smoke.yml`
- `scripts/validate-cross-platform-launch-workflow.ts`
- `scripts/__tests__/validate-rox-design-xvfb-workflow.test.ts`
- `apps/electron/src/main/index.ts`
- `apps/electron/src/main/rox-design-runtime-manager.ts`

### Tests added first

- Extended `scripts/validate-cross-platform-launch-workflow.ts` to fail unless every `Install dependencies` step passes `GITHUB_TOKEN: ${{ github.token }}`.
- Extended `scripts/__tests__/validate-rox-design-xvfb-workflow.test.ts` to require the concrete `RoxDesignRuntimeManager initialized` marker in both the workflow assertion and Electron main startup code.

### Expected failing test output

- `bun run validate:cross-platform-launch-workflow` failed with: `Install dependencies step 1 does not pass GITHUB_TOKEN for GitHub Release postinstall downloads`.
- `bun test scripts/__tests__/validate-rox-design-xvfb-workflow.test.ts` failed because `.github/workflows/rox-design-xvfb-smoke.yml` did not contain `RoxDesignRuntimeManager initialized`.

### Implementation changes

- Added per-step `GITHUB_TOKEN: ${{ github.token }}` env to all cross-platform launch `Install dependencies` steps so `@vscode/ripgrep` postinstall can authenticate GitHub Release/API requests.
- Added install-scoped `GITHUB_TOKEN` to the AAP harness job in `rox-design-xvfb-smoke.yml`.
- Tightened the xvfb assertion to grep for `RoxDesignRuntimeManager initialized`.
- Added startup diagnostics around Rox Design runtime manager construction in `apps/electron/src/main/index.ts`; no runtime behavior changed.

### Validation commands run

- `bun run validate:cross-platform-launch-workflow`
- `bun test scripts/__tests__/validate-rox-design-xvfb-workflow.test.ts`
- `bun run validate:ci-contract`
- `bun run typecheck:all`
- `bun run validate:ci`
- `git diff --check`
- `graphify update apps/electron/src/main --no-cluster`

### Passing test output summary

- Cross-platform workflow validator: pass.
- Rox Design xvfb workflow tests: 14 pass, 0 fail, 21 assertions.
- CI contract validator: pass.
- Full typecheck: pass.
- Full `validate:ci`: pass.
- Scoped Graphify refresh: rebuilt 1158 nodes and 2719 edges.

### Remaining risks

- Hosted GitHub Actions must re-run on the pushed branch to prove the macOS dependency install no longer hits unauthenticated 403 and the xvfb smoke log now contains the concrete runtime-manager marker.
- Graphify refresh artifacts are intentionally local-only and excluded from git staging.
