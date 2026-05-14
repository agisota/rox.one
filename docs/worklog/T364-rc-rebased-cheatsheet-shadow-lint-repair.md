# T364 - RC Rebased Cheatsheet Shadow Lint Repair

## 1. Task Summary

Repair the single lint error introduced by rebasing the RC S09 validation
blocker branch onto `origin/main` at `303b0b05`.

## 2. Repo Context Discovered

`bun run lint` runs IPC send checks, Electron lint, shared lint, and UI lint.
After the rebase, the Electron lint step fails on
`CheatsheetOverlay.tsx:57` because the keyboard cheatsheet keycap uses
`shadow-sm`, which is not in the repository's approved shadow-token set.

The same lint run reports seven warnings, but those warnings were already
present in prior green evidence and do not block the lint exit code.

## 3. Files Inspected

- `apps/electron/src/renderer/components/keyboard-cheatsheet/CheatsheetOverlay.tsx`
- `apps/electron/src/renderer/components/keyboard-cheatsheet/shortcut-registry.ts`
- `apps/electron/src/renderer/components/keyboard-cheatsheet/__tests__/shortcut-registry.test.ts`
- `docs/tickets/T364-rc-rebased-cheatsheet-shadow-lint-repair.md`
- `docs/worklog/T364-rc-rebased-cheatsheet-shadow-lint-repair.md`

## 4. Tests Added First

No new unit test was added. The failing contract is the existing lint rule
`rox-styles/no-nonstandard-shadows`, and the red test was captured before the
source edit with:

```bash
bun run lint
```

## 5. Expected Failing Test Output

Observed before implementation:

```text
apps/electron/src/renderer/components/keyboard-cheatsheet/CheatsheetOverlay.tsx
  57:20  error  Disallowed shadow class "shadow-sm". Use approved shadow classes only: shadow-bottom-border, shadow-bottom-border-thin, shadow-middle, shadow-minimal, shadow-modal-small, shadow-none, shadow-panel-focused, shadow-strong, shadow-thin, shadow-tinted, shadow-xs  rox-styles/no-nonstandard-shadows

8 problems (1 error, 7 warnings)
error: script "lint" exited with code 1
```

## 6. Implementation Changes

- Replaced the cheatsheet overlay keycap token `shadow-sm` with the approved
  `shadow-xs` token.
- Left shortcut registry, modal behavior, and the legacy shortcuts dialog
  untouched.

## 7. Validation Commands Run

```bash
bun run lint
bun run typecheck
bun test apps/electron/src/renderer/components/keyboard-cheatsheet/__tests__/shortcut-registry.test.ts
bun run validate:agent-contract
bun run validate:docs
git diff --check
```

## 8. Passing Test Output Summary

- `bun run lint`: exits 0 with 7 warnings and 0 errors.
- `bun run typecheck`: exits 0.
- `bun test apps/electron/src/renderer/components/keyboard-cheatsheet/__tests__/shortcut-registry.test.ts`:
  10 pass, 0 fail, 50 expect calls.
- `bun run validate:agent-contract`: `[agent-contract] ok: 11 skills, 328
  tickets, 7 required docs`.
- `bun run validate:docs`: agent contract, architecture docs, and sync v2
  design validations pass.
- `git diff --check`: exits 0.

## 9. Build Output Summary

No build was run for this token-only lint repair. The source edit changes one
Tailwind class from a rejected shadow token to an approved shadow token.

## 10. Remaining Risks

- The broader full `bun test` gate is still owned by T363 and remains to be
  refreshed after this lint repair.
- A legacy `KeyboardShortcutsDialog.tsx` keycap still contains `shadow-sm`, but
  the current lint gate does not report that file. This ticket keeps scope to
  the single rebased lint error.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| `bun run lint` exits 0 with no lint errors | Pass | Lint exits 0 with 7 warnings and 0 errors |
| Cheatsheet overlay uses an approved shadow class | Pass | `CheatsheetOverlay.tsx` uses `shadow-xs` |
| `bun run typecheck` exits 0 after the TSX edit | Pass | Typecheck exits 0 |
| `git diff --check` exits 0 | Pass | Whitespace check exits 0 |
