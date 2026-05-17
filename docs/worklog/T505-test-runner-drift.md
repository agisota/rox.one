# T505 — bun:test vs vitest drift investigation (worklog)

## What was done
30-minute timebox investigation determined MEMORY.md "100 unit fails / discovery drift" framing was incorrect. `bun test` is green (6918 pass / 0 fail). All 55 failures originate in `bun run test:rtl` (Vitest, FreeFormInput RTL suite), every one with `useModalRegistry must be used within a ModalProvider`. Discovery is partitioned cleanly between bun-test (bunfig.toml pathIgnorePatterns) and vitest (vitest.config.ts include) — no overlap. Wrote docs/release/test-runner-drift-investigation-2026-05-15.md with full evidence. Marked ticket Status: DEFERRED; corrective code-fix is owned by T504/C1.

## Why
Memory mis-framing would have led future agents into a vitest/bun-test config archaeology rabbit-hole when the actual fix is a two-line ModalProvider wrap in shared RTL helper.

## Verification
- bun test 6918 pass / 0 fail confirmed
- Discovery globs verified non-overlapping
- Cross-reference to T504/C1 PR for canonical fix

## 2026-05-17 continuation

T504/C1 is no longer an active ownership blocker in the current mainline closeout
lane. Re-opened the deferred corrective slice on `fix/t505-rtl-modal-provider-wrap`.
The implementation surface is intentionally narrow:

- `apps/electron/src/test-utils/render.tsx` should include `ModalProvider` in
  `TestComposerHarness`.
- `apps/electron/src/test-utils/__tests__/render.rtl.test.tsx` should assert
  the harness exposes the modal registry, so the missing-provider regression is
  caught before the larger FreeFormInput RTL matrix fails.

## 2026-05-17 outcome

Implemented the deferred fix and closed the actual RTL instability:

- Added `ModalProvider` to `TestComposerHarness`.
- Replaced the broad `export * from '@testing-library/react'` with explicit
  Testing Library re-exports so the local wrapped `render` cannot be shadowed.
- Added a modal-registry smoke test for the shared helper.
- Removed the stale `ModalContext` mock in `edit-popover.rtl.test.tsx`.
- Updated `ProductModeToolbar` RTL expectations to the current enriched intent
  payload.

## 2026-05-17 verification

- `~/.bun/bin/bunx vitest run --config vitest.config.ts src/test-utils/__tests__/render.rtl.test.tsx`
  — 1 file / 2 tests passed.
- `bun run test:rtl` — 30 files / 170 tests passed.
- `apps/electron` `bun run typecheck` — passed.
