# T004 — RU/EN localization foundation

## 1. Task summary

T004 extends the existing i18n foundation instead of adding a second localization layer.

Goal:
- localize the new T003 brand/account summary labels;
- preserve the existing `react-i18next` / shared locale registry architecture;
- add tests for EN/RU brand localization and fallback behavior;
- keep locale parity across all registered locale files.

## 2. Repo context discovered

The repository already has a full localization system:
- `packages/shared/src/i18n/setupI18n.ts` initializes bundled i18next resources;
- `packages/shared/src/i18n/registry.ts` registers EN, RU, ES, ZH-Hans, JA, HU, DE, and PL locale files;
- renderer startup calls `setupI18n([LanguageDetector, initReactI18next])`;
- settings and app-shell UI already use `useTranslation()`;
- locale parity and registry tests already exist.

Therefore T004 should extend current dictionaries and translation consumers, not create a parallel provider.

## 3. Files inspected

- `packages/shared/src/i18n/setupI18n.ts`
- `packages/shared/src/i18n/languages.ts`
- `packages/shared/src/i18n/registry.ts`
- `packages/shared/src/i18n/locales/en.json`
- `packages/shared/src/i18n/locales/ru.json`
- `packages/shared/src/i18n/locales/de.json`
- `packages/shared/src/i18n/locales/es.json`
- `packages/shared/src/i18n/locales/ja.json`
- `packages/shared/src/i18n/locales/zh-Hans.json`
- `packages/shared/src/i18n/locales/hu.json`
- `packages/shared/src/i18n/locales/pl.json`
- `apps/electron/src/renderer/main.tsx`
- `apps/electron/src/renderer/pages/settings/account-brand-summary.ts`
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx`

## 4. Tests added first

Added T004 tests before implementation:
- `packages/shared/src/i18n/__tests__/workbench-brand-localization.test.ts`
- updated `apps/electron/src/renderer/pages/settings/__tests__/account-brand-summary.test.ts` to require translator-driven labels.

The tests assert:
- English and Russian `workbench.brand.*` labels exist;
- product description interpolation works;
- missing keys fall back safely;
- Account brand summary rows can render with EN and RU labels through a provided translator.

## 5. Expected failing test output

After dependency hydration, the red phase failed for the expected T004 reasons:

```text
Expected: "Application"
Received: "workbench.brand.section"
```

```text
Expected: "Agent Workbench Suite / Local and cloud agent workbench"
Received: "workbench.brand.productDescription"
```

```text
Expected label: "Product"
Received label: "Продукт"
```

This proved the new brand keys did not exist and the account brand summary helper still had hardcoded Russian labels.

An intermediate validation run also caught locale sorting drift:

```text
UnreachableError: Key "auth.connectionRequired" at index 19 is out of order (expected "auth.connectToServices")
```

Cause: locale files were initially sorted with `localeCompare`, while the repo parity test expects default JS `.sort()` order. The locale rewrite was corrected to use the same ordering contract as the test.

## 6. Implementation changes

Localization:
- added `workbench.brand.documentation`;
- added `workbench.brand.legalName`;
- added `workbench.brand.product`;
- added `workbench.brand.productDescription`;
- added `workbench.brand.section`;
- added `workbench.brand.support`.

These keys were added to every registered locale file to satisfy existing parity tests. EN/RU use localized labels; other locales use the English fallback strings for this new workbench namespace until full translations are provided.

Account brand summary:
- added `AccountBrandSummaryTranslator`;
- added `ACCOUNT_BRAND_SUMMARY_KEYS`;
- changed `getAccountBrandSummaryRows` to accept a translator and stop hardcoding Russian labels;
- kept a safe default translator for non-React/unit usage.

Account UI:
- `AccountSettingsPage` now passes `t` into `getAccountBrandSummaryRows`;
- the brand section title now uses `t("workbench.brand.section")`.

## 7. Validation commands run

```bash
bun install --frozen-lockfile
bun test packages/shared/src/i18n/__tests__/workbench-brand-localization.test.ts apps/electron/src/renderer/pages/settings/__tests__/account-brand-summary.test.ts
bun test packages/shared/src/i18n/__tests__/workbench-brand-localization.test.ts apps/electron/src/renderer/pages/settings/__tests__/account-brand-summary.test.ts packages/shared/src/i18n/__tests__/locale-parity.test.ts packages/shared/src/i18n/__tests__/locale-registry.test.ts
bun run typecheck:shared
bun run typecheck:electron
git diff --check
```

## 8. Passing test output summary

Targeted T004/i18n validation:

```text
78 pass
0 fail
109 expect() calls
Ran 78 tests across 4 files.
```

Typecheck:
- `bun run typecheck:shared` passed.
- `bun run typecheck:electron` passed.

Whitespace/static diff check:
- `git diff --check` passed with no output.

## 9. Build output summary

No full desktop packaging build was run for T004. The task changed shared locale data and renderer account/settings copy. Relevant gates were locale tests, shared typecheck, electron typecheck, and diff whitespace check.

## 10. Remaining risks

- Full translation quality for non-EN/RU locales is intentionally deferred; new workbench keys use English fallback strings there to keep locale parity intact.
- Runtime language persistence already exists through i18next localStorage detection and Electron `changeLanguage` IPC, but T004 did not redesign the preferences-language source-of-truth split.
- Broad legacy string translation is out of scope; T004 localizes only the new T003 brand/account summary surface.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| RU/EN dictionaries contain new workbench labels | PASS | `workbench.brand.*` keys added and tested. |
| Existing i18n provider reused | PASS | No new provider/framework added; `useTranslation` path used. |
| Missing key fallback is safe | PASS | `workbench.brand.missingKey` test returns key fallback. |
| New T003 account brand labels use i18n | PASS | Helper now accepts translator and Account settings passes `t`. |
| Locale parity preserved | PASS | Locale parity/registry tests passed: 78/78. |
| Typechecks pass | PASS | Shared and Electron typechecks passed. |
| Build passes | NOT RUN | No packaging change; targeted validation used. |
