# T530 - ROX username registration and signup bonus

Status: DONE

## Context

The account cabinet already has native login/register/reset flows and a usage
ledger for balances, but registration still asks for a generic email and new
users do not receive a starter balance. The active goal asks for registration
to become the main account entry, with custom `username@rox.one` identities and
starter credits for new users.

## Goal

Add the first account-registration product slice:

- Let users register with a custom ROX username that maps to
  `username@rox.one`.
- Keep login/reset compatible with email input.
- Credit new registered users with 10 USDT when the hosted account ledger is
  configured.

## Required UI

- Registration tab asks for a custom username instead of a generic email.
- Registration preview shows the resulting `@rox.one` address.
- Sign-in and password reset still use the existing email field.

## Required Data/API

- Add shared username normalization and validation helpers.
- Accept `username` on `/api/auth/register` and derive the canonical email from
  it.
- Keep existing email-based registration request compatibility.
- Record an idempotent `signup_bonus` credit for new users when
  `accountUsageLedger` is provided.
- Do not fake a bonus balance when no ledger exists.

## TDD Requirements

Before implementation:

1. Add shared username helper tests.
2. Add account auth panel request-building coverage for username registration.
3. Add hosted account HTTP coverage proving username registration credits the
   signup bonus into the account ledger.
4. Run the targeted tests and capture the expected failures.

## Validation Commands

- `bun test packages/shared/src/account/__tests__/rox-username.test.ts`
- `bun test apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx`
- `bun test packages/server-core/src/webui/__tests__/account-http.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `git diff --check`

## Acceptance Criteria

- [ ] Shared helpers normalize and validate ROX usernames.
- [ ] Registration request builder sends `username@rox.one`.
- [ ] Hosted account API accepts username-only registration.
- [ ] New registered users receive one 10 USDT ledger credit when a ledger is
  configured.
- [ ] Existing email registration stays compatible.
- [ ] Tests pass.
- [ ] Build passes when applicable.
- [ ] Worklog complete.
- [ ] Commit created.

## Worklog

Update `docs/worklog/T530-rox-username-signup-bonus.md`.
