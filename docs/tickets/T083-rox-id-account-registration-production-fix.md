# T083 - ROX ID Account / Registration Production Fix

Status: IN PROGRESS

## Goal

Make ROX ID account and registration feedback truthful, polished, and safe for production-facing local use.

## Scope

- Normalize account/auth failures into explicit UI-safe states:
  - `auth_required`
  - `invalid_credentials`
  - `email_unverified`
  - `network_error`
  - `server_error`
  - `session_expired`
- Keep registration pending distinct from confirmed authenticated success.
- Strip raw Electron IPC prefixes from user-facing text.
- Preserve embedded in-app account UX and existing secure local session storage.
- No real account API calls in tests.

## Acceptance

- Registration pending does not show authenticated success.
- Login success requires confirmed `/api/account/me` session.
- Account errors render as actionable Russian copy.
- Logout/session storage tests remain green.
- No raw IPC error text reaches account UI helpers.
- Worklog records red/green/verify evidence.
- Scoped commit exists.
