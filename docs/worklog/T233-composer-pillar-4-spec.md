# T233 - Composer Pillar 4 Design Spec

## 1. Task summary

Author the Pillar 4 design spec for the composer polish series. Lock the
cluster scope (five sub-features), the surface boundary (the existing
`apps/electron/src/renderer/components/app-shell/input/` directory), the
per-sub-ticket discipline (pure helper + bun:test + RTL + axe + worklog +
ticket), and call out the first sub-ticket landing in the same PR (T234
composer history recall).

## 2. Repo context discovered

- The Phase 10 roadmap section names "composer" but the actual surface lives
  at `apps/electron/src/renderer/components/app-shell/input/`, not in a
  `composer/` subdirectory. Pillar 3 (T180..T199) all landed here and the
  PR title prefix in the master log uses "composer" as a shorthand.
- The Pillar 3 RTL harness depends on a careful per-test Radix stub strategy
  documented in T187's worklog (multi-copy `@radix-ui/react-context` issue
  under Bun's hoisted linker). Pillar 4 sub-tickets inherit this convention
  rather than redoing the harness.
- `working-directory-history.ts` is the closest existing precedent for a
  "pure helper + thin FreeFormInput integration + colocated bun:test"
  pattern. Composer history (T234) follows the same shape.
- `FreeFormInput.tsx` is ~3000 LOC. The `submitMessage` callback already
  consolidates the submit path and centralises every keyboard-driven send.
  Composer history can splice in cleanly at three points: after `onSubmit`,
  inside `handleKeyDown`, and inside the existing `sessionId` change effect.
- The roadmap goal lists six candidate Pillar 4 affordances but only asks
  for 4-6 in the spec. This spec picks five (emphasis, line numbers,
  paste-image dialog, composer history, voice-input slot) and defers the
  slash/mention dropdown polish to a future cycle because Pillar 3 already
  shipped its RTL coverage.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
- `apps/electron/src/renderer/components/app-shell/input/working-directory-history.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/working-directory-history.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.send.rtl.test.tsx`
- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md` (Phase 10)
- `docs/tickets/T187-freeform-input-rtl-coverage.md`
- `docs/tickets/T199-b4-dialog-a11y-audit.md`
- `docs/worklog/T187-freeform-input-rtl-coverage.md` (RTL stub patterns)
- `docs/worklog/T197-working-directory-badge-rtl-coverage.md` (Popover stub)
- `docs/superpowers/specs/2026-05-15-tenant-credential-key-derivation-design.md` (spec shape)

## 4. Tests added first

The spec ticket itself adds no tests beyond confirming `validate:rebrand`.
The first sub-ticket (T234) lands its own pure-function and RTL tests in
the same PR; see `docs/worklog/T234-composer-pillar-4-history.md`.

## 5. Expected failing test output

N/A — design-only ticket. The first sub-ticket's expected failing output is
captured in its worklog.

## 6. Implementation changes

Two artifacts:

- `docs/superpowers/specs/2026-05-13-composer-pillar-4-design.md` — the
  Pillar 4 design spec. Five sub-ticket candidates (T234 history, T235
  emphasis modes, T236 line numbers, T237 paste-image dialog, T238
  voice-input slot). Locked decisions: surface boundary, session-scoped
  state, helper-module pattern, keyboard shortcut helper, voice-input slot
  semantics.
- `docs/tickets/T233-composer-pillar-4-spec.md` — this ticket.

## 7. Validation commands run

```bash
bun run validate:rebrand
```

## 8. Passing test output summary

```text
$ bun run validate:rebrand
rebrand validation passed: no forbidden tokens outside the allowlist
```

## 9. Build output summary

No source changes. No build required.

## 10. Remaining risks

- The spec lists five Pillar 4 sub-tickets but only T234 lands in this PR.
  T235..T238 may need spec amendments if architect review surfaces
  surface-boundary concerns. The spec sections for each deferred ticket are
  intentionally short so they can be re-scoped before a future PR opens.
- The `FreeFormInput.tsx` size (~3000 LOC) means Pillar 4 sub-tickets risk
  scope creep into a "split FreeFormInput" refactor. The spec explicitly
  excludes that refactor as a non-goal.
- Voice-input ASR is deferred entirely. The slot semantics (registry +
  empty span by default) need a follow-up ADR before a real provider lands.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Pillar 4 design spec lives at the canonical path | PASS | `docs/superpowers/specs/2026-05-13-composer-pillar-4-design.md` |
| Spec lists 4 or more sub-ticket candidates | PASS | Five candidates listed (T234..T238) |
| Spec calls out input/ directory as surface boundary | PASS | Locked decisions §1 |
| Locked decisions section captures session scope, keyboard helper, axe, voice slot | PASS | Locked decisions §3, §4, §5, §6 |
| First sub-ticket (T234) named and rationalised in spec | PASS | "Sub-Feature Picked For This PR" section |
| `validate:rebrand` exit 0 | PASS | Output above |
| `.swarm/master-roadmap-log.md` not touched | PASS | Git diff confirms |
| Worklog complete | PASS | This file |
