# T185 - aria-invalid Validation States on Structured Input Fields

Status: DONE

## Context

The composer's structured input panel includes `CredentialRequest.tsx`, `PermissionRequest.tsx`, and `AdminApprovalRequest.tsx`. `CredentialRequest` has three editable form modes (basic auth username/password, multi-header, single credential) with local validation, but no `aria-invalid` or `aria-errormessage` wiring. Screen readers had no mechanism to announce validation errors. WCAG 2.1 SC 3.3.1 (Error Identification) and SC 3.3.3 (Error Suggestion) require programmatically determined error states.

## Goal

Wire `aria-invalid` + `aria-errormessage` on all editable fields in `CredentialRequest.tsx` using a touched-on-blur pattern (errors surface only after the user has left the field). Use `React.useId()` for stable error element IDs. Audit `PermissionRequest.tsx` and `AdminApprovalRequest.tsx`; document findings.

## Required UI

- Each validatable field in `CredentialRequest` has `aria-invalid="true"` when touched and invalid.
- A co-located `<div role="status" aria-live="polite">` with a stable ID holds the error text.
- `aria-errormessage={errorId}` links the field to its error container.
- Errors do not appear until the user has blurred the field (touched-on-blur).

## Required Data/API

None — local validation only. No async validation.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Self-test deferred to T186. Validated by:
- typecheck confirming React.useId() and aria prop types
- lint confirming no regressions
- Audit documentation for PermissionRequest and AdminApprovalRequest confirms no wiring needed

## Implementation Requirements

- `apps/electron/src/renderer/components/app-shell/input/structured/CredentialRequest.tsx`:
  - Add per-field `touched` state (boolean, set `true` on `onBlur`).
  - Add `React.useId()` derived IDs for error containers.
  - Add `<div role="status" aria-live="polite" id={errorId}>` adjacent to each field.
  - Add `aria-invalid={touched && !!error}` and `aria-errormessage={errorId}` to each field.
- `PermissionRequest.tsx`: no editable fields; confirmation-only form (Allow/Always Allow/Deny buttons). No changes needed.
- `AdminApprovalRequest.tsx`: Switch toggle has aria-label; no text inputs with validation. No changes needed.

## Validation Commands

- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run validate:agent-contract`

## Acceptance Criteria

- [x] All three `CredentialRequest` form modes have `aria-invalid` + `aria-errormessage` wiring.
- [x] Errors only surface after field blur (touched-on-blur pattern).
- [x] Error IDs stable via `React.useId()`.
- [x] `PermissionRequest` and `AdminApprovalRequest` audited and documented as not needing wiring.
- [x] Typecheck and lint pass.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T185-aria-invalid-validation.md`.
