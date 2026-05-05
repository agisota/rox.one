# T063 - Account Persistent Session Storage

Status: DONE

## Goal

Persist the desktop account session securely so the in-app account cabinet can
restore an authenticated `rox_session` after Electron restarts.

## Context

T054 fixed same-process account cookie continuity through the Electron main
process proxy, but the cookie still lives only in memory. After restart the
desktop account cabinet can fall back to `Authentication required` even after a
successful sign-in.

## Scope

- Add a narrow account session store contract for Electron main.
- Persist `rox_session` with Electron `safeStorage` under app `userData`.
- Hydrate the account proxy cookie before the first account/auth request.
- Clear persisted session on logout.
- Fail closed on corrupt or undecryptable session files.
- Keep tests deterministic with fake storage/encryption providers.

## Acceptance Criteria

- [x] Account cookie is saved after login/register response sets `rox_session`.
- [x] A new account proxy instance hydrates the saved cookie before `/api/account/me`.
- [x] Logout clears both in-memory and persisted cookie state.
- [x] Corrupt persisted session files are removed and do not authenticate.
- [x] Tests do not call real ROX API or real Electron `safeStorage`.
- [x] Worklog complete.
- [x] Scoped commit exists.
