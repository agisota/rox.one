# T342 - WhatsApp worker music-metadata build contract

Status: DONE

## Context

After rebasing the validation branch onto `origin/main` through PR #117,
`bun run build` and the focused `bun run build:wa-worker` gate failed while
bundling the Baileys-backed WhatsApp worker. Baileys requires
`music-metadata`, and the newly pinned `music-metadata@11.12.2` package only
offers the root package export to synchronous Node resolution through the
`module-sync` condition.

## Goal

Restore the WhatsApp worker bundle without adding or changing production
dependencies.

## Required UI

None.

## Required Data/API

No runtime data or API shape changes.

## Required Automations

The existing build commands must remain the source of truth:

- `bun run build:wa-worker`
- `bun run build`

## Required Subagents

None. The esbuild error names the package export condition that is missing.

## TDD Requirements

Use the existing build gates as red checks:

- `bun run build:wa-worker`
- `bun run build`

## Implementation Requirements

- Pass the `module-sync` export condition to esbuild when bundling the
  WhatsApp worker.
- Keep Baileys and its required transitive dependencies bundled into
  `worker.cjs`.
- Keep runtime-optional Baileys peers external.
- Do not add production dependencies.
- Keep the standalone worker build script and Electron main build script in
  sync.

## Validation Commands

- `bun run build:wa-worker`
- `bun run build`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `git diff --check`

## Acceptance Criteria

- [x] `bun run build:wa-worker` no longer fails on `music-metadata` export
  resolution.
- [x] `bun run build` no longer fails while building the WhatsApp worker.
- [x] No production dependency is added or changed.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T342-whatsapp-worker-music-metadata-build-contract.md`.
