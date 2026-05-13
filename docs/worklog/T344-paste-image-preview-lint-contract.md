# T344 - Paste image preview lint contract

Status: DONE
Phase: post-rebase lint repair
Ticket: docs/tickets/T344-paste-image-preview-lint-contract.md

## 1. Task summary

Repair the current Electron lint gate by removing a stale inline
`jsx-a11y/alt-text` suppression from the paste-image preview dialog.

## 2. Repo context discovered

`bun run lint` failed in `apps/electron/src/renderer/components/app-shell/input/PasteImagePreviewDialog.tsx`
with `Definition for rule 'jsx-a11y/alt-text' was not found`. The Electron
ESLint flat config includes TypeScript, React, React hooks, and local ROX
rules, but it does not install or register `eslint-plugin-jsx-a11y`.

The image already renders with `alt={image.name}`, so the suppression is both
invalid in this repo and unnecessary for accessibility.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/PasteImagePreviewDialog.tsx`
- `apps/electron/eslint.config.js`
- `package.json`

## 4. Tests added first

No new test file was needed. The existing lint gate is the executable contract
for configured ESLint rules.

## 5. Expected failing test output

`bun run lint` failed with:

- `PasteImagePreviewDialog.tsx`
- `error  Definition for rule 'jsx-a11y/alt-text' was not found  jsx-a11y/alt-text`

The same run also reported three existing React hook dependency warnings, but
the unknown-rule error was the only lint failure.

## 6. Implementation changes

- Removed the inline `eslint-disable-next-line jsx-a11y/alt-text` comment.
- Left the existing `alt={image.name}` on the preview image.
- Left ESLint configuration and dependencies unchanged.

## 7. Validation commands run

- `bun run lint` (red)
- `cd apps/electron && ~/.bun/bin/bunx vitest run --config vitest.config.ts src/renderer/components/app-shell/input/__tests__/paste-image-preview-dialog.rtl.test.tsx`
- `bun run lint`
- `bun run typecheck`
- `bun test`
- `bun run build`
- `git diff --check`

## 8. Passing test output summary

- Paste-image preview RTL test: 1 file passed, 6 tests passed.
- `bun run lint`: exit 0 with the same 3 existing React hook warnings and
  0 errors; the unknown `jsx-a11y/alt-text` rule error is gone.
- `bun run typecheck`: exit 0.
- `bun test`: 5988 pass, 13 skip, 0 fail, 1 snapshot, 24614 expect calls.
- `git diff --check`: clean.

## 9. Build output summary

`bun run build` exited 0. This ticket is a renderer comment-only lint repair;
the build completed all Electron stages after the final validation pass.

## 10. Remaining risks

The targeted RTL run still emits existing Radix dialog accessibility warnings
from the test harness, but all assertions pass and the preview image keeps its
`alt={image.name}` text.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Unknown ESLint rule error removed | Green | `bun run lint` exit 0; 0 errors, 3 existing warnings |
| Dialog behavior remains covered | Green | Paste-image preview RTL test: 6 tests passed |
| No dependency changes | Green | No package manifest or lockfile diff |
| Worklog complete | Green | Final validation evidence recorded |
| Commit created | Green | Atomic commit after validation |
