# T437 - R.11 R.9.5 closeout preflight coverage

Status: DONE
Phase: R.11 report-only preflight hardening
Ticket: docs/tickets/T437-r11-r95-closeout-preflight.md

## 1. Task summary

Restore R.9.5 ticket/worklog closeout evidence and make the R.11 preflight
verify those suffixed tickets before any destructive history rewrite path can
start.

## 2. Repo context discovered

The R.11 helper's `REBRAND_R0_R10_TICKET_PATHS` list currently checks
T260-T297, but it does not check the R.9.5 suffixed tickets. Current repo
evidence says the actual R.9.5 closeout artifacts are T298a and T300a:

- `docs/worklog/T296-rebrand-sweep-closeout.md` records R.9.5 as
  `T298a, T300a`.
- `docs/release/rebrand-mapping-2026-05-13.md` records R.9.5 as
  `T298a,T300a`.
- `git log --all -- docs/tickets/T299a* docs/worklog/T299a*` returned no
  history, so there is no current evidence for creating a T299a artifact.

The two existing R.9.5 tickets lack `Status: DONE` and matching worklogs even
though later closeout evidence records the phase as landed.

## 3. Files inspected

- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `docs/tickets/T298a-rebrand-allowlist-expansion.md`
- `docs/tickets/T300a-rebrand-agents-md-and-misc.md`
- `docs/worklog/T296-rebrand-sweep-closeout.md`
- `docs/release/rebrand-mapping-2026-05-13.md`
- `.swarm/master-roadmap-log.md`

## 4. Tests added first

- `scripts/__tests__/rebrand-r11-preflight.test.ts` now requires
  `scripts/rebrand-r11-preflight.ts` to include the T298a/T300a R.9.5 ticket
  paths and to avoid a nonexistent T299a ticket path.
- The same test requires T298a/T300a tickets to be `Status: DONE` and to have
  matching 11-section worklogs.

## 5. Expected failing test output

The RED run failed for the intended closeout coverage gaps:

```text
Expected to contain: "docs/tickets/T298a-rebrand-allowlist-expansion.md"
Expected: true
Received: false
```

## 6. Implementation changes

- Added T298a and T300a to `REBRAND_R0_R10_TICKET_PATHS` in
  `scripts/rebrand-r11-preflight.ts`.
- Updated the preflight closeout success message to say the R.9.5 suffixed
  tickets are included.
- Added `Status: DONE` to the T298a/T300a ticket files.
- Added retrospective 11-section worklogs for T298a and T300a using existing
  T296 closeout, rebrand mapping, and git history evidence.
- Updated the durable R.11 completion audit and T298 worklog to mention the
  R.9.5 suffixed ticket coverage.
- Did not create a T299a artifact; `git log --all -- docs/tickets/T299a*
  docs/worklog/T299a*` returned no history, and current closeout artifacts name
  the actual pair as T298a/T300a.
- Did not mutate tags, create backup artifacts, create an offline mirror, run
  `git filter-repo`, force-push, or clean branches.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`

## 8. Passing test output summary

- R.11 preflight regression: `23 pass`, `0 fail`, `104 expect() calls`.
- R.11 completion audit regression: `14 pass`, `0 fail`, `138 expect() calls`.
- Typecheck: exit 0.
- Lint: exit 0 with 7 existing warnings.
- Docs validation: exit 0; agent-contract reported `402 tickets` and `7
  required docs`; architecture docs and sync-v2 design validators passed.
- Rebrand validation: exit 0; no forbidden tokens outside the allowlist.
- `git diff --check`: exit 0 with no output.
- Uncommitted preflight run shows `rebrand-closeouts` passing with the hardened
  T298a/T300a coverage; it remains red only on known blockers plus the expected
  temporary `worktree-clean` failure from this in-progress ticket.

## 9. Build output summary

No build expected for this report-only script/documentation hardening. No
runtime source behavior changes are planned.

## 10. Remaining risks

R.11 remains blocked by hard prerequisites. This ticket does not authorize tag
mutation, backup artifact creation, offline mirror creation, `git filter-repo`,
force-push, or branch cleanup.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED assertions fail before implementation | Green | Initial target run failed on missing helper paths and missing worklogs |
| R.11 preflight closeout list includes T298a and T300a | Green | `scripts/rebrand-r11-preflight.ts` includes both paths |
| T298a and T300a tickets are `Status: DONE` | Green | Both ticket files now carry `Status: DONE` |
| T298a and T300a worklogs exist with 11 sections | Green | Both matching worklogs now exist |
| Targeted tests and docs validators pass | Green | Targeted tests, docs validation, rebrand validation, and diff check passed |
| No destructive R.11 action is performed | Green | No tag mutation, backup creation, mirror creation, filter-repo, force-push, or branch cleanup was run |
