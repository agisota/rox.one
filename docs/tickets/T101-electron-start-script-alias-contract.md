# T101 - Electron Start Script Alias Contract

Status: DONE

## Context

The remaining package-script dirty layer redirects Electron start commands to
the branded `scripts/electron-dev.ts` launcher. That direction is correct for
dev-mode ROX.ONE identity, but hardcoding the TypeScript launcher in multiple
package manifests creates drift: root and nested Electron start commands can
diverge from the canonical root `electron:dev` entrypoint.

## Goal

Make Electron start scripts delegate through one canonical root alias:
`electron:dev`.

## Required UI

No UI change.

## Required Data/API

- Root `electron:start` should call `bun run electron:dev`.
- `apps/electron` `start` and `start:win` should call the root alias via
  `cd ../.. && bun run electron:dev`.
- Root `electron:dev` remains the only package script that points directly at
  `scripts/electron-dev.ts`.

## Required Automations

- Add a focused package-script regression test.
- Do not include packaged-smoke marker policy or runtime artifacts in this
  ticket.

## Required Subagents

No subagent required: this is a two-manifest script contract.

## TDD Requirements

Before implementation:

1. Add a focused package-script test.
2. Run it and confirm it fails against the duplicated dirty script paths.

## Implementation Requirements

- Keep package-script changes minimal.
- Do not edit `scripts/electron-dev.ts`.
- Do not stage `events.jsonl`, `.claude/`, `.ouroboros/`, or
  `scripts/electron-smoke-packaged-mac.ts`.

## Validation Commands

- `bun test scripts/__tests__/electron-start-scripts.test.ts`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Root `electron:start` delegates to `electron:dev` | DONE |
| Nested Electron `start` delegates to root `electron:dev` | DONE |
| Nested Electron `start:win` delegates to root `electron:dev` | DONE |
| Only root `electron:dev` points directly at `scripts/electron-dev.ts` | DONE |
| Focused script-contract test fails before the fix and passes after | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists without unrelated runtime artifacts | DONE |

## Worklog

Update `docs/worklog/T101-electron-start-script-alias-contract.md`.
