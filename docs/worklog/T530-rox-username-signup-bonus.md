# T530 - ROX username registration and signup bonus

## 1. Task summary

Implement the next account-registration slice from the active goal: custom ROX
usernames that become `username@rox.one`, plus an idempotent 10 USDT starter
credit for newly registered users when the account usage ledger is present.

## 2. Repo context discovered

- `AccountAuthPanel` builds native `/api/auth/register` requests and currently
  uses a generic email field for registration.
- `/api/auth/register` in `packages/server-core/src/webui/http-server.ts`
  creates users, bootstraps the account, sends verification email, and returns
  without a session cookie until email verification.
- Account balances already flow through `AccountUsageLedger` and
  `createAccountCabinetBillingFromLedger`.
- If no `accountUsageLedger` is configured, account billing intentionally
  returns an explicit zero-balance manual state.

## 3. Files inspected

- `apps/electron/src/renderer/pages/settings/AccountAuthPanel.tsx`
- `apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/webui/account-ledger.ts`
- `packages/server-core/src/webui/account-cabinet.ts`
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
- `packages/shared/package.json`

## 4. Tests added first

- `packages/shared/src/account/__tests__/rox-username.test.ts`
  - normalizes handles and derives canonical `@rox.one` addresses
  - accepts/rejects the username character set
  - locks the 10 USDT starter balance constant at `10_000_000` ledger units
- `apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx`
  - registration request builder now expects username-derived
    `release_user@rox.one`
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
  - username-only `/api/auth/register` request creates
    `release_user@rox.one`
  - account ledger receives one `signup_bonus` credit for the new user

## 5. Expected failing test output

- Shared helper red:
  `Cannot find module '../index' from packages/shared/src/account/__tests__/rox-username.test.ts`.
- Account auth panel red:
  `TypeError: undefined is not an object (evaluating 'fields.email.trim')`.
- Account HTTP red:
  `Cannot find module '@rox-one/shared/account' from packages/server-core/src/webui/__tests__/account-http.test.ts`.

## 6. Implementation changes

- Added browser/server-safe shared account helpers at
  `@rox-one/shared/account`:
  - `ROX_ACCOUNT_DOMAIN`
  - `ROX_SIGNUP_BONUS_UNITS`
  - `normalizeRoxUsername`
  - `isValidRoxUsername`
  - `roxUsernameToEmail`
- Updated `AccountAuthPanel` so the register tab asks for `Юзернейм`, previews
  `username@rox.one`, and sends the derived email plus normalized username.
  Sign-in and password reset keep the existing email field.
- Updated `/api/auth/register` to accept `username`, derive the canonical
  `@rox.one` email, and keep email-based registration compatibility.
- Added an idempotent `signup_bonus` 10 USDT ledger credit when
  `accountUsageLedger` is configured; no fake bonus is returned when no ledger
  exists.
- Added an account event entry for the signup bonus when `accountEventHistory`
  is configured.

## 7. Validation commands run

- `bun test packages/shared/src/account/__tests__/rox-username.test.ts`
- `bun test apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx`
- `bun test packages/server-core/src/webui/__tests__/account-http.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `git diff --check`

## 8. Passing test output summary

- Shared account helper tests: 3 pass, 0 fail.
- Account auth panel tests: 3 pass, 0 fail.
- Account HTTP tests: 23 pass, 0 fail, 170 expect calls.
- Typecheck: passed.
- Lint: passed with the same 7 existing warnings in unrelated files:
  - `apps/electron/src/main/deep-link.ts:118`
  - `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx:1505`
  - `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.emphasis.rtl.test.tsx:45`
  - `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.history.rtl.test.tsx:50`
  - `apps/electron/src/renderer/pages/__tests__/ChatPage.rtl.test.tsx:36`
  - `apps/electron/src/renderer/pages/settings/settings-pages.ts:42`
  - `apps/electron/src/renderer/pages/settings/settings-pages.ts:65`
- Diff whitespace check: passed.

## 9. Build output summary

- `bun run build` passed.
- Existing build warnings remain:
  - Vite dynamic import warnings for Shiki language/theme specifiers
  - circular chunk warnings around `index-shared`, `i18n`, and `index-react`
  - chunk-size warnings for large renderer assets
- Electron build resources completed, including Session MCP server, Pi Agent
  server, SDK native binary staging, and renderer resource copy.

## 10. Remaining risks

- This slice uses `email` as the persistent unique account identifier and
  derives `username@rox.one` from the username. A dedicated persisted username
  column and mailbox/inbox implementation remain future slices.
- Starter credits are only recorded when `accountUsageLedger` exists. This
  preserves the current explicit no-ledger behavior but means local/dev account
  modes without the ledger still show the existing zero-balance manual state.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Shared helpers normalize and validate ROX usernames | Done | `rox-username.test.ts` |
| Registration request builder sends `username@rox.one` | Done | `account-auth-panel.test.tsx` |
| Hosted account API accepts username-only registration | Done | `account-http.test.ts` |
| New registered users receive one 10 USDT ledger credit with ledger configured | Done | `account-http.test.ts` |
| Existing email registration stays compatible | Done | Existing register test remains green |
| Tests pass | Done | Targeted tests, typecheck, lint |
| Build passes when applicable | Done | `bun run build` |
| Worklog complete | Done | This file |
| Commit created | Done | Lore commit for this T530 slice |
