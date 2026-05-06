# T073 - ROX ID Registration Screen

Status: DONE

## Goal

Make the embedded ROX ID registration/sign-in surface usable, polished, and semantically correct.

## Context

The account backend intentionally does not issue an authenticated session cookie during `/api/auth/register`
until email verification completes. The desktop UI currently runs `/api/account/me` immediately after
registration and can surface the resulting `Authentication required` as a raw red IPC error.

## Scope

- Keep account UX embedded in ROX ONE.
- Preserve backend email-verification semantics.
- Replace raw IPC/auth refresh text with a clear registration-pending state.
- Redesign the unauthenticated account screen into a product-grade ROX ID panel.
- Keep external navigation limited to approved checkout URLs.
- Add tests before implementation.

## Acceptance Criteria

- [x] Registration no longer displays raw `Error invoking remote method ... Authentication required`.
- [x] Registration pending state explains email verification/sign-in.
- [x] Sign-in pending state remains distinct from registration pending state.
- [x] Account auth panel renders a polished ROX ID surface with visible account benefits.
- [x] Existing account API request mapping stays unchanged.
- [x] Targeted account tests pass.
- [x] Relevant typecheck/build/docs validation passes or blockers are documented.
- [x] Worklog complete.
