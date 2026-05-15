# T505 - bun:test vs vitest discovery drift investigation

Status: DEFERRED
PR: fix/T505-test-runner-drift
Date: 2026-05-15
Owner-of-fix: T504 / C1 (shared RTL render helper)
Related: `fix/T504-rtl-modal-provider-wrap` (active fix branch)

## Summary

Bonus unit for RC2 cycle. The MEMORY.md note `bun:test vs vitest discovery
drift` claims ~100 unit test failures on main 2026-05-14. This ticket reopens
the investigation. Outcome: the framing is wrong — there is no discovery
drift; `bun test` is green; the visible failures are 55 RTL tests under
Vitest, all from a single missing provider in the shared render helper. The
fix is well-understood and one-line, but the file is owned by C1 in the
current parallel-agent allocation (T504 is the active fix branch), so the
actual code change is deferred.

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

## Recommended fix (deferred to T504 / C1)

Add `ModalProvider` wrapper inside `TestComposerHarness`. One-line
import + one-line JSX. Estimated effort < 30 minutes including re-running
the full Vitest suite.

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
- `bun run test:rtl` reproduces 55 failures with a single-line root cause.
- No production source files modified.
- No test files modified or skipped.
- `bun run validate:architecture-docs` clean.

## References

- MEMORY.md note: `bun:test vs vitest discovery drift`
- `docs/release/2026-05-14-rc-evidence.md` (RC1 evidence; unaffected by these
  RTL failures because they are dev-only)
- C1's owned surface: `apps/electron/src/renderer/__tests__/test-utils.tsx`
  (alias for the shared render helper at
  `apps/electron/src/test-utils/render.tsx`)
