# T185 - aria-invalid Validation States on Structured Input Fields

## 1. Task summary

Wire `aria-invalid` + `aria-errormessage` on all three form modes of `CredentialRequest.tsx` using a touched-on-blur pattern. Audit `PermissionRequest.tsx` and `AdminApprovalRequest.tsx`; document that neither requires wiring.

## 2. Repo context discovered

- `CredentialRequest.tsx` renders three editable form modes:
  1. Basic auth (username + password fields)
  2. Multi-header (repeating key/value pairs)
  3. Single credential (one value field)
- Prior to T185, the component had local validation logic (required-field checks) but no `aria-invalid`, `aria-errormessage`, or `aria-live` error regions. Errors were shown visually but were invisible to screen readers.
- `PermissionRequest.tsx`: renders Allow / Always Allow / Deny buttons. No text inputs, no validation. WCAG error identification does not apply.
- `AdminApprovalRequest.tsx`: renders a Switch toggle with an existing `aria-label`. No text inputs. No validation wiring needed.
- `React.useId()` is available in the React version used (18+). It provides stable IDs across renders without requiring a manual counter.
- `aria-errormessage` requires the referenced element to always exist in the DOM (even when empty) per ARIA 1.2 spec; a `<div role="status" aria-live="polite">` with an empty string when valid satisfies this requirement.
- Touched-on-blur pattern: per-field boolean state; set to `true` on the field's `onBlur` handler. Errors only shown when `touched && !!errorMessage`. This avoids showing errors on pristine fields, matching standard form UX.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/structured/CredentialRequest.tsx` — full review
- `apps/electron/src/renderer/components/app-shell/input/structured/PermissionRequest.tsx` — audit
- `apps/electron/src/renderer/components/app-shell/input/structured/AdminApprovalRequest.tsx` — audit
- `apps/electron/src/renderer/components/ui/` — Input, Label, Switch component shapes for prop types

## 4. Tests added first

DOM-bearing form interaction test deferred to T186. Pre-implementation:

- Audited `PermissionRequest.tsx` and `AdminApprovalRequest.tsx` to confirm no wiring scope.
- Verified `React.useId()` import chain and TypeScript satisfaction before implementation.

## 5. Expected failing test output

No bun:test failure mode for this change shape. The pre-fix axe-core run (T186) for a `CredentialRequest` with a touched invalid field would report:

```text
A11y violations found (1-2):
  • [moderate] aria-required-attr: Required ARIA attributes not present
    - aria-errormessage missing on input with aria-invalid="true"
  • [serious] aria-valid-attr-value: aria-errormessage references element that does not exist
    (if aria-errormessage present without matching id in DOM)
```

## 6. Implementation changes

**`apps/electron/src/renderer/components/app-shell/input/structured/CredentialRequest.tsx`** (+81 lines, -33 lines)

Pattern applied across all three form modes:

```tsx
// Per-field touched state
const [usernameTouched, setUsernameTouched] = useState(false)
// ...

// Stable error IDs
const baseId = React.useId()
const usernameErrorId = `${baseId}-username-error`
// ...

// Field wiring
<Input
  aria-invalid={usernameTouched && !!usernameError}
  aria-errormessage={usernameErrorId}
  onBlur={() => setUsernameTouched(true)}
  // ...
/>
<div
  id={usernameErrorId}
  role="status"
  aria-live="polite"
>
  {usernameTouched ? usernameError ?? '' : ''}
</div>
```

Key details:
- `aria-live="polite"` — error announced after current speech completes; does not interrupt.
- `role="status"` — redundant with `aria-live="polite"` but included for compatibility with older AT.
- Error div always present in DOM (empty string when no error); satisfies ARIA 1.2 `aria-errormessage` requirement.
- `aria-invalid` uses boolean coercion: `aria-invalid={touched && !!error}` — outputs `"true"` or `"false"` (not missing).

**`PermissionRequest.tsx`**: no changes. Documented: confirmation-only form, no validatable inputs.

**`AdminApprovalRequest.tsx`**: no changes. Documented: Switch toggle with existing aria-label; no text inputs.

## 7. Validation commands run

```bash
bun run typecheck:electron
bun run lint:electron
bun run validate:agent-contract
git diff --check
```

## 8. Passing test output summary

```text
bun run typecheck:electron
PASS

bun run lint:electron
PASS

bun run validate:agent-contract
[agent-contract] ok: 11 skills, 126 tickets, 7 required docs

git diff --check
PASS
```

## 9. Build output summary

No full build run for this change (no production bundle behavior changed beyond DOM structure). Typecheck is authoritative for type correctness.

## 10. Remaining risks

- **Async validation not wired.** The current implementation validates synchronously (local field-level checks). If `CredentialRequest` later acquires async validation (e.g., network round-trip to verify credentials), the touched-on-blur pattern will need to be augmented with a pending state and the error announcement should be deferred. Pillar 2 tests will lock in current synchronous behavior and serve as a regression gate.
- **Multi-header repeating fields.** The multi-header mode has a variable number of key/value pairs. Each pair receives a derived ID from `baseId` and its index. If pairs are reordered, the index-based IDs shift. This is acceptable (error relationships are per-render), but future dynamic reordering UX should audit whether this causes screen reader confusion.
- **Manual VoiceOver / NVDA verification.** The `aria-live="polite"` announcement timing and wording should be verified with a live screen reader after the next desktop build.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| All three `CredentialRequest` form modes have `aria-invalid` + `aria-errormessage` | PASS | `CredentialRequest.tsx` — basic auth, multi-header, single credential modes all wired |
| Errors only surface after field blur (touched-on-blur) | PASS | Per-field `touched` state set on `onBlur`; errors gated by `touched && !!error` |
| Error IDs stable via `React.useId()` | PASS | `baseId = React.useId()` with field-specific suffixes |
| `PermissionRequest` and `AdminApprovalRequest` audited — no wiring needed | PASS | Audit documented in §6 and commit message |
| Typecheck passes | PASS | `bun run typecheck:electron` |
| Lint passes | PASS | `bun run lint:electron` |
| Worklog complete | PASS | This document |
| Commit created | PASS | `dd589c2` — `feat(composer): aria-invalid + aria-errormessage on structured input fields [T185]` |
