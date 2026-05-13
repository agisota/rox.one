# T268 - Rebrand binary and doc renames

Status: DONE

## Context

Phase R.3 removes legacy product tokens from packaged Electron CLI wrapper,
tool icon, and bundled CLI documentation paths.

## Goal

Rename the packaged CLI wrapper and CLI docs from legacy `rox*` names to
canonical `rox*` names while keeping the launcher behavior intact.

## Required UI

None.

## Required Data/API

Update the bundled tool icon mapping so the ROX CLI entry points at
`rox-agent` and `rox-agent.png`.

## Required Automations

None.

## Required Subagents

Not required; the affected references are narrow and mapped with direct repo
search.

## TDD Requirements

Add a focused R.3 asset-path regression test before implementation and confirm
it fails while the legacy binary, icon, and doc paths still exist.

## Implementation Requirements

- Rename `apps/electron/resources/tool-icons/rox-agent.png` to
  `apps/electron/resources/tool-icons/rox-agent.png`.
- Rename `apps/electron/resources/docs/rox-cli.md` to
  `apps/electron/resources/docs/rox-cli.md`.
- Rewrite the renamed CLI doc body to use `rox-agent` commands.
- Rename `apps/electron/resources/bin/rox-agent` and `.cmd` to
  `rox-agent` and `rox-agent.cmd`.
- Update active doc references, doc-ref constants, system prompt doc tables,
  and tool-icon mapping references to the new names.

## Validation Commands

- `bun test scripts/__tests__/rebrand-asset-paths.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `bun run validate:rebrand` (expected red until later rebrand phases land)
- `git diff --check`

## Acceptance Criteria

- [x] Red test proves the legacy binary, icon, and doc paths exist before
  implementation.
- [x] Old binary, icon, and doc filenames return zero `git ls-files` matches.
- [x] New `rox*` binary, icon, and doc filenames exist.
- [x] Active CLI documentation references `rox-agent` and `rox-cli.md`.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T268-rebrand-binary-and-doc-renames.md`.
