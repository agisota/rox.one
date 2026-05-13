# T210 - Transport banner i18n test determinism Worklog

## 1. Task summary

Repair the transport connection banner test by making the asserted language
explicit.

## 2. Repo context discovered

- `packages/shared/src/i18n/setupI18n.ts` defaults to Russian when no
  `localStorage.i18nextLng` is present.
- `apps/electron/src/renderer/components/app-shell/__tests__/transport-connection-banner.test.ts`
  says it bootstraps English resources but only calls `setupI18n()`.
- `TransportConnectionBanner.tsx` uses `i18n.t()` at runtime, so the active
  i18n language controls returned copy.
- Other i18n tests explicitly call `i18n.changeLanguage('en')` before asserting
  English strings.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/__tests__/transport-connection-banner.test.ts`
- `apps/electron/src/renderer/components/app-shell/TransportConnectionBanner.tsx`
- `packages/shared/src/i18n/setupI18n.ts`
- `packages/shared/src/i18n/locales/en.json`
- `packages/shared/src/i18n/locales/ru.json`
- `packages/shared/src/i18n/__tests__/workbench-brand-localization.test.ts`
- `packages/shared/src/workbench/__tests__/product-mode-registry.test.ts`

## 4. Tests added first

No new test file is needed. The existing focused test is already red for the
right reason.

## 5. Expected failing test output

```text
bun test apps/electron/src/renderer/components/app-shell/__tests__/transport-connection-banner.test.ts
```

Expected red state:

```text
Expected to contain: "Cannot connect"
Received: "Невозможно подключиться к удалённому серверу"

Expected to contain: "Reconnecting"
Received: "Повторное подключение к удалённому серверу"
```

## 6. Implementation changes

- Imported the shared `i18n` singleton in the focused test.
- Kept `setupI18n()` as the bootstrap path, then explicitly selected English
  with `i18n.changeLanguage('en')`.
- Did not change `TransportConnectionBanner.tsx`, localized strings, or
  `setupI18n()` defaults.

## 7. Validation commands run

- `bun test apps/electron/src/renderer/components/app-shell/__tests__/transport-connection-banner.test.ts`
- `git diff -- apps/electron/src/renderer/components/app-shell/__tests__/transport-connection-banner.test.ts packages/shared/src/i18n/setupI18n.ts packages/shared/src/i18n/locales/en.json packages/shared/src/i18n/locales/ru.json --stat`

## 8. Passing test output summary

- `transport-connection-banner.test.ts`: 7 pass, 0 fail, 13 expects.
- Runtime i18n/copy diff stat showed only the focused test file changed.

## 9. Build output summary

No runtime build was run for this test-harness-only fix yet. Final C4
validation will run after both validation blockers are committed.

## 10. Remaining risks

- The test now mutates the shared i18n singleton to English. That is scoped to
  the current test file process and matches existing i18n test patterns.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Focused transport banner test passes | Pass | 7 pass, 0 fail |
| Runtime copy and defaults unchanged | Pass | Only the focused test file changed |
| Worklog complete | Pass | This file |
| Commit created | Pass | This ticket commit |
