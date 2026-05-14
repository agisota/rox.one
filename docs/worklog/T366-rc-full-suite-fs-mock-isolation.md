# T366 - RC Full Suite FS Mock Isolation

## 1. Task Summary

Repair an order-dependent full-suite blocker caused by the auto-update
signature test globally mocking `fs` too narrowly for later tests.

## 2. Repo Context Discovered

Focused config/storage tests pass, but the full suite fails config bootstrap and
multi-tenant migration assertions after earlier Electron main tests run in the
same Bun process. The smallest reproducer runs the auto-update signature test
before the storage migrations test and fails before storage assertions execute
because `node:fs` is missing exports.

## 3. Files Inspected

- `apps/electron/src/main/__tests__/auto-update.signature.test.ts`
- `apps/electron/src/main/auto-update.ts`
- `packages/shared/src/config/storage-io.ts`
- `packages/shared/src/config/__tests__/storage-migrations.test.ts`
- `docs/tickets/T366-rc-full-suite-fs-mock-isolation.md`
- `docs/worklog/T366-rc-full-suite-fs-mock-isolation.md`

## 4. Tests Added First

No new test file was needed. The regression is captured by the order-dependent
targeted reproducer:

```bash
bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts packages/shared/src/config/__tests__/storage-migrations.test.ts
```

## 5. Expected Failing Test Output

Observed before implementation:

```text
packages/shared/src/config/__tests__/storage-migrations.test.ts:

# Unhandled error between tests
-------------------------------
SyntaxError: Export named 'mkdirSync' not found in module 'node:fs'.

40 pass
1 fail
1 error
```

## 6. Implementation Changes

- Changed the auto-update signature test's `fs`, `path`, `os`, and
  `@rox-one/shared/utils/files` mocks into pass-through mocks that preserve real
  exports and override only the functions required by the auto-update cache
  checks.
- Added `afterAll` restoration for the overridden mock implementations so later
  test files in the same Bun process see real filesystem/path/platform behavior.
- Widened the `mockCheckForUpdates` helper return type so the touched test file
  no longer contributes Electron typecheck errors.

## 7. Validation Commands Run

```bash
bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts packages/shared/src/config/__tests__/storage-migrations.test.ts
bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts
bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts packages/shared/src/config/__tests__
bun test packages/shared/src/config/__tests__
bun run validate:docs
bun run typecheck:electron
bun run lint:electron
git diff --check
```

## 8. Passing Test Output Summary

- `bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts
  packages/shared/src/config/__tests__/storage-migrations.test.ts`: 53 pass, 0
  fail, 77 expect calls.
- `bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts`:
  40 pass, 0 fail, 59 expect calls.
- `bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts
  packages/shared/src/config/__tests__`: 253 pass, 0 fail, 523 expect calls.
- `bun test packages/shared/src/config/__tests__`: 213 pass, 0 fail, 464
  expect calls.
- `bun run validate:docs`: agent contract, architecture docs, and sync v2
  design validations pass.
- `bun run lint:electron`: exits 0 with 7 pre-existing warnings and 0 errors.
- `git diff --check`: pass.

## 9. Build Output Summary

No build was run. This repair changes only test mock code and ticket/worklog
documentation.

## 10. Remaining Risks

- Other full-suite clusters may remain after this mock-isolation fix.
- `bun run typecheck:electron` still exits 2 on unrelated renderer/playground
  fixture errors (`BrowserInstanceInfo.hungTab`, RTL matcher type declarations,
  and `TeamManagementStatus`). The touched auto-update test no longer appears
  in that typecheck output after the helper type repair.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Auto-update-before-storage reproducer passes | Pass | 53 pass, 0 fail |
| Auto-update signature tests still pass | Pass | 40 pass, 0 fail |
| Focused config tests still pass | Pass | Auto-update plus config directory run: 253 pass, 0 fail |
| `bun run validate:docs` passes | Pass | Validator exits 0 |
| `git diff --check` passes | Pass | Whitespace check exits 0 |
