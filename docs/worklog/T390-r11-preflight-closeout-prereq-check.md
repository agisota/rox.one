# T390 - R.11 preflight closeout prerequisite check

Status: DONE
Phase: R.11 preflight hardening
Ticket: docs/tickets/T390-r11-preflight-closeout-prereq-check.md

## 1. Task summary

Add machine-verifiable closeout prerequisite rows to the report-only R.11
preflight before any destructive backup or history rewrite work can begin.

## 2. Repo context discovered

R.11 is currently blocked before backup creation because the active Codex
`/goal` still exists. The latest post-push preflight is otherwise green in
pre-backup mode, and `pre-rewrite` mode remains blocked on the backup tag,
backup branch, and offline mirror only when the active-goal acknowledgement is
simulated.

The R.11 hard prerequisites also name three local conditions that the preflight
can verify directly:

- R.0 through R.10 rebrand ticket/worklog closeouts are present and done.
- T223 C4 follow-ups closeout is done.
- T229 RBAC integration closeout is done.

Ticket numbers are not globally unique by intent in this repo; exact paths are
required because unrelated tickets share numbers such as T270-T273 and T280.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `.swarm/master-roadmap-log.md`
- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `docs/tickets/T223-c4-followups-closeout.md`
- `docs/tickets/T229-rbac-integration-tests.md`
- `docs/tickets/T260-rebrand-canonical-decision-adr.md`
- `docs/tickets/T297-rebrand-prepush-hook-and-ci-gate.md`

## 4. Tests added first

Added `scripts/__tests__/rebrand-r11-preflight.test.ts` coverage before
implementation. The new regression test asserts missing or not-done closeouts
produce distinct preflight failures for:

- `rebrand-closeouts`;
- `phase1-closeout`;
- `phase2-rbac-closeout`.

## 5. Expected failing test output

RED run:

```text
Expected: false
Received: true

(fail) evaluateR11Preflight > fails closed when rebrand and roadmap closeout prerequisites are incomplete

Expected length: 12
Received length: 9

(fail) evaluateR11Preflight > reports every blocker instead of stopping after the first red check

9 pass
2 fail
27 expect() calls
```

The failure proved the evaluator ignored the R.0-R.10, T223, and T229
closeout prerequisites.

## 6. Implementation changes

- Added `rebrandPhaseCloseoutIssues`, `masterPhase1CloseoutDone`, and
  `masterPhase2CloseoutDone` to the R.11 preflight snapshot.
- Added exact R.0-R.10 rebrand ticket paths, avoiding broad ticket-number
  globs because unrelated tickets share some numbers.
- Added matching worklog existence checks for each R.0-R.10 ticket.
- Added exact `Status: DONE` checks for R.0-R.10 tickets, T223, and T229.
- Added distinct report rows:
  `rebrand-closeouts`, `phase1-closeout`, and `phase2-rbac-closeout`.
- Kept the runner report-only; it does not create refs, mirrors, rewritten
  history, or force-pushed refs.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts` (RED)
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run typecheck`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`

## 8. Passing test output summary

Targeted test after implementation:

```text
11 pass
0 fail
36 expect() calls
```

Typecheck:

```text
bun run typecheck:shared
```

exited 0.

Documentation validation:

```text
[agent-contract] ok: 11 skills, 355 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /home/dev/craft/rox-one-terminal/docs/architecture/sync-v2-design.md
```

Rebrand validation:

```text
rebrand validation passed: no forbidden tokens outside the allowlist
```

Whitespace validation:

```text
git diff --check
```

exited 0 with no output.

Post-push default pre-backup preflight, 2026-05-14:

```text
rebrand-closeouts     pass    R.0-R.10 tickets are Status: DONE a...
phase1-closeout       pass    docs/tickets/T223-c4-followups-clos...
phase2-rbac-closeout  pass    docs/tickets/T229-rbac-integration-...
main-sync             pass    origin/main...main is 0 0.
worktree-clean        pass    git status --porcelain is empty.
red - 1 R.11 pre-backup prerequisite(s) failing
```

Post-push explicit pre-rewrite preflight:

```text
rebrand-closeouts     pass    R.0-R.10 tickets are Status: DONE a...
phase1-closeout       pass    docs/tickets/T223-c4-followups-clos...
phase2-rbac-closeout  pass    docs/tickets/T229-rbac-integration-...
backup-tag            fail    pre-rebrand-history-rewrite-backup ...
backup-branch         fail    backup/pre-rebrand-history-rewrite-...
offline-mirror        fail    /tmp/rox-one-terminal-backup-2026-0...
main-sync             pass    origin/main...main is 0 0.
worktree-clean        pass    git status --porcelain is empty.
red - 3 R.11 pre-rewrite prerequisite(s) failing
```

## 9. Build output summary

No build was run. This changes the report-only preflight script and tests, not
product runtime behavior.

## 10. Remaining risks

R.11 remains blocked by active goal state. Backup creation, `git filter-repo`,
force-push, post-rewrite validation, and `update_goal` remain unexecuted.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Regression test fails before implementation | Green | RED run showed the evaluator ignored the closeout prerequisites |
| Regression test passes after implementation | Green | Targeted test reports 11 pass, 0 fail |
| Preflight has distinct rows for R.0-R.10, T223, and T229 closeouts | Green | Added `rebrand-closeouts`, `phase1-closeout`, and `phase2-rbac-closeout` rows |
| Live default preflight still fails only on active goal | Green | Post-push default preflight is red only on `no-active-goal` |
| Live pre-rewrite preflight still fails only on backup artifacts with active-goal ack | Green | Post-push pre-rewrite preflight is red only on `backup-tag`, `backup-branch`, and `offline-mirror` |
| Documentation/rebrand validation remains green | Green | `typecheck`, `validate:docs`, `validate:rebrand`, and `git diff --check` passed |
| Destructive R.11 actions are not executed | Green | No backup, mirror, filter-repo, force-push, or update_goal action was run |
| Commit created | Green | Lore commit `060e3ffd` created and pushed |
