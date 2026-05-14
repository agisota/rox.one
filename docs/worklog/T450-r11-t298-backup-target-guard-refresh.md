# T450 - R.11 T298 backup target guard refresh

Status: DONE
Phase: R.11 report-only closeout hygiene
Ticket: docs/tickets/T450-r11-t298-backup-target-guard-refresh.md

## 1. Task summary

Refresh T298 so the future R.11 destructive closeout surface names the backup
target guard rows added by T446/T448.

## 2. Repo context discovered

The durable completion audit now records `backup-tag-target`,
`backup-branch-target`, and `offline-mirror-target`, but T298's ticket/worklog
still describe backup artifacts mostly as presence requirements.

## 3. Files inspected

- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `docs/release/r11-completion-audit-2026-05-14.md`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-r11-preflight.test.ts` with
`keeps T298 backup artifact instructions aligned with target guard rows`. The
test requires both the T298 ticket and worklog to name `backup-tag-target`,
`backup-branch-target`, and `offline-mirror-target`, and it verifies T298 stays
`Status: BLOCKED`.

## 5. Expected failing test output

Before updating T298, the targeted test failed because the T298 ticket lacked
the new target guard IDs:

```text
Expected to contain: "backup-tag-target"

(fail) R.11 closeout worklog documentation > keeps T298 backup artifact instructions aligned with target guard rows
```

## 6. Implementation changes

- Updated `docs/tickets/T298-rebrand-git-history-rewrite.md` to require the
  explicit pre-rewrite gate after backup artifacts exist and before
  `git filter-repo`.
- Added `backup-tag-target`, `backup-branch-target`, and
  `offline-mirror-target` to T298's ticket requirements and acceptance
  criteria.
- Updated `docs/worklog/T298-rebrand-git-history-rewrite.md` so the blocker
  matrix and current evidence explain that target rows are latent until their
  corresponding artifacts exist.
- Preserved T298 `Status: BLOCKED`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`: 33 pass,
  0 fail, 150 expect calls.
- `bun run validate:docs`: green; agent contract reports 415 tickets and
  7 required docs.
- `bun run validate:rebrand`: green; no forbidden tokens outside the allowlist.
- `bun run validate:roadmap`: green; reports 46 phases, 110 tickets across
  detail files, and 14 rebrand master-roadmap log rows.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 7 existing warnings and 0 errors.
- `git diff --check`: exit 0.

## 9. Build output summary

No build expected for this report-only documentation/test change.

## 10. Remaining risks

R.11 remains blocked by active goal state, fork count, tag mismatch/off-main
target, missing backup artifacts, missing offline mirror, and remote branch
review. This ticket does not authorize tag mutation, backup creation,
`git filter-repo`, force-push, or branch cleanup.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED assertion fails because T298 lacks the backup target guard IDs | PASS | Targeted test failed with `Expected to contain: "backup-tag-target"` before T298 edits |
| T298 ticket names `backup-tag-target` | PASS | T298 ticket now names the row in Required Automations, Implementation Requirements, and Acceptance Criteria |
| T298 ticket names `backup-branch-target` | PASS | T298 ticket now names the row in Required Automations, Implementation Requirements, and Acceptance Criteria |
| T298 ticket names `offline-mirror-target` | PASS | T298 ticket now names the row in Required Automations, Implementation Requirements, and Acceptance Criteria |
| T298 worklog names all three target guard IDs and keeps R.11 blocked | PASS | T298 worklog blocker matrix and current evidence name all three rows; header remains `Status: BLOCKED` |
| Targeted test and validators pass | PASS | Targeted test, docs/rebrand/roadmap validators, typecheck, lint, and diff-check passed |
| No destructive R.11 action is performed | PASS | No tag mutation, backup creation, mirror creation, filter-repo, force-push, or branch cleanup commands were run |
