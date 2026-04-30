# T017-user-account-cabinet

## 1. Task summary

Implement the minimal User Account Cabinet contract after T016 so the existing Account settings page can load account-adjacent cabinet data without falling through to missing HTTP routes. The ticket file is a stub, so the scope is derived from the current renderer page and account server surfaces.

## 2. Repo context discovered

- `docs/tickets/T017-user-account-cabinet.md` is TODO and contains only the standard loop.
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx` already renders an in-app account cabinet and calls `/api/account/me`, `/api/account/billing`, `/api/account/sessions`, `/api/account/events`, `/api/account/organizations`, `/api/account/billing/top-up-intent`, `/api/account/organizations`, and `/api/account/organizations/join`.
- `packages/server-core/src/webui/http-server.ts` already implements account auth, profile, password, email verification, and sessions, but not billing/events/organizations cabinet endpoints.
- `packages/server-core/src/accounts/types.ts` has the core account/session/store contract but no billing ledger or organization/team persistence. Those are future T018/T021 surfaces, so T017 should expose explicit disabled/empty defaults rather than fake production billing or team data.
- `apps/electron/src/renderer/pages/settings/account-brand-summary.ts` is a pure helper with existing tests; component-level account page tests are sparse.

## 3. Files inspected

- `docs/tickets/T017-user-account-cabinet.md`
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx`
- `apps/electron/src/renderer/pages/settings/account-brand-summary.ts`
- `apps/electron/src/renderer/pages/settings/__tests__/account-brand-summary.test.ts`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
- `packages/server-core/src/accounts/types.ts`
- `packages/server-core/src/accounts/index.ts`
- `packages/server-core/src/handlers/rpc/account-ownership.ts`

## 4. Tests added first

- Added `packages/server-core/src/webui/__tests__/account-http.test.ts` coverage for:
  - authenticated `/api/account/billing`, `/api/account/events`, and `/api/account/organizations`;
  - unauthenticated deny-by-default for account cabinet data and mutations;
  - explicit disabled top-up and unavailable organization create/join mutations.
- Added `packages/server-core/src/webui/__tests__/account-cabinet.test.ts` coverage for pure cabinet default helpers.

## 5. Expected failing test output

Initial red run:

```text
bun test packages/server-core/src/webui/__tests__/account-http.test.ts
Expected: 200
Received: 404
at packages/server-core/src/webui/__tests__/account-http.test.ts:365

Expected: 200
Received: 404
at packages/server-core/src/webui/__tests__/account-http.test.ts:439

5 pass
2 fail
38 expect() calls
```

The failure was expected: account cabinet endpoints for billing and top-up did not exist yet.

## 6. Implementation changes

- Added `packages/server-core/src/webui/account-cabinet.ts` with pure default builders for billing, events, organizations, and disabled top-up intent.
- Added a shared `requireAccountSession()` guard inside `packages/server-core/src/webui/http-server.ts`.
- Added account-protected endpoints:
  - `GET /api/account/billing`
  - `POST /api/account/billing/top-up-intent`
  - `GET /api/account/events`
  - `GET /api/account/organizations`
  - `POST /api/account/organizations`
  - `POST /api/account/organizations/join`
- Kept billing top-up disabled and organization mutations explicit `501` until T018/T021 add real ledger/team stores.

## 7. Validation commands run

- `bun test packages/server-core/src/webui/__tests__/account-http.test.ts` (red first, then green)
- `bun test packages/server-core/src/webui/__tests__/account-cabinet.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `bun run validate:docs`
- `git diff --check`
- `bun run electron:build`

Correction: `bun run typecheck:server-core` was tried first and failed because the repo has no such script. The package-local `cd packages/server-core && bun run tsc --noEmit` command is the actual server-core typecheck surface.

## 8. Passing test output summary

- Account cabinet test pack: `10 pass`, `0 fail`, `50 expect() calls`.
- Server-core TypeScript: passed with no diagnostics.
- Shared TypeScript: passed with no diagnostics.
- Electron TypeScript: passed with no diagnostics.
- Docs validation: `[agent-contract] ok: 11 skills, 41 tickets, 7 required docs`; `[architecture-docs] ok: 4 docs, 10 subsystem headings`.
- Diff whitespace check: passed.

## 9. Build output summary

- `bun run electron:build` passed.
- Build completed main, preload, renderer, resources, and asset copy.
- Existing Vite/Jotai deprecation/chunk-size warnings remained; no new build failure.

## 10. Remaining risks

- Billing and organizations are intentionally default/disabled in T017. Real usage ledger, balance mutation, invites, team membership, and audit history remain future T018/T021/T039 tasks.
- The account settings page has broad UI behavior but still lacks full component interaction tests; this ticket covered the server contract that the existing page already calls.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Authenticated cabinet endpoints return stable account data | PASS | `account-http.test.ts` covers billing/events/organizations with account cookie |
| Unauthenticated cabinet endpoints are deny-by-default | PASS | `account-http.test.ts` returns `401` for data and mutation endpoints without cookie |
| No fake billing/team production behavior is presented as configured | PASS | Top-up returns `status: disabled`; org create/join return `501` |
| Existing account auth/profile/session behavior remains intact | PASS | Existing account HTTP tests stayed green in the same file |
| Worklog, validation, commit, and push completed | Pending | Commit/push pending |
