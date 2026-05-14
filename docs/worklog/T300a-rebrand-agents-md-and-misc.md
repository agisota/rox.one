# T300a - AGENTS.md voice and builtin-sources alias

Status: DONE
Phase: R.9.5 final literal-text scrub
Ticket: docs/tickets/T300a-rebrand-agents-md-and-misc.md

## 1. Task summary

Restore the standard worklog surface for the historical R.9.5 final literal
text scrub ticket. The implementation itself landed earlier; this worklog
records the evidence needed by the R.11 closeout preflight.

## 2. Repo context discovered

T300a fixed the final R.9.5 literal-text misses after the T298a allowlist
expansion. Current durable evidence records T300a as part of R.9.5:

- `docs/release/rebrand-mapping-2026-05-13.md` records R.9.5 as
  `T298a,T300a`.
- `docs/worklog/T296-rebrand-sweep-closeout.md` records R.9.5 as
  `T298a, T300a` and says `validate:rebrand` reached exit 0 after the phase.
- `git log --all -- docs/tickets/T300a-rebrand-agents-md-and-misc.md` shows
  the historical T300a commit lineage, including `b3f7f7ac`.

## 3. Files inspected

- `docs/tickets/T300a-rebrand-agents-md-and-misc.md`
- `docs/worklog/T296-rebrand-sweep-closeout.md`
- `docs/release/rebrand-mapping-2026-05-13.md`
- `AGENTS.md`
- `packages/shared/src/sources/builtin-sources.ts`
- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`

## 4. Tests added first

T437 added regression coverage in
`scripts/__tests__/rebrand-r11-preflight.test.ts` requiring the R.11 preflight
closeout list to include T300a and requiring this worklog to exist with the
standard 11-section shape.

## 5. Expected failing test output

Before restoration, the RED run failed because the R.11 preflight source lacked
`docs/tickets/T300a-rebrand-agents-md-and-misc.md` and this worklog was
missing:

```text
Expected to contain: "docs/tickets/T300a-rebrand-agents-md-and-misc.md"
Expected: true
Received: false
```

## 6. Implementation changes

- Restored a standard `Status: DONE` line to the T300a ticket.
- Added this 11-section retrospective worklog.
- Added T300a to the R.11 closeout preflight ticket list in
  `scripts/rebrand-r11-preflight.ts`.
- Did not change AGENTS.md, builtin source behavior, or the rebrand allowlist
  in this restoration ticket.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

- R.11 preflight regression: `23 pass`, `0 fail`, `104 expect() calls`.
- R.11 completion audit regression: `14 pass`, `0 fail`, `138 expect() calls`.
- Typecheck: exit 0.
- Lint: exit 0 with 7 existing warnings.
- Docs validation: exit 0; agent-contract reported `402 tickets` and `7
  required docs`; architecture docs and sync-v2 design validators passed.
- Rebrand validation: exit 0; no forbidden tokens outside the allowlist.
- `git diff --check`: exit 0 with no output.

## 9. Build output summary

No build is required for this retrospective worklog restoration. The original
R.9.5 runtime/script behavior remains governed by the existing R.10 closeout
evidence and current `validate:rebrand` gate.

## 10. Remaining risks

This worklog is retrospective. It does not authorize R.11 destructive actions;
R.11 remains blocked until the report-only preflight is green and the operator
clears the destructive window.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Worklog exists with 11 sections | Green | This file restores the missing worklog |
| Ticket carries `Status: DONE` | Green | `docs/tickets/T300a-rebrand-agents-md-and-misc.md` now has `Status: DONE` |
| R.11 preflight checks T300a | Green | `scripts/rebrand-r11-preflight.ts` includes the T300a ticket path |
| Rebrand gate remains green | Green | `bun run validate:rebrand` exits 0 |
| No destructive R.11 action is performed | Green | No tag mutation, backup creation, mirror creation, filter-repo, force-push, or branch cleanup was run |
