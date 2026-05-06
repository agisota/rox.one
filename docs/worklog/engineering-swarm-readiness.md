# Engineering Swarm Readiness

## 1. Task summary

Prepare the local ROX.ONE / Rox Agents monorepo for disciplined next-step work by:

- reading the repository operating contract;
- inspecting the root package/task surface;
- checking current git state;
- inspecting ticket and worklog backlogs;
- identifying the most relevant pending implementation slice;
- recording a readiness worklog before any feature/refactor/test changes.

## 2. Repo context discovered

- Repository root: `/Users/marklindgreen/Projects/rox/rox`
- Runtime/package manager: Bun
- Repo shape: monorepo with `packages/*` and `apps/*`
- Branch: `mac/rox-production-ready-rc`
- Current product snapshot documents T074-T087 as committed/validated, with T088/T089 continuing runtime hardening.
- Operating contract from `AGENTS.md` requires:
  - work from `docs/tickets/*.md`;
  - inspect context first;
  - write/update matching worklog before tests/implementation;
  - write tests/validation before feature code;
  - do not silently skip tests;
  - preserve existing Rox/ROX behavior unless explicitly changed.
- The integration truth model documented in release docs is:
  `UI action -> typed event -> deterministic reducer -> replayable runtime state -> persistence seam -> provider/scheduler/share seam -> evidence -> metrics/quests/ledger/UI projection`.

## 3. Files inspected

- `AGENTS.md`
- `package.json`
- `README.md`
- `docs/tickets/README.md`
- `docs/worklog/README.md`
- `docs/architecture/repo-map.md`
- `docs/validation/baseline-commands.md`
- `docs/release/current-state-snapshot-2026-05-06.md`
- `docs/tickets/T087-final-product-rc-documentation-build.md`
- `docs/tickets/T088-mission-runtime-lifecycle-contract.md`
- `docs/tickets/T089-runtime-module-depth-and-action-seams.md`
- `docs/worklog/T088-mission-runtime-lifecycle-contract.md`
- `docs/worklog/T089-runtime-module-depth-and-action-seams.md`

## 4. Current git status summary

Observed from `git status --short`:

- modified: `events.jsonl`
- untracked: `.claude/`

These are explicitly called out by ticket/release docs as local runtime artifacts that must not be staged with task work.

## 5. Candidate tasks/tickets found

### Candidate A: `T089-runtime-module-depth-and-action-seams`

Why it is relevant:

- latest commit message matches this area: `Deepen runtime action seams before production adapters`;
- ticket status is still `In progress`;
- worklog already records implementation and validation evidence, so the repo may contain finished code with ticket-status/docs cleanup still pending, or follow-up verification may still be needed.

### Candidate B: `T088-mission-runtime-lifecycle-contract`

Why it is relevant:

- ticket status is still `IN PROGRESS`;
- worklog shows substantial completed implementation and validation evidence;
- likely needs canonical ticket-status closure and/or verification against current tree.

### Candidate C: readiness follow-up on unresolved broad-suite blockers

Why it is relevant:

- both T088 and T089 worklogs record unrelated full-suite failures/blockers;
- smallest safe quality-improvement slice could be to pick one of those blockers and resolve it with focused TDD, if that blocker is promoted to an explicit ticket.

## 6. Recommended first implementation slice

Because there are **multiple plausible active tickets** (`T088` and `T089`) and both appear partially documented as completed in worklogs while still marked in-progress in ticket files, the safest next step is:

1. choose the canonical active ticket to continue/close first;
2. verify its current tree state against the worklog evidence;
3. only then proceed with focused Codebase Analyst inspection for that ticket.

If forced to rank by immediacy, `T089` is the most relevant candidate because:

- it is the latest runtime-hardening ticket;
- the most recent commit appears to correspond to it;
- it directly improves refactorability and seam safety for future work.

## 7. Test/validation plan

For readiness itself:

- no code behavior changes made;
- no test run required yet.

For the next selected ticket:

1. inspect exact changed surfaces named in the ticket/worklog;
2. identify existing focused tests beside those surfaces;
3. run only targeted tests first;
4. broaden to typecheck/lint/build only after confirming concrete local changes;
5. avoid broad expensive validation before a concrete change.

Likely focused commands for the runtime-hardening path:

- targeted `bun test` on affected shared/electron/server-core test files;
- `bun run typecheck:all` after code changes;
- `bun run lint` if renderer/shared/ui/server-core surfaces are touched;
- `bun run electron:build` only if runtime/UI source changes require build verification.

## 8. Risks

- Ticket status and worklog state are slightly inconsistent: `T088` and `T089` are marked in progress while worklogs read as substantially complete.
- The working tree already contains unrelated local artifacts (`events.jsonl`, `.claude/`).
- Broad full-suite failures recorded in prior worklogs may be unrelated to the next narrow slice, so they must not be misattributed.
- Starting implementation without selecting the canonical ticket would risk mixing docs cleanup, verification, and new code changes.

## 9. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Read AGENTS contract | Pass | `AGENTS.md` inspected |
| Read root task surface | Pass | `package.json`, `README.md` inspected |
| Checked current git state | Pass | `git status --short` recorded |
| Inspected `docs/tickets/` | Pass | ticket inventory reviewed |
| Inspected `docs/worklog/` | Pass | worklog inventory reviewed |
| Identified relevant pending work | Pass | T088/T089 + blocker follow-up candidates recorded |
| Created readiness worklog | Pass | `docs/worklog/engineering-swarm-readiness.md` |
| Proceed without guessing | Pass | stopping for user choice because multiple plausible tickets exist |



## 10. Autonomous program decisions

- Decision: continue autonomously instead of pausing for ticket selection.
- Default active ticket chosen from repo evidence: `T089-runtime-module-depth-and-action-seams`.
- After verifying T089, the next mandatory reconciliation order is:
  1. verify/close `T088-mission-runtime-lifecycle-contract`;
  2. reconcile release docs against actual validation evidence;
  3. promote and fix the highest-impact real validation blocker as an explicit
     follow-up ticket (`T090-isolated-home-validation-hardening`).
- Highest-leverage production-readiness risk reduced in this run: fresh/isolated
  HOME startup assumptions that made validation evidence internally
  inconsistent.
- Program rule for next passes: prefer evidence integrity and repeatable clean-
  environment validation over cosmetic backlog cleanup.
