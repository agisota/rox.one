# T344 - Paste image preview lint contract

Status: DONE

## Context

After rebasing onto current `origin/main`, `bun run lint` failed in the
Electron renderer. The new paste-image preview dialog carried an inline disable
for `jsx-a11y/alt-text`, but this repository does not install or configure
`eslint-plugin-jsx-a11y`, so ESLint treats the disable as an unknown rule.

The adjacent `<img>` already has a meaningful `alt={image.name}`.

## Goal

Restore the current lint contract without changing the paste-image preview UI
or adding lint dependencies.

## Required UI

No visible UI changes.

## Required Data/API

None.

## Required Automations

The existing lint gate must pass:

- `bun run lint`

## Required Subagents

None. ESLint points directly at the invalid inline rule suppression.

## TDD Requirements

Use the existing lint gate as the red check:

- `bun run lint`

## Implementation Requirements

- Remove the stale inline `jsx-a11y/alt-text` disable.
- Keep the existing `alt` text on the preview image.
- Do not add dependencies or ESLint plugins.

## Validation Commands

- `bun run lint`
- `bun run typecheck`
- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/paste-image-preview-dialog.rtl.test.tsx`
- `bun test`
- `git diff --check`

## Acceptance Criteria

- [x] `bun run lint` no longer errors on an unknown `jsx-a11y/alt-text` rule.
- [x] Paste-image preview dialog behavior remains covered.
- [x] No dependency changes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T344-paste-image-preview-lint-contract.md`.
