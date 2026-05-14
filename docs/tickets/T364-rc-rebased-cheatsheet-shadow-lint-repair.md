# T364 - RC Rebased Cheatsheet Shadow Lint Repair

Status: Done

## Context

After rebasing the S09 validation blocker branch onto `origin/main` at
`303b0b05`, `bun run lint` no longer passes. The only lint error is in the new
keyboard cheatsheet overlay from upstream T240:

```text
apps/electron/src/renderer/components/keyboard-cheatsheet/CheatsheetOverlay.tsx:57:20
error  Disallowed shadow class "shadow-sm". Use approved shadow classes only:
shadow-bottom-border, shadow-bottom-border-thin, shadow-middle, shadow-minimal,
shadow-modal-small, shadow-none, shadow-panel-focused, shadow-strong,
shadow-thin, shadow-tinted, shadow-xs  rox-styles/no-nonstandard-shadows
```

The remaining lint output is the pre-existing seven-warning set.

## Goal

Restore the lint gate after the rebase without changing keyboard shortcut
behavior or weakening the approved shadow-token rule.

## TDD Requirements

1. Reproduce the failing lint gate before editing source.
2. Make the smallest token-only fix that satisfies
   `rox-styles/no-nonstandard-shadows`.
3. Re-run lint and relevant lightweight validation after the edit.

## Implementation Requirements

- Add no dependency.
- Do not touch shortcut registry behavior, modal wiring, or legacy shortcut
  surfaces.
- Keep the fix scoped to the rebased cheatsheet overlay lint error.

## Validation Commands

```bash
bun run lint
bun run typecheck
bun run build
git diff --check
```

## Acceptance Criteria

- [x] `bun run lint` exits 0 with no lint errors.
- [x] The cheatsheet overlay uses an approved shadow class.
- [x] `bun run typecheck` exits 0 after the TSX edit.
- [x] `bun run build` exits 0 after the renderer TSX edit.
- [x] `git diff --check` exits 0.

## Worklog

Update `docs/worklog/T364-rc-rebased-cheatsheet-shadow-lint-repair.md`.
