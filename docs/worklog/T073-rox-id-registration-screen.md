# T073 - ROX ID Registration Screen Worklog

## 1. Task summary

Fix the embedded ROX ID registration experience and redesign the unauthenticated account screen so it is clear,
polished, and consistent with the product account model.

## 2. Repo context discovered

- `AccountSettingsPage` owns the account settings route and delegates unauthenticated login/register/reset to `AccountAuthPanel`.
- `AccountAuthPanel` maps tabs to `/api/auth/login`, `/api/auth/register`, and `/api/auth/password-reset/request`.
- `account-auth-feedback` already suppresses stale auth errors after a confirmed user, but did not distinguish register pending state.
- `packages/server-core/src/webui/http-server.ts` returns `verificationRequired: true` on register and does not set a session cookie before email verification.
- `packages/server-core/src/webui/__tests__/account-http.test.ts` explicitly asserts that register returns `set-cookie = null`.

## 3. Files inspected

- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx`
- `apps/electron/src/renderer/pages/settings/AccountAuthPanel.tsx`
- `apps/electron/src/renderer/pages/settings/account-auth-feedback.ts`
- `apps/electron/src/renderer/pages/settings/__tests__/account-auth-feedback.test.ts`
- `apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx`
- `apps/electron/src/main/account-api.ts`
- `apps/electron/src/main/index.ts`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
- `package.json`

## 4. Tests added first

- `account-auth-feedback.test.ts`: registration refresh `Authentication required` and raw IPC-wrapped auth errors must become a non-fatal email verification/sign-in pending message.
- `account-auth-panel.test.tsx`: unauthenticated panel must expose a `data-auth-surface="rox-id"` ROX ID surface with account benefit anatomy.

## 5. Expected failing test output

Targeted red run:

```bash
bun test apps/electron/src/renderer/pages/settings/__tests__/account-auth-feedback.test.ts \
  apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx
```

Expected failures were confirmed:

```text
2 fail / 6 pass

account-auth-panel.test.tsx:
  Expected account auth panel to expose data-auth-surface="rox-id".

account-auth-feedback.test.ts:
  Expected register refresh Authentication required to show:
  "Аккаунт создан. Проверьте email и войдите после подтверждения ROX ID."
  but old generic sign-in pending copy was returned.
```

## 6. Implementation changes

- `account-auth-feedback.ts`
  - Added auth error normalization for raw IPC wrapper text such as
    `Error invoking remote method 'account:request': Error: Authentication required`.
  - Added `isPendingAccountAuthRefresh()` so callers can treat stale `/api/account/me`
    refresh failures as pending state instead of fatal errors.
  - Added register-specific pending copy:
    `Аккаунт создан. Проверьте email и войдите после подтверждения ROX ID.`
  - Preserved distinct sign-in pending copy for login flows.
- `AccountSettingsPage.tsx`
  - Tracks the last normalized account refresh error.
  - After register/login request success, refreshes `/api/account/me` and only treats
    the flow as fully authenticated if a confirmed account user is returned.
  - Suppresses pending auth refresh from the red error channel for registration.
  - Sends friendly success/pending state into the auth panel.
  - Replaces the old nested unauthenticated settings copy with a centered embedded
    ROX ID account screen.
- `AccountAuthPanel.tsx`
  - Rebuilt the unauthenticated screen as a dedicated `data-auth-surface="rox-id"` panel.
  - Added visible account benefits: profile, balance, teams, and Experience Layer progress.
  - Localized form labels to Russian-first copy where appropriate.
  - Added proper success/error feedback states instead of dumping raw IPC messages.
  - Kept external browser handoff out of the account form.

## 7. Validation commands run

```bash
bun test apps/electron/src/renderer/pages/settings/__tests__/account-auth-feedback.test.ts \
  apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx

bun test apps/electron/src/renderer/pages/settings/__tests__/account-auth-feedback.test.ts \
  apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx \
  apps/electron/src/renderer/pages/settings/__tests__/account-brand-summary.test.ts \
  apps/electron/src/renderer/pages/settings/__tests__/account-storage-summary.test.ts \
  apps/electron/src/renderer/pages/settings/__tests__/account-teams-summary.test.ts

bun run typecheck:electron
bun run validate:docs
bun run lint:electron
git diff --check
bun run electron:build
```

## 8. Passing test output summary

- Targeted auth tests: `8 pass, 0 fail, 32 expect() calls`.
- Broader account settings tests: `17 pass, 0 fail, 52 expect() calls`.
- `bun run typecheck:electron`: passed.
- `bun run validate:docs`: passed with `67` canonical tickets after T073.
- `bun run lint:electron`: passed with `0` errors and `3` existing dependency-array warnings outside this change.
- `git diff --check`: passed.

## 9. Build output summary

`bun run electron:build` passed.

Known non-blocking build warnings remained:

- Vite output directory warning for an outDir outside project root.
- Jotai Babel plugin deprecation warnings.
- Large chunk warnings over 500 kB.

## 10. Remaining risks

- Real rox.one email verification was not exercised in tests. This is intentional:
  tests use deterministic contracts and do not call production email/account providers.
- Registration still does not create an authenticated account session until
  `/api/account/me` confirms a user after email verification/sign-in. This is the desired
  backend contract, not a UI shortcut.
- Visual verification was covered through component assertions, typecheck, lint, and build.
  A full screenshot pass can still be added under the later visual QA/e2e tickets.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Registration raw IPC auth error removed | DONE | `account-auth-feedback.test.ts` covers raw IPC wrapper normalization for register refresh. |
| Registration pending state is clear | DONE | Register pending copy explains email verification and later sign-in. |
| Sign-in pending state remains distinct | DONE | Existing sign-in pending copy remains covered separately. |
| ROX ID panel is visually structured | DONE | `account-auth-panel.test.tsx` asserts ROX ID surface and account benefit anatomy. |
| Account request mapping unchanged | DONE | No main-process account route/proxy mapping changed. |
| Targeted account tests pass | DONE | Targeted auth tests and account settings tests passed. |
| Relevant validation passes | DONE | `typecheck:electron`, `validate:docs`, `lint:electron`, `diff --check`, and `electron:build` passed. |
| Worklog complete | DONE | This file records context, red output, implementation, validation, risks, and acceptance state. |
