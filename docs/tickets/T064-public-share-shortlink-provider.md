# T064 - Public Share Shortlink Provider

Status: DONE

## Goal

Make public session sharing explicit, testable, and safe by introducing a share provider contract between local session export and the public viewer/shortlink backend.

## Context

The current share flow calls the viewer upload endpoint directly from `SessionManager.shareToViewer()` and `updateShare()`. Failures are mapped better after T054, but the implementation still lacks a provider boundary, fake-provider contract tests, public URL validation, and a secret-sanitized upload bundle.

## Scope

- Add a `ShareProvider` contract for upload, shortlink creation, status, update, and revoke.
- Preserve the existing viewer API as the default provider.
- Add a deterministic fake provider for tests.
- Sanitize public share payloads before upload.
- Reject local/non-public shortlink URLs.
- Keep `SessionManager` persistence/event behavior unchanged.
- Keep tests free of real viewer/network calls.

## Acceptance Criteria

- [x] Provider contract exists and is covered by deterministic tests.
- [x] Share payload sanitizer removes obvious secret/session/auth fields recursively.
- [x] Localhost/file/local-only URLs cannot be accepted as public shortlinks.
- [x] `shareToViewer()` persists `sharedUrl`/`sharedId` only after upload and shortlink creation succeed.
- [x] `updateShare()` and `revokeShare()` go through the provider seam.
- [x] Auth, payload, and viewer failures remain specific/actionable.
- [x] Relevant targeted tests and validation commands pass.
- [x] Worklog complete.
- [x] Scoped commit created.
