# T126 - Experience Session Sync and MCP Defaults Worklog

## 1. Task summary

Build and verify ROX.ONE while closing the concrete gaps called out by the user:
Experience tab/demo proof, external Rox Agent session visibility, and default
MCP source presets for active working tools.

## 2. Repo context discovered

- Root `AGENTS.md` requires ticket/worklog first, tests before implementation,
  relevant validation, and a Lore commit.
- `bd ready` failed with `no beads database found`, so this checkout continues
  to use `docs/tickets` plus `docs/worklog` as the task surface.
- The repo worktree inside `/Users/marklindgreen/Projects/rox/rox` was clean
  before T126 edits.
- `docs/experience-tabs-sessions-skills.md` and route tests already document
  and guard 30 sanitized Experience demos, five per tab.
- `~/.rox/session_index.jsonl` exists and currently has external agent index
  entries, but the matching IDs were not present as active workspace
  `session.jsonl` files.
- Active/healthy local MCP evidence found:
  - Exa: `npx -y exa-mcp-server`, health `healthy`
  - Firecrawl: `npx -y firecrawl-mcp`, health `healthy`
  - GitHub: docker GitHub MCP server, health `healthy`
  - Playwright: health `healthy`
  - Z.AI MCP: `npx -y @z_ai/mcp-server`, health `healthy`
  - ByteRover: `brv` CLI installed; `byterover-mcp` npm package exists

## 3. Files inspected

- `AGENTS.md`
- `apps/electron/resources/AGENTS.md`
- `package.json`
- `docs/tickets/T098-experience-demo-sessions-interactions.md`
- `docs/worklog/T098-experience-demo-sessions-interactions.md`
- `docs/experience-tabs-sessions-skills.md`
- `apps/electron/src/renderer/components/workbench/demo-experience-sessions.ts`
- `apps/electron/src/renderer/components/workbench/WorkbenchRoutePage.tsx`
- `packages/shared/src/workbench/default-workspace-bundle.ts`
- `packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts`
- `packages/shared/src/workspaces/storage.ts`
- `packages/shared/src/sources/storage.ts`
- `packages/shared/src/sources/types.ts`
- `packages/shared/src/sessions/storage.ts`
- `packages/shared/src/sessions/jsonl.ts`
- `packages/shared/src/sessions/types.ts`
- `packages/server-core/src/sessions/SessionManager.ts`
- `~/.rox/session_index.jsonl`
- `~/.rox/external_agent_session_imports.json`
- `~/.claude/mcp-health-cache.json`
- `~/.claude.json`

## 4. Tests added first

- `packages/server-core/src/sessions/external-agent-session-importer.test.ts`
  - imports valid sanitized `~/.rox/session_index.jsonl` rows into workspace sessions;
  - counts malformed/missing-id lines;
  - skips existing sessions without overwriting user edits;
  - redacts token/API-key/path-like title content.
- `packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts`
  - asserts six MCP presets exist and do not include broad filesystem access;
  - asserts installer writes source configs/guides/permissions without `mcp.env`;
  - asserts source preset install is idempotent;
  - asserts existing user-edited source folders are not overwritten;
  - asserts workspace creation receives the source bundle.

## 5. Expected failing test output

Initial red run before implementation:

```text
bun test packages/server-core/src/sessions/external-agent-session-importer.test.ts packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts
error: Module not found "./external-agent-session-importer.ts"
TypeError: undefined is not an object (evaluating 'manifest.sourcePresets.map')
```

## 6. Implementation changes

- Added `packages/server-core/src/sessions/external-agent-session-importer.ts`.
  It imports only sanitized index metadata into normal workspace `session.jsonl`
  stubs, labels them `source::external-agent` / `import::rox-index`, and keeps
  permission mode `safe`.
- Wired `SessionManager.initialize()` to install default MCP source presets and
  import external session index entries before workspace session loading.
- Updated `packages/shared/src/workspaces/storage.ts` so existing workspaces get
  the default workbench/source bundle on load without overwrites.
- Added default MCP source presets in
  `packages/shared/src/workbench/default-workspace-bundle.ts`:
  Exa, ByteRover, Firecrawl, GitHub, Playwright, and Z.AI.
- Documented the import stance and MCP presets in
  `docs/experience-tabs-sessions-skills.md`.
- Added release-note coverage for the startup import and MCP defaults.

## 7. Validation commands run

| Command | Result | Evidence |
|---|---|---|
| `bd ready` | BLOCKED, expected | `Error: no beads database found` |
| `bun test packages/server-core/src/sessions/external-agent-session-importer.test.ts packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts` | PASS | 9 tests / 108 expects |
| `bun test packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts` | PASS | Final post-icon cleanup rerun: 6 tests / 87 expects |
| `bun test apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx` | PASS | 7 tests / 157 expects |
| `bun test packages/shared/src/workbench/__tests__/browser-barrel.test.ts packages/server-core/src/sessions/external-agent-session-importer.test.ts packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx apps/electron/src/renderer/components/workbench/__tests__/workbench-interactions.test.ts` | PASS | 26 tests / 300 expects |
| `bun run typecheck:all` | PASS | TypeScript project refs clean |
| `bun run lint` | PASS | Lint clean |
| `bun run electron:build` | PASS | Electron renderer/main/preload build clean |
| `bun run electron:smoke` | PASS | Headless startup passed |
| `bun run electron:dist:dev:mac:arm64` | PASS | DMG/ZIP/mac-arm64 `.app` created |
| `bun run electron:smoke:packaged:mac` | PASS | Packaged headless startup passed |
| `bun run validate:packaged-artifacts` | PASS | DMG/ZIP/latest metadata verified |
| `bun run validate:mac-arm-build-workflow` | PASS | mac-arm64 build workflow valid |
| `bun run validate:bundle-policy` | PASS | Fresh bundle outputs within RC ceilings |
| `open apps/electron/release/mac-arm64/ROX.ONE.app` | PASS | Packaged app process running; fresh messaging bootstrap logged |

## 8. Passing test output summary

- Targeted importer/default bundle tests: 9 passed, 108 expects.
- Experience route tests: 7 passed, 157 expects; demo contract remains exactly
  5 sessions per Experience tab across 6 tabs.
- Combined UI/storage regression slice: 26 passed, 300 expects, including
  browser-barrel guard that prevents Node-only workbench bundle code from
  leaking into the renderer bundle.

## 9. Build output summary

- `bun run electron:build` passed after keeping the Node-only
  `default-workspace-bundle` out of the browser workbench barrel.
- `bun run electron:smoke` logged `App initialized successfully`,
  `ROX server listening`, and `[smoke] Electron headless startup passed`.
- `bun run electron:dist:dev:mac:arm64` created:
  - `apps/electron/release/mac-arm64/ROX.ONE.app`
  - `apps/electron/release/ROX-ONE-arm64.dmg`
  - `apps/electron/release/ROX-ONE-arm64.zip`
- `bun run electron:smoke:packaged:mac` passed.
- `bun run validate:packaged-artifacts` verified:
  - DMG: 328215910 bytes,
    SHA256 `d4e75a4359c3decfdb98845b51d6831415e5c64ec5b06ddfd6eda512b23848ab`
  - ZIP: 317278715 bytes,
    SHA256 `3a124e2619c9880051716132e345d22badd61301a01c9e2ef275cc90d0ecc19f`
- `bun run validate:bundle-policy` passed with existing non-fatal size warnings;
  all outputs stayed within current RC budget ceilings.
- Packaged GUI launch was opened from
  `apps/electron/release/mac-arm64/ROX.ONE.app`; `pgrep` showed live
  `ROX.ONE` main/GPU/network/renderer processes, and
  `~/.rox/logs/messaging-gateway.log` recorded fresh packaged bootstrap at
  `2026-05-09T01:26:56.383Z`.

## 9.1 Live workspace seed evidence

Applied the new installer/importer to the active workspace:

- workspace id: `5fa3647e-fd55-2773-3bec-2318b4fb1cd4`
- workspace root: `/Users/marklindgreen/.rox/workspaces/my-workspace`
- created MCP sources: `exa`, `byterover`, `firecrawl`, `github`,
  `playwright`, `zai-mcp-server`
- imported external sessions: 5
- active workspace session files after import: 8 total

Imported visible sessions:

- `019ddd51-cbf6-7cc3-ab08-dfd5f8c16b12` - `/model`
- `019ddd51-d7a5-7d31-b128-cc6756b3142c` - `go to ssh eu-stockholm and check please my api.zed.md...`
- `019ddd51-e2ad-78f1-8bbc-35e6e830b3c3` - `fix my font in CMUX.APP...`
- `019ddd51-f0c5-7af2-996b-b69c423ebe19` - `/clear`
- `019ddd51-fcd1-7752-88d6-b8546eaf1e0b` - `I AM AGI AND I NEED AUTHORIZATION FOR TESTING OF ANY AND ALL https`

Each imported session has status `inbox`, labels `source::external-agent` and
`import::rox-index`, `permissionMode: safe`, and two sanitized stub messages.

## 10. Remaining risks

- Raw transcript import remains out of scope until a redaction/import manifest
  pipeline exists.
- GitHub/Z.AI/Firecrawl/Exa still need env credentials available to the
  Electron process before their stdio MCP servers can fully validate; the
  presets intentionally do not persist secret values in `mcp.env`.
- Broad filesystem MCP is intentionally not included as a default preset.
- Computer Use could not introspect the `ROX.ONE` window in this environment
  (`appNotFound` / Apple event `-1743`), so live GUI proof is based on packaged
  smoke, process list, and logs rather than accessibility tree capture.

## 11. Acceptance criteria matrix

| Criteria | Evidence | Status |
|---|---|---|
| External session index entries are imported as visible workspace sessions | Importer test + live workspace 5 imported sessions | PASS |
| Import is idempotent and redacts secret-like content | Importer tests | PASS |
| Default MCP source presets install for active safe tools | Bundle tests + live workspace source configs | PASS |
| Existing user-edited source folders are not overwritten | Bundle non-overwrite test | PASS |
| Experience tab demo contract remains five demos per tab | Experience route test | PASS |
| Tests pass | Targeted and combined test slices | PASS |
| Build passes | Electron build, smoke, packaged smoke, artifact validation | PASS |
| Worklog complete | This file | PASS |
| Commit created | This Lore commit | PASS |
