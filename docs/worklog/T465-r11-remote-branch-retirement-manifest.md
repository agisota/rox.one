# T465 - R.11 remote branch retirement manifest

Status: DONE
Phase: R.11 report-only remote branch manifest
Ticket: docs/tickets/T465-r11-remote-branch-retirement-manifest.md

## 1. Task summary

Create a report-only manifest that converts the current 150 remote branch
blocker into exact review buckets and operator-owned dry-run guidance.

## 2. Repo context discovered

T464 pushed `origin/main` to `ced36ecb` with 0 open PRs. The R.11 default
preflight remains red on active-goal, fork-review, and tag blockers. The
explicit pre-rewrite gate remains red on those plus missing backup artifacts
and `remote-branch-review`.

## 3. Files inspected

- `docs/release/r11-remote-branch-review-2026-05-14.md`
- `docs/release/r11-consolidation-backlog-2026-05-14.md`
- `docs/release/r11-completion-audit-2026-05-14.md`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-r11-completion-audit.test.ts` so the
audit requires `docs/release/r11-remote-branch-retirement-manifest-2026-05-14.md`,
the exact branch bucket counts, no-destructive-authorization language, dry-run
review commands, and representative branch names from every risky bucket.

## 5. Expected failing test output

Before the manifest existed, the targeted test failed for the intended reason:

```text
ENOENT: no such file or directory, open
'/tmp/rox-one-terminal-consolidation/docs/release/r11-remote-branch-retirement-manifest-2026-05-14.md'
23 pass
1 fail
255 expect() calls
```

## 6. Implementation changes

- Added `docs/release/r11-remote-branch-retirement-manifest-2026-05-14.md`
  with exact branch bucket counts, manual-review branch names, dry-run review
  commands, and explicit no-destructive-authorization language.
- Updated `docs/release/r11-completion-audit-2026-05-14.md` to point at the
  new manifest from the `remote-branch-review` blocker.
- Updated `docs/release/r11-blocker-inventory-index-2026-05-14.md` to include
  the manifest beside the full remote branch inventory.
- Added this ticket/worklog pair.

No branch deletion, pruning, merging, preservation action, tag mutation,
backup creation, offline mirror creation, `git filter-repo`, force-push,
active-goal completion, or `update_goal` call was performed.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`: 24 pass,
  0 fail, 272 expect calls.
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`: 34 pass, 0
  fail, 157 expect calls.
- `bun run validate:docs`: ok; agent contract reports 11 skills, 432 tickets,
  and 7 required docs.
- `bun run validate:rebrand`: passed with no forbidden tokens outside the
  allowlist.
- `bun run validate:roadmap`: ok; 46 phases, 110 tickets across detail files,
  and 14 rebrand master-roadmap log rows.
- `git diff --check`: passed with exit 0.

## 9. Build output summary

No build expected for this report-only docs/test change. Source/runtime
behavior is not changed.

## 10. Remaining risks

R.11 remains blocked until operator-owned destructive gates are explicitly
cleared. This ticket does not authorize branch deletion, tag mutation, backup
creation, `git filter-repo`, force-push, or goal completion.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED assertion fails because the remote branch retirement manifest is absent | PASS | Targeted test failed with manifest ENOENT |
| Manifest records 150 non-main/non-R.11-backup branches | PASS | Manifest summary records 150 |
| Manifest records 0 open PR branches, 133 merged PR heads, 9 closed/unmerged PR heads, 7 no-visible-PR heads, and 1 backup/protected branch | PASS | Manifest summary records all bucket counts |
| Manifest preserves explicit no-destructive-authorization language | PASS | Manifest repeats the no-authorization sentence |
| Manifest points operators at dry-run review commands before any remote ref deletion command | PASS | Manifest includes dry-run commands and delete-command warning |
| Targeted tests and validators pass | PASS | Section 8 lists the passing commands |
| No destructive R.11 action is performed | PASS | No destructive command has been run |
