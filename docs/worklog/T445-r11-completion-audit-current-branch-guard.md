# T445 - R.11 completion audit current branch guard

Status: DONE
Phase: R.11 report-only audit hygiene
Ticket: docs/tickets/T445-r11-completion-audit-current-branch-guard.md

## 1. Task summary

Refresh the R.11 completion audit so it records the T444 `current-branch`
preflight guard.

## 2. Repo context discovered

T444 added a `current-branch` row to `scripts/rebrand-r11-preflight.ts`. The
fresh post-push preflight output reports `current-branch pass` with
`Current checkout is main`, while the durable completion audit still omits that
new pass row from its current preflight evidence.

## 3. Files inspected

- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `docs/release/r11-completion-audit-2026-05-14.md`
- `scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `docs/tickets/T444-r11-preflight-current-branch-guard.md`
- `docs/worklog/T444-r11-preflight-current-branch-guard.md`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-r11-completion-audit.test.ts` with
`records the current branch guard as passing evidence`. The test reads the
Current Blockers section and requires `current-branch`, `Current checkout is
main`, and `pass` while still requiring the audit-level post-rewrite validation
warning.

## 5. Expected failing test output

Before updating the audit, the targeted test failed because the Current
Blockers section did not contain `current-branch`:

```text
Expected to contain: "current-branch"

16 pass
1 fail
151 expect() calls
```

After the audit edit, the test exposed that the post-rewrite warning lives in
the Current Main Validation Matrix section, not Current Blockers. The assertion
was narrowed to check that warning against the whole audit while keeping the
current-branch evidence scoped to Current Blockers.

## 6. Implementation changes

- Updated `docs/release/r11-completion-audit-2026-05-14.md` so the default
  preflight evidence records `current-branch` as a pass row with
  `Current checkout is main`.
- Updated the pre-rewrite preflight evidence to record that the
  `current-branch` row also passes there.
- Preserved `Status: NOT ACHIEVED` and the existing 4/7 blocker counts.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`: 17 pass,
  0 fail, 154 expect calls.
- `bun run validate:docs`: green; agent contract reports 410 tickets and
  7 required docs.
- `bun run validate:rebrand`: green.
- `bun run validate:roadmap`: green; reports 46 phases, 110 tickets across
  detail files, and 14 rebrand master-roadmap log rows.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 7 existing warnings and 0 errors.
- `git diff --check`: exit 0.

## 9. Build output summary

No build expected for this report-only audit/test change.

## 10. Remaining risks

R.11 remains blocked on hard prerequisites. This ticket does not authorize tag
mutation, backup creation, mirror creation, `git filter-repo`, force-push, or
branch cleanup.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED assertion fails on missing current-branch evidence | PASS | Targeted test failed because the audit did not contain `current-branch` |
| Completion audit records the `current-branch` guard | PASS | Current Blockers now records `current-branch` for both preflight stages |
| Completion audit records that the current checkout is `main` | PASS | Audit now records `Current checkout is main` |
| Completion audit keeps R.11 blocked and does not claim post-rewrite validation | PASS | Audit still says `Status: NOT ACHIEVED` and preserves the post-rewrite warning |
| Targeted test and validators pass | PASS | Targeted test, docs/rebrand/roadmap validators, typecheck, lint, and diff-check passed |
| No destructive R.11 action is performed | PASS | No tag mutation, backup creation, mirror creation, filter-repo, force-push, or branch cleanup commands were run |
