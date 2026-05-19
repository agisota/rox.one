# T505 - bun:test vs vitest discovery drift investigation

Status: DONE
PR: fix/t505-rtl-modal-provider-wrap
Date: 2026-05-15
Owner-of-fix: Codex
Related: `fix/T504-rtl-modal-provider-wrap` (superseded/deferred ownership handoff)

## Summary

Bonus unit for RC2 cycle. The MEMORY.md note `bun:test vs vitest discovery
drift` claims ~100 unit test failures on main 2026-05-14. This ticket reopens
the investigation. Outcome: the framing was wrong — there was no discovery
drift; `bun test` was green; the visible failures were RTL tests under Vitest
from a missing provider in the shared render helper. The deferred ownership
blocker is now resolved: `TestComposerHarness` wraps tests with `ModalProvider`,
the helper no longer re-exports Testing Library's raw `render` through a star
export, and the full RTL suite is green.

## Findings

- `bun test` on origin/main HEAD `c07100a9` —
  **6918 pass / 13 skip / 0 fail** across 566 files, 169.44s.
- `bun run test:rtl` —
  **9 files failed / 55 tests failed**, all with the same error:
  `useModalRegistry must be used within a ModalProvider`.
- Test discovery is **not drifting** between runners. `bunfig.toml`
  `pathIgnorePatterns` excludes `**/*.rtl.test.tsx`; `apps/electron/vitest.config.ts`
  `include: ['src/**/*.rtl.test.tsx']` matches exactly the 26 files on disk.
- Root cause: `TestComposerHarness` in
  `apps/electron/src/test-utils/render.tsx` does not wrap children with
  `ModalProvider` from `apps/electron/src/renderer/context/ModalContext.tsx`.

## Resolution

- Added `ModalProvider` to `apps/electron/src/test-utils/render.tsx`.
- Replaced the broad Testing Library star re-export with explicit helper
  exports so `render` is unambiguously the provider-wrapped local function.
- Added a `useModalRegistry` smoke assertion in
  `apps/electron/src/test-utils/__tests__/render.rtl.test.tsx`.
- Removed a hoisted `ModalContext` mock from `edit-popover.rtl.test.tsx` that
  became invalid once the shared helper provided the real provider.
- Refreshed stale `ProductModeToolbar` intent assertions for the current
  `behavior`, `artifactKind`, and `wrapperId` contract.

## Secondary observation

`scripts.test:units` `find` does not exclude `.claude/worktrees/`, so the
isolated-test loop runs each file 70x+ when agent worktrees are present.
Tracked as a follow-up; not included in this ticket because it is unrelated
to the "drift" framing.

## Files

| File | Purpose |
|---|---|
| `docs/release/test-runner-drift-investigation-2026-05-15.md` | Full investigation, reproduction, failure inventory, recommended fix |
| `docs/tickets/T505-test-runner-drift.md` | This ticket |

## Validation

- `bun test` exit 0 (was: claim of 100 failures; actual: 0 failures).
- `bun run test:rtl` passes: 30 files / 170 tests.
- `apps/electron` `bun run typecheck` passes.
- No production source files modified.
- Test files were updated only to lock the helper/provider contract and current
  product-mode intent shape; no tests were skipped.
- `bun run validate:architecture-docs` clean in the original investigation.

## References

- MEMORY.md note: `bun:test vs vitest discovery drift`
- `docs/release/2026-05-14-rc-evidence.md` (RC1 evidence; unaffected by these
  RTL failures because they are dev-only)
- C1's owned surface: `apps/electron/src/renderer/__tests__/test-utils.tsx`
  (alias for the shared render helper at
  `apps/electron/src/test-utils/render.tsx`)
