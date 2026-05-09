# T126 - Experience Session Sync and MCP Defaults

Status: complete

## Context

The Experience section already has deterministic demo sessions, but the app
still needs the user's indexed external Rox Agent sessions to appear in the
normal session list and needs a sane default MCP source bundle for the active
research/tooling stack.

## Goal

Ship a safe startup path that imports sanitized external-session index entries
into workspace `session.jsonl` files, keeps Experience demo tabs populated and
test-covered, installs default MCP source presets, and verifies the built app
from tests through Electron smoke/log evidence.

## Required UI

- Preserve the existing Experience tab selector and five demo sessions per tab.
- Imported external sessions must appear in the normal session list for the
  active workspace.
- Default MCP presets must appear as workspace Sources, with guide text that
  explains what each one does and what credential/environment is expected.

## Required Data/API

- Read `~/.rox/session_index.jsonl` as the sanitized session index.
- Optionally correlate `~/.rox/external_agent_session_imports.json` for import
  metadata without embedding raw transcript paths in session messages.
- Write imported sessions using the existing workspace session JSONL format.
- Install source presets as normal `sources/{slug}/config.json`, `guide.md`, and
  `permissions.json` files.

## Required Automations

- Run the import before `SessionManager` loads sessions from disk.
- Run the source preset installer for new and existing workspaces.
- Keep both paths idempotent.

## Required Subagents

No child subagents for this slice. The change is bounded to storage, session
startup, source presets, tests, and verification; direct execution is faster and
keeps the write scope clear.

## TDD Requirements

Before implementation:

1. Add importer tests for creating sanitized workspace sessions from the index.
2. Add importer tests for redaction, idempotence, and malformed-line handling.
3. Add default bundle tests for MCP source preset creation and non-overwrite.
4. Re-run the existing Experience route test to prove the demo tab contract.

## Implementation Requirements

- Do not parse or embed raw external agent transcripts.
- Do not include secrets or local source transcript paths in generated session
  messages.
- Do not include broad filesystem MCP access as a default source preset.
- Do not overwrite an existing user source folder.
- Keep source presets dependency-free and based on existing `npx`, `docker`, or
  local CLI command patterns.

## Validation Commands

- `bun test packages/server-core/src/sessions/external-agent-session-importer.test.ts packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts`
- `bun test apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx`
- `bun run typecheck:all`
- `bun run lint`
- `bun run electron:build`
- `bun run electron:smoke`
- `bun run electron:dist:dev:mac:arm64`
- `bun run electron:smoke:packaged:mac`
- `bun run validate:packaged-artifacts`
- `bun run validate:mac-arm-build-workflow`
- `bun run validate:bundle-policy`
- `git diff --check`

## Acceptance Criteria

- [x] External session index entries are imported as visible workspace sessions.
- [x] Import is idempotent and redacts secret-like content.
- [x] Default MCP source presets install for Exa, ByteRover, Firecrawl, GitHub,
  Playwright, and Z.AI without broad filesystem access.
- [x] Existing user-edited source folders are not overwritten.
- [x] Experience tab demo contract still has exactly five demos per tab.
- [x] Tests pass.
- [x] Build passes when applicable.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T126-experience-session-sync-mcp-defaults.md`.
