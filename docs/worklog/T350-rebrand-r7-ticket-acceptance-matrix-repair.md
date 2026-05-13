# T350 - Rebrand R.7 ticket acceptance matrix repair

Status: DONE
Phase: post-upstream evidence hygiene
Ticket: docs/tickets/T350-rebrand-r7-ticket-acceptance-matrix-repair.md

## 1. Task summary

Repair stale unchecked acceptance criteria in the R.7 rebrand ticket files
after the completion audit found that T289, T290, and T291 were marked DONE
while their ticket-level checklists still showed open rows.

## 2. Repo context discovered

The R.7 worklogs already contain green acceptance matrices and concrete
validation evidence:

- T289: Dockerfile/server packaging test evidence records 7 pass, 0 fail, and
  preserved upstream attribution.
- T290: CI workflow contract evidence records the R.7 workflow name/artifact
  assertions as green and documents that no workflow file changed.
- T291: Electron build config evidence records the productName/appId assertion
  as green, documents `appId: com.rox.one`, and records the R.6/R.7 ledger
  update.

The ticket files had not been brought into sync with those worklogs.

## 3. Files inspected

- `docs/tickets/T289-rebrand-dockerfile.md`
- `docs/tickets/T290-rebrand-ci-workflows.md`
- `docs/tickets/T291-rebrand-electron-builder-config.md`
- `docs/worklog/T289-rebrand-dockerfile.md`
- `docs/worklog/T290-rebrand-ci-workflows.md`
- `docs/worklog/T291-rebrand-electron-builder-config.md`
- `.swarm/master-roadmap-log.md`

## 4. Tests added first

No new test file was needed for this documentation consistency repair. The
red check was the focused unchecked-criteria search over the three R.7 ticket
files.

## 5. Expected failing test output

The initial search found unchecked rows in all three R.7 ticket files:

```text
docs/tickets/T289-rebrand-dockerfile.md:60:- [ ] Docker image examples use `rox-one-server`.
docs/tickets/T290-rebrand-ci-workflows.md:78:- [ ] R.7 test asserts the name-key + artifact-name contract is green.
docs/tickets/T291-rebrand-electron-builder-config.md:89:- [ ] R.7 test asserts `productName: ROX.ONE` and rox-scoped `appId`.
```

## 6. Implementation changes

- Checked the T289 acceptance rows for Docker image examples, container
  user/group/home, ROX env examples, removed dead package paths, and preserved
  legal attribution.
- Checked the T290 acceptance rows for the workflow name/artifact regression
  test, no workflow edits, and preserved ROX env-var shim exercise.
- Checked the T291 acceptance rows for electron-builder metadata, no
  electron-builder config edit, documented `com.rox.one`, and R.6/R.7 ledger
  coverage.
- Added this T350 ticket/worklog pair so the evidence repair has its own
  atomic commit.

## 7. Validation commands run

- `rg -n '^- \\[ \\]' docs/tickets/T289-rebrand-dockerfile.md docs/tickets/T290-rebrand-ci-workflows.md docs/tickets/T291-rebrand-electron-builder-config.md` (red)
- `rg -n '^- \\[ \\]' docs/tickets/T289-rebrand-dockerfile.md docs/tickets/T290-rebrand-ci-workflows.md docs/tickets/T291-rebrand-electron-builder-config.md`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

- Post-edit unchecked-criteria search returned no matches.
- `bun run validate:docs` passed.
- `bun run validate:rebrand` passed.
- `git diff --check` passed.

## 9. Build output summary

No build was required. This ticket changes documentation and ticket metadata
only; runtime/build artifacts are unchanged.

## 10. Remaining risks

R.11 git-history rewrite remains outside this repair. The rebrand sweep global
goal still cannot be marked complete until R.11's destructive prerequisites,
backup artifacts, history rewrite, and post-rewrite validation are complete.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Initial unchecked-criteria search fails on T289-T291 | Green | Pre-edit `rg` found unchecked rows in all three ticket files |
| T289 acceptance criteria are checked | Green | Ticket checklist updated from `[ ]` to `[x]` |
| T290 acceptance criteria are checked | Green | Ticket checklist updated from `[ ]` to `[x]` |
| T291 acceptance criteria are checked | Green | Ticket checklist updated from `[ ]` to `[x]` |
| Post-edit unchecked-criteria search returns no matches | Green | Focused `rg` exits with no output |
| Documentation validation passes | Green | `bun run validate:docs` exit 0 |
| Rebrand validation passes | Green | `bun run validate:rebrand` exit 0 |
| Whitespace check passes | Green | `git diff --check` exit 0 |
| Worklog complete | Green | 11-section worklog complete |
| Commit created | Green | Atomic commit after validation |
