# T367 - RC Full Suite Electron Config Mock Isolation

Status: Done

## Context

T366 repaired the filesystem/mock pollution cluster, but the next full
`bun test` run still fails only in order-dependent Electron main tests. The
smallest current reproducer runs the auto-update signature test before the
browser pane manager test and fails because the auto-update test's global
module mocks leave later imports with incomplete named exports.

## Goal

Keep `auto-update.signature.test.ts` hermetic while preventing its persistent
Bun module mocks from shadowing Electron and shared config exports required by
later Electron main tests in the same full-suite process.

## TDD Requirements

1. Reproduce the order-dependent failure by running the auto-update signature
   test before the browser pane manager test.
2. Fix only the test mock boundary so later imports can access the named
   exports they require.
3. Re-run the reproducer and focused Electron handler registrations that failed
   in the full suite.

## Implementation Requirements

- Do not change production Electron, shared config, or server-core code.
- Keep the repair inside `apps/electron/src/main/__tests__/auto-update.signature.test.ts`.
- Preserve the auto-update signature, downgrade-guard, and dismissed-version
  assertions.
- Avoid importing the real Electron runtime in Bun tests.

## Validation Commands

```bash
bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts apps/electron/src/main/__tests__/browser-pane-manager.test.ts
bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts apps/electron/src/main/handlers/__tests__/registration-profiles.test.ts apps/electron/src/main/handlers/__tests__/registration.test.ts apps/electron/src/main/handlers/__tests__/electron-global-storage-scope.test.ts
bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts
bun run validate:docs
git diff --check
```

## Acceptance Criteria

- [x] The auto-update-before-browser-pane reproducer passes.
- [x] The auto-update-before-handler-registration reproducer passes.
- [x] Auto-update signature tests still pass.
- [x] `bun run validate:docs` passes.
- [x] `git diff --check` passes.

## Worklog

Update `docs/worklog/T367-rc-full-suite-electron-config-mock-isolation.md`.
