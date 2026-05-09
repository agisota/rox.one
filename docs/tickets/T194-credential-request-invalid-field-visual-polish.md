# T194 - CredentialRequest Invalid Field Visual Polish

Status: DONE

## Context

`CredentialRequest` presents input fields for user credentials. T185 wired `aria-invalid` onto these fields and added error `<div role="status" className="text-destructive">` messages. However, the inputs lacked visual-level styling to reinforce the invalid state: no border change, no background tint, no ring-color adjustment. A user looking at an invalid field could not tell it was invalid from visual cues alone — the error message was present but disconnected from the field.

## Goal

Apply Tailwind classes that react to the `aria-invalid` attribute on all 4 inputs in `CredentialRequest`. No JSX logic changes — pure className additions. The `aria-invalid` attribute is already set correctly by T185; this ticket only adds the visual mapping.

## Required UI

The following Tailwind variants are added to each input's `className`:

- `aria-invalid:border-destructive` — destructive border when invalid.
- `aria-invalid:bg-destructive/5` — light destructive background tint when invalid.
- `aria-invalid:focus-visible:ring-destructive/20` — destructive focus ring when invalid and focused.

4 inputs in `CredentialRequest` receive these classes. Error `<div role="status">` already has `text-destructive` from T185; no change needed there.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Not applicable. Pure className changes with no behavioral delta. Visual regression testing is manual; the `aria-invalid` state itself is already tested by T185's existing coverage.

## Implementation Requirements

- `apps/electron/src/renderer/components/app-shell/input/CredentialRequest.tsx`:
  - All 4 `<input>` elements: append `aria-invalid:border-destructive aria-invalid:bg-destructive/5 aria-invalid:focus-visible:ring-destructive/20` to each existing `className` string.
  - No other changes.

## Validation Commands

- `bun run typecheck:electron`

## Acceptance Criteria

- [x] All 4 `CredentialRequest` inputs have `aria-invalid:border-destructive`.
- [x] All 4 inputs have `aria-invalid:bg-destructive/5`.
- [x] All 4 inputs have `aria-invalid:focus-visible:ring-destructive/20`.
- [x] Error `<div role="status">` unchanged from T185.
- [x] No JSX logic changes (pure className additions).
- [x] Typecheck passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T194-credential-request-invalid-field-visual-polish.md`.
