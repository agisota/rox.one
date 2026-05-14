# T366 - RC Full Suite FS Mock Isolation

Status: Done

## Context

T363's full `bun test` evidence shows config and storage tests failing only in
the full suite. Focused config/storage runs are green, but running
`apps/electron/src/main/__tests__/auto-update.signature.test.ts` before
`packages/shared/src/config/__tests__/storage-migrations.test.ts` reproduces an
order-dependent failure:

```text
SyntaxError: Export named 'mkdirSync' not found in module 'node:fs'.
```

The auto-update signature test globally mocks `fs` with only `existsSync` and
`readdirSync`, which leaves later tests importing incomplete `fs` / `node:fs`
modules in the same Bun process.

## Goal

Keep the auto-update signature tests hermetic without polluting later full-suite
tests that require the real `fs` and `node:fs` exports.

## TDD Requirements

1. Reproduce the order-dependent failure by running the auto-update signature
   test before the storage migrations test.
2. Fix the mock so the auto-update test still controls update-cache file checks
   while preserving untouched real filesystem exports.
3. Re-run the reproducer and focused config/storage coverage.

## Implementation Requirements

- Do not weaken the auto-update signature or downgrade-guard tests.
- Do not change storage/config production code for this order-dependent mock
  pollution.
- Keep the repair inside the auto-update test/mock boundary unless evidence
  shows another root cause.

## Validation Commands

```bash
bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts packages/shared/src/config/__tests__/storage-migrations.test.ts
bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts
bun test packages/shared/src/config/__tests__
bun run validate:docs
git diff --check
```

## Acceptance Criteria

- [x] The auto-update-before-storage reproducer passes.
- [x] Auto-update signature tests still pass.
- [x] Focused config tests still pass.
- [x] `bun run validate:docs` passes.
- [x] `git diff --check` passes.

## Worklog

Update `docs/worklog/T366-rc-full-suite-fs-mock-isolation.md`.
