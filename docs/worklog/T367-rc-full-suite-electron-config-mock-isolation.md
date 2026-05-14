# T367 - RC Full Suite Electron Config Mock Isolation

## 1. Task Summary

Repair the next order-dependent RC full-suite blocker caused by
`auto-update.signature.test.ts` leaving incomplete Electron and shared config
module mocks active for later Electron main tests.

## 2. Repo Context Discovered

T366 reduced the full-suite failure count from 181 failures / 2 errors to
6 failures / 1 error. The remaining cluster is concentrated in Electron main
tests that pass alone but fail after the auto-update signature test runs first.

## 3. Files Inspected

- `apps/electron/src/main/__tests__/auto-update.signature.test.ts`
- `apps/electron/src/main/__tests__/browser-pane-manager.test.ts`
- `apps/electron/src/main/handlers/__tests__/registration-profiles.test.ts`
- `apps/electron/src/main/handlers/__tests__/registration.test.ts`
- `apps/electron/src/main/handlers/__tests__/electron-global-storage-scope.test.ts`
- `apps/electron/src/main/browser-pane-manager.ts`
- `apps/electron/src/main/menu.ts`
- `packages/shared/src/config/index.ts`
- `packages/shared/src/version/index.ts`

## 4. Tests Added First

No new test file is needed. The regression is captured by order-dependent
targeted reproducers that run the polluting auto-update test before affected
Electron main tests.

## 5. Expected Failing Test Output

Observed before implementation:

```text
apps/electron/src/main/__tests__/browser-pane-manager.test.ts:

# Unhandled error between tests
-------------------------------
SyntaxError: Export named 'getWorkspaceByNameOrId' not found in module
'/home/dev/rox-m11-repair/packages/shared/src/config/index.ts'.

40 pass
1 fail
1 error
```

The handler reproducer fails for the same root cause:

```text
SyntaxError: Export named 'getWorkspaceByNameOrId' not found in module
'/home/dev/rox-m11-repair/packages/shared/src/config/index.ts'.
SyntaxError: Export named 'DEFAULT_LOCAL_SCOPE' not found in module
'/home/dev/rox-m11-repair/packages/shared/src/config/index.ts'.
SyntaxError: Export named 'setSetupDeferred' not found in module
'/home/dev/rox-m11-repair/packages/shared/src/config/index.ts'.

40 pass
5 fail
1 error
```

## 6. Implementation Changes

- Changed the auto-update signature test's `@rox-one/shared/config` mock into a
  pass-through mock that preserves real exports and overrides only the dismissed
  update helpers used by the auto-update launch checks.
- Changed the `@rox-one/shared/version` mock into a pass-through mock while
  preserving the test's pinned `0.9.2` current-version behavior.
- Expanded the test-local Electron and menu mocks so persistent mocks expose
  the named exports required by later Electron main imports without loading the
  real Electron runtime.

## 7. Validation Commands Run

```bash
bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts apps/electron/src/main/__tests__/browser-pane-manager.test.ts
bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts apps/electron/src/main/handlers/__tests__/registration-profiles.test.ts apps/electron/src/main/handlers/__tests__/registration.test.ts apps/electron/src/main/handlers/__tests__/electron-global-storage-scope.test.ts
bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts
bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts packages/shared/src/config/__tests__
bun run validate:docs
bun run lint:electron
bun run typecheck:electron
git diff --check
```

## 8. Passing Test Output Summary

- `bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts
  apps/electron/src/main/__tests__/browser-pane-manager.test.ts`: 129 pass,
  0 fail, 237 expect calls.
- `bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts
  apps/electron/src/main/handlers/__tests__/registration-profiles.test.ts
  apps/electron/src/main/handlers/__tests__/registration.test.ts
  apps/electron/src/main/handlers/__tests__/electron-global-storage-scope.test.ts`:
  48 pass, 0 fail, 81 expect calls.
- `bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts`:
  40 pass, 0 fail, 59 expect calls.
- `bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts
  packages/shared/src/config/__tests__`: 253 pass, 0 fail, 523 expect calls.
- `bun run validate:docs`: agent contract, architecture docs, and sync v2
  design validations pass.
- `bun run lint:electron`: exits 0 with 7 pre-existing warnings and 0 errors.
- `git diff --check`: pass.

## 9. Build Output Summary

No build is planned for this test-only repair unless runtime source changes.

## 10. Remaining Risks

- Other full-suite clusters may remain after this mock-isolation fix.
- Bun module mocks persist across files in the same run, so the fix must keep
  the auto-update test controls while presenting a complete enough module
  surface for later imports.
- `bun run typecheck:electron` still exits 2 on unrelated renderer/playground
  fixture errors (`BrowserInstanceInfo.hungTab`, RTL matcher type declarations,
  and `TeamManagementStatus`). The touched auto-update test does not appear in
  that typecheck output.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Auto-update-before-browser-pane reproducer passes | Pass | 129 pass, 0 fail |
| Auto-update-before-handler-registration reproducer passes | Pass | 48 pass, 0 fail |
| Auto-update signature tests still pass | Pass | 40 pass, 0 fail |
| `bun run validate:docs` passes | Pass | Validator exits 0 |
| `git diff --check` passes | Pass | Whitespace check exits 0 |
