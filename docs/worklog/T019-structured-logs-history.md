# T019 Structured Logs / History

## 1. Task summary

Add a structured account event history contract behind the existing account cabinet events endpoint.

## 2. Repo context discovered

- `docs/tickets/T019-structured-logs-history.md` is a stub ticket, so scope is derived from existing product seams.
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx` already renders `Логи и события` and calls `GET /api/account/events`.
- T017 added protected cabinet defaults; `/api/account/events` currently returns `{ events: [] }` for every authenticated user.
- `packages/shared/src/automations/history-store.ts` owns automation JSONL history, but that is workspace automation history, not account/user cabinet event history.
- `packages/server-core/src/services/privileged-execution-broker.ts` writes a privileged-action JSONL audit log, but mixing it into account cabinet history would need persistence/lifecycle policy and belongs closer to the audit-trail ticket.

## 3. Files inspected

- `docs/tickets/T019-structured-logs-history.md`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/webui/account-cabinet.ts`
- `packages/server-core/src/webui/account-ledger.ts`
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
- `packages/shared/src/automations/history-store.ts`
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx`

## 4. Tests added first

- `packages/server-core/src/webui/__tests__/account-events.test.ts`
- Extended `packages/server-core/src/webui/__tests__/account-http.test.ts`

## 5. Expected failing test output

`bun test packages/server-core/src/webui/__tests__/account-events.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`

Expected red result:

```text
error: Cannot find module '../account-events'
0 pass
2 fail
2 errors
```

## 6. Implementation changes

- Added `packages/server-core/src/webui/account-events.ts` with:
  - `AccountEventHistory` interface.
  - `InMemoryAccountEventHistory` fake/test adapter.
  - recursive details sanitizer for token, secret, password, API key, authorization, and cookie-like keys.
  - newest-first per-user listing with defensive copies.
- Added cabinet conversion that exposes only `{ id, type, title, details, createdAt }`, not `userId`.
- Added optional `accountEventHistory` injection to `createWebuiHandler()`.
- Wired `GET /api/account/events` to list events for the authenticated user when history is injected, preserving empty defaults otherwise.

## 7. Validation commands run

- `bun test packages/server-core/src/webui/__tests__/account-events.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `bun run validate:docs`
- `git diff --check`
- `bun run electron:build`

## 8. Passing test output summary

- Targeted account tests: `12 pass`, `0 fail`, `67 expect() calls`.
- Server-core typecheck passed.
- Shared typecheck passed.
- Electron typecheck passed.
- Docs validation passed: `11 skills`, `41 tickets`, `7 required docs`, `4 docs`, `10 subsystem headings`.
- Diff whitespace check passed.

## 9. Build output summary

`bun run electron:build` passed:

- main process bundle built and verified.
- preload builds built and verified.
- renderer Vite build completed.
- resources and assets copied.
- Existing Vite chunk-size warnings remain; no T019-specific build failure.

## 10. Remaining risks

- `InMemoryAccountEventHistory` is process-local and intended as a fake/test adapter until durable audit/history storage is designed.
- Event history is not yet automatically populated from every auth, billing, or automation action.
- Privileged-action JSONL and automation JSONL histories remain separate; unified audit retention belongs to the observability/audit ticket.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Account events are structured and deterministic | PASS | `account-events.test.ts` asserts newest-first structured records. |
| Event details do not leak common secrets | PASS | Recursive redaction test covers token/API key/authorization/password/cookie/secret. |
| `/api/account/events` is authenticated | PASS | Existing cabinet auth test still asserts unauthenticated 401. |
| `/api/account/events` returns only current-user events | PASS | HTTP test injects two users and verifies no cross-user event/title exposure. |
| No runtime log files or unrelated local state are committed | PASS | Staging limited to T019 server/worklog/test files; pre-existing `events.jsonl` remains unstaged. |
