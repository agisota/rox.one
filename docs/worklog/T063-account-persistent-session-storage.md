# T063 - Account Persistent Session Storage Worklog

## 1. Task summary

Persist the Electron desktop account session securely so the account cabinet can
restore `rox_session` after app restart.

## 2. Repo context discovered

- `apps/electron/src/main/account-api.ts` already proxies `/api/account*` and
  `/api/auth/*` requests to `https://rox.one`.
- T054 added in-memory `rox_session` continuity inside `createAccountApiProxy`.
- `apps/electron/src/main/index.ts` creates a singleton proxy before registering
  `ipcMain.handle('account:request', ...)`.
- `docs/worklog/T054-experience-navigation-account-share-fix.md` explicitly
  leaves cross-restart persistence as a follow-up risk.

## 3. Files inspected

- `apps/electron/src/main/account-api.ts`
- `apps/electron/src/main/__tests__/account-api.test.ts`
- `apps/electron/src/main/index.ts`
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx`
- `scripts/electron-smoke.ts`
- `scripts/__tests__/electron-smoke.test.ts`
- `packages/shared/src/config/paths.ts`
- `packages/server-core/src/bootstrap/headless-start.ts`
- `docs/worklog/T054-experience-navigation-account-share-fix.md`

## 4. Tests added first

- `apps/electron/src/main/__tests__/account-api.test.ts`
  - persists the account session cookie after login;
  - hydrates a persisted account session before the first account request;
  - clears persisted account session on logout.
- `apps/electron/src/main/__tests__/account-session-store.test.ts`
  - saves/loads encrypted account session payloads;
  - removes corrupt persisted sessions and fails closed;
  - does not persist when encryption is unavailable.
- `scripts/__tests__/electron-smoke.test.ts`
  - requires smoke Electron to launch with isolated `userData` and
    `CRAFT_CONFIG_DIR` runtime paths;
  - proves the smoke `userData` override is applied before the Electron
    single-instance lock.

## 5. Expected failing test output

`bun test apps/electron/src/main/__tests__/account-api.test.ts apps/electron/src/main/__tests__/account-session-store.test.ts`

- `Cannot find module '../account-session-store'`
- `Expected: "rox_session=session-token"; Received: null`
- hydrated first request sent `Cookie: undefined`
- persisted clear call list was empty

`bun test scripts/__tests__/electron-smoke.test.ts`

- `Expected to contain: "CRAFT_CONFIG_DIR"`

`bun run e2e:core`

- initially failed in `electron-startup-smoke` because an already-open ROX app
  held the server lock in `~/.rox/.server.lock`;
- failure text: `Another server instance is already running (PID 31934)`.

## 6. Implementation changes

- Added `apps/electron/src/main/account-session-store.ts` with a narrow
  `AccountSessionStore` contract and `SafeAccountSessionStorage` adapter.
- The store encrypts only the account cookie payload via injected
  safe-storage-compatible methods and writes it under Electron `userData`.
- Corrupt, invalid, or undecryptable persisted sessions fail closed by returning
  `null` and removing the unsafe file.
- `createAccountApiProxy` now accepts an optional `sessionStore`, hydrates it
  before the first account/auth request, persists `set-cookie` values that
  contain `rox_session`, and clears storage on logout.
- Electron main wires the account session store to
  `app.getPath('userData')/account-session.enc`.
- Electron headless smoke now uses isolated `CRAFT_SMOKE_USER_DATA_DIR` and
  `CRAFT_CONFIG_DIR` temp directories so RC smoke can run while a user-facing
  ROX instance remains open.

## 7. Validation commands run

- `bun test apps/electron/src/main/__tests__/account-api.test.ts apps/electron/src/main/__tests__/account-session-store.test.ts scripts/__tests__/electron-smoke.test.ts`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `bun run typecheck:electron`
- `bun run typecheck:all`
- `bun run lint:electron`
- `bun run electron:build:main`
- `bun run electron:build`
- `bun run electron:smoke`
- `bun run e2e:core`
- `git diff --check`
- `git diff --cached --check`

## 8. Passing test output summary

- Targeted T063 tests: 11 pass, 0 fail, 25 assertions.
- `validate:agent-contract`: ok, 11 skills, 64 tickets, 7 required docs.
- `validate:docs`: agent contract, architecture docs, and sync-v2 design passed.
- `typecheck:electron`: passed.
- `typecheck:all`: passed.
- `lint:electron`: 0 errors, 3 pre-existing React hook dependency warnings in
  renderer files outside the T063 change surface.
- `electron:smoke`: passed with startup markers
  `CRAFT_SERVER_URL=` and `App initialized successfully`.
- `e2e:core`: all 4 core scenarios passed, including
  `electron-startup-smoke`.
- `git diff --check` and `git diff --cached --check`: no whitespace errors.

## 9. Build output summary

- `electron:build:main`: passed; main process bundle verified.
- `electron:build`: passed; main, preload, renderer, resources, and assets built.
- Build warnings are existing bundle-size/deprecated Jotai Babel warnings from
  renderer build output, not T063 account-session failures.

## 10. Remaining risks

- Real rox.one production login/register was not exercised in tests; all tests
  use deterministic fake `fetch` and fake safe-storage providers.
- Electron `safeStorage` availability varies by OS/keychain state. The store
  intentionally fails closed and does not persist when encryption is
  unavailable.
- The stored cookie remains an auth secret. Do not expose it to renderer state,
  logs, public session shares, or audit exports.
- `lint:electron` still reports three pre-existing renderer hook dependency
  warnings unrelated to this task.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Cookie saved after login/register | DONE | `account api proxy > persists the account session cookie after login` |
| New proxy hydrates saved cookie before `/api/account/me` | DONE | `account api proxy > hydrates a persisted account session before the first account request` |
| Logout clears memory and persisted state | DONE | `account api proxy > clears persisted account session on logout` |
| Corrupt persisted session is removed and unauthenticated | DONE | `file account session store > removes corrupt persisted sessions and fails closed` |
| No real ROX API or real `safeStorage` in tests | DONE | tests inject fake `fetch` and fake safe-storage providers |
| Worklog complete | DONE | this file |
| Scoped commit exists | DONE | T063 Lore commit |
