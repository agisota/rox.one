# T018-usage-balance-ledger

## 1. Task summary

Add a minimal usage/balance ledger contract behind the account cabinet billing surface. The ticket file is a stub, so scope is derived from T017's explicit disabled billing defaults and the existing shared session token-usage tracking.

## 2. Repo context discovered

- `docs/tickets/T018-usage-balance-ledger.md` is TODO and contains only the standard task loop.
- `packages/shared/src/agent/core/usage-tracker.ts` tracks token usage per message/session but is not an account balance ledger.
- `packages/shared/src/sessions/types.ts` stores session `tokenUsage`, including `costUsd`, but does not provide account-level credits or debits.
- `packages/server-core/src/webui/account-cabinet.ts` currently returns a zero balance and disabled top-up default from T017.
- `packages/server-core/src/webui/http-server.ts` can expose account billing through `/api/account/billing` and `/api/account/billing/top-up-intent`.
- `packages/server-core/src/accounts/postgres-store.ts` has account/session/workspace ownership persistence only. It has no billing tables, so T018 should introduce a narrow ledger interface and fake/in-memory tests, not a production payment provider.

## 3. Files inspected

- `docs/tickets/T018-usage-balance-ledger.md`
- `packages/shared/src/agent/core/usage-tracker.ts`
- `packages/shared/src/agent/core/__tests__/usage-tracker.test.ts`
- `packages/shared/src/sessions/types.ts`
- `packages/server-core/src/webui/account-cabinet.ts`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/webui/__tests__/account-cabinet.test.ts`
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
- `packages/server-core/src/accounts/postgres-store.ts`

## 4. Tests added first

- Added `packages/server-core/src/webui/__tests__/account-ledger.test.ts` for:
  - ordered credits/debits with running balance;
  - per-user idempotency keys;
  - positive amount validation;
  - overdraft prevention;
  - defensive copies of ledger history.
- Extended `packages/server-core/src/webui/__tests__/account-http.test.ts` so `/api/account/billing` can read an injected fake ledger and never leak another user's balance entries.

## 5. Expected failing test output

Initial red run:

```text
bun test packages/server-core/src/webui/__tests__/account-ledger.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts
error: Cannot find module '../account-ledger'
0 pass
2 fail
2 errors
```

The failure was expected: the account usage ledger contract did not exist yet.

## 6. Implementation changes

- Added `packages/server-core/src/webui/account-ledger.ts`:
  - `AccountUsageLedger` interface;
  - `InMemoryAccountUsageLedger` fake/test adapter;
  - ledger entries with credit/debit, reason, metadata, idempotency key, running balance, and timestamp;
  - positive amount validation, overdraft rejection, and defensive-copy reads.
- Extended `packages/server-core/src/webui/account-cabinet.ts` with `createAccountCabinetBillingFromLedger()`.
- Extended `WebuiHandlerOptions` with optional `accountUsageLedger`.
- Updated `GET /api/account/billing` to use the injected ledger for the authenticated account only; default zero-balance behavior remains when no ledger is configured.

## 7. Validation commands run

- `bun test packages/server-core/src/webui/__tests__/account-ledger.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts` (red first, then green)
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `bun run validate:docs`
- `git diff --check`
- `bun run electron:build`

## 8. Passing test output summary

- T018 account ledger/account HTTP pack: `12 pass`, `0 fail`, `62 expect() calls`.
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

- `InMemoryAccountUsageLedger` is a fake/test adapter and process-local only. Persistent ledger tables or external billing reconciliation are not implemented in T018.
- No real payment provider/top-up flow is added; top-up remains disabled and explicit until a future payment integration task.
- Session usage is not yet automatically debited into the ledger; the ticket establishes the account-level ledger contract and billing read path.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Ledger records credits/debits deterministically | PASS | `account-ledger.test.ts` ordered entries and running balances |
| Ledger prevents negative balances | PASS | `AccountLedgerInsufficientBalanceError` test |
| Account billing endpoint uses injected ledger without cross-user reads | PASS | HTTP test with two users and isolated first-user entries |
| Top-up remains explicit/fake-provider safe | PASS | No payment provider or top-up mutation was added |
| Worklog, validation, commit, and push completed | Pending | Commit/push pending |
