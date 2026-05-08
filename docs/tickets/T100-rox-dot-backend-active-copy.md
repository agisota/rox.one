# T100 - ROX.ONE Backend Active Copy

Status: DONE

## Context

T097 normalized the desktop app legal/product identity to `ROX.ONE`, but active
backend/provider surfaces still contain `ROX ONE Backend`. The remaining
occurrences are user-visible runtime labels in settings, provider menus,
diagnostics, model descriptions, and Pi agent prompts.

## Goal

Normalize active backend/provider labels to `ROX.ONE Backend` without sweeping
historical docs, localized strings, or test fixtures that intentionally preserve
older copy.

## Required UI

- AI settings connection rows should display `ROX.ONE Backend`.
- Provider icon/display helpers should display `ROX.ONE Backend`.
- API setup presets should display `ROX.ONE Backend (Direct)`.
- Free-form connection grouping should display `ROX.ONE Backend`.
- Renderer document title should be `ROX.ONE`.

## Required Data/API

- Pi model descriptions should say `via ROX.ONE Backend`.
- Pi diagnostics and Pi agent backend names should use `ROX.ONE Backend`.

## Required Automations

- Add a focused source-level regression test for active TypeScript/TSX surfaces.
- Keep docs/locales/test fixtures out of this normalization pass unless a
  product-owned localization ticket expands scope.

## Required Subagents

No subagent required: the active file list is small and identified by direct
search.

## TDD Requirements

Before implementation:

1. Add a source-level test that scans the active runtime/renderer files in
   scope.
2. Run it and confirm it fails on `ROX ONE Backend`.

## Implementation Requirements

- Replace only active runtime/renderer/backend label surfaces in scope.
- Do not stage package start-script changes, packaged smoke policy changes,
  `events.jsonl`, `.claude/`, or `.ouroboros/`.

## Validation Commands

- `bun test scripts/__tests__/rox-brand-copy.test.ts`
- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Active scoped files contain no `ROX ONE Backend` runtime label | DONE |
| Scoped files use `ROX.ONE Backend` where backend/provider copy is shown | DONE |
| Renderer document title is `ROX.ONE` | DONE |
| Focused copy regression fails before the fix and passes after | DONE |
| Electron typecheck/lint pass or blockers are documented | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists without unrelated runtime artifacts | DONE |

## Worklog

Update `docs/worklog/T100-rox-dot-backend-active-copy.md`.
