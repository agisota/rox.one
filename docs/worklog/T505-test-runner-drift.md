# T505 — bun:test vs vitest drift investigation (worklog)

## What was done
30-minute timebox investigation determined MEMORY.md "100 unit fails / discovery drift" framing was incorrect. `bun test` is green (6918 pass / 0 fail). All 55 failures originate in `bun run test:rtl` (Vitest, FreeFormInput RTL suite), every one with `useModalRegistry must be used within a ModalProvider`. Discovery is partitioned cleanly between bun-test (bunfig.toml pathIgnorePatterns) and vitest (vitest.config.ts include) — no overlap. Wrote docs/release/test-runner-drift-investigation-2026-05-15.md with full evidence. Marked ticket Status: DEFERRED; corrective code-fix is owned by T504/C1.

## Why
Memory mis-framing would have led future agents into a vitest/bun-test config archaeology rabbit-hole when the actual fix is a two-line ModalProvider wrap in shared RTL helper.

## Verification
- bun test 6918 pass / 0 fail confirmed
- Discovery globs verified non-overlapping
- Cross-reference to T504/C1 PR for canonical fix
