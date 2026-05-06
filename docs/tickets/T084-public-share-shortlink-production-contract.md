# T084 - Public Share / Shortlink Production Contract

Status: DONE

## Goal

Make session sharing honest and provider-backed across the server contract and
renderer feedback path.

## Scope

- Keep share/upload/shortlink/revoke behind `ShareProvider`.
- Add an explicit share status command for UI verification.
- Keep fake provider deterministic in tests.
- Redact public payloads before upload.
- Reject local or private shortlink URLs.
- Add renderer share flow state mapping for:
  - `idle`
  - `auth_required`
  - `preparing`
  - `uploading`
  - `creating_link`
  - `copied`
  - `failed_retryable`
  - `failed_permanent`
  - `revoked`
- Do not call real viewer, shortlink, account, or network providers in tests.

## Acceptance Criteria

- [x] `ShareProvider` exposes upload, shortlink, status, and revoke.
- [x] Fake provider tests cover status and revoke lifecycle.
- [x] Public payload tests prove secret/session/token redaction.
- [x] Shortlink tests reject local/private URLs.
- [x] Session command can query share status.
- [x] Renderer share flow states are deterministic and user-safe.
- [x] Worklog complete.
- [x] Scoped Lore commit created.
