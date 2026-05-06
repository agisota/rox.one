# T083 - ROX ID Account / Registration Production Fix

## 1. Task summary

Уточнить production-facing ROX ID account/registration feedback: UI должен различать pending verification, missing auth, invalid credentials, expired session, network/server errors и не показывать raw IPC text.

## 2. Repo context discovered

- `AccountAuthPanel` already renders Russian-first in-app ROX ID login/register/reset tabs and avoids browser account navigation.
- `AccountSettingsPage` already gates success on a confirmed `/api/account/me` refresh via `getAccountAuthSuccessMessage`.
- `createFileAccountSessionStore` is already wired through main-process `createAccountApiProxy` with Electron `safeStorage` where available.
- `account-auth-feedback.ts` strips the common Electron IPC prefix, but still returns raw server phrases like `Invalid credentials` and `Email verification required`.

## 3. Files inspected

- `apps/electron/src/renderer/pages/settings/AccountAuthPanel.tsx`
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx`
- `apps/electron/src/renderer/pages/settings/account-auth-feedback.ts`
- `apps/electron/src/renderer/pages/settings/__tests__/account-auth-feedback.test.ts`
- `apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx`
- `apps/electron/src/main/account-api.ts`
- `apps/electron/src/main/__tests__/account-api.test.ts`
- `packages/server-core/src/webui/http-server.ts`

## 4. Tests added first

- Extend `account-auth-feedback.test.ts` to require explicit UI-safe Russian messages for account/auth states and to ensure raw IPC prefixes never leak.

## 5. Expected failing test output

Red run target:

```text
Expected: "Неверный email или пароль."
Received: "Invalid credentials"
```

Observed red run:

```text
5 pass
2 fail
Expected: "Неверный email или пароль."
Received: "Invalid credentials"
```

## 6. Implementation changes

- Added explicit account/auth error classification in `account-auth-feedback.ts`.
- Mapped `auth_required`, `invalid_credentials`, `email_unverified`, `network_error`, `server_error`, `session_expired`, `forbidden`, and `disabled` to actionable Russian UI copy.
- Preserved pending refresh behavior for accepted login/register flows by classifying raw stripped errors before UI normalization.
- Kept registration success gated on confirmed account refresh; unconfirmed registration still shows the email verification pending message.
- Added tests proving Electron `account:request` IPC prefixes are removed before renderer copy.

## 7. Validation commands run

- `bun test apps/electron/src/renderer/pages/settings/__tests__/account-auth-feedback.test.ts`
- `bun test apps/electron/src/renderer/pages/settings/__tests__/account-auth-feedback.test.ts apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx apps/electron/src/main/__tests__/account-api.test.ts`
- `bun run typecheck:all`
- `bun run validate:docs`
- `bun run lint`
- `bun run electron:build`
- `git diff --check`

## 8. Passing test output summary

- Targeted account auth feedback test: included in combined account run.
- Combined account/auth/session run: `16 pass`, `0 fail`, `56 expect() calls`.
- Coverage includes native tabs, in-app auth request mapping, DV.net-only external URL allowlist, persisted encrypted session proxy behavior, logout clearing stored session, pending registration state, confirmed-login success gating, and UI-safe error normalization.

## 9. Build output summary

- `bun run typecheck:all`: pass.
- `bun run validate:docs`: pass.
- `bun run lint`: pass with three pre-existing React hook dependency warnings outside T083 scope.
- `bun run electron:build`: pass with pre-existing renderer chunk-size warnings.
- `git diff --check`: pass.

## 10. Remaining risks

- This ticket hardens feedback and session-truth handling around the existing embedded account surface. It does not add a new real production account backend beyond the existing `rox.one` account proxy seam.
- Full visual/manual account screen evidence remains for final RC documentation.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Registration pending is distinct from success | Pass | `account-auth-feedback.test.ts` |
| Login success requires confirmed session | Pass | `account-auth-feedback.test.ts` |
| Explicit account/auth error states | Pass | `account-auth-feedback.test.ts` |
| Raw IPC text hidden | Pass | `account-auth-feedback.test.ts` |
| No real account API calls in tests | Pass | Static helper and fake proxy tests |
| Worklog complete | Pass | This file |
| Commit exists | Pass | Scoped Lore commit for T083 |
