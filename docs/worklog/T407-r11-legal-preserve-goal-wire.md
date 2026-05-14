# T407 - R.11 legal preserve goal wire

Status: DONE
Phase: R.11 validation hardening
Ticket: docs/tickets/T407-r11-legal-preserve-goal-wire.md

## 1. Task summary

Wire the canonical R.11 goal documentation to the T406
`bun run rebrand:r11-legal-preserve` runner.

## 2. Repo context discovered

T406 added and pushed a report-only legal-preserve runner. Fresh post-push
evidence shows the runner exits red before backup creation on the three legal
files and passes the Dockerfile attribution row. The canonical rebrand-sweep
goal still shows the older manual `/tmp/license.before` style snippets.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `scripts/__tests__/rebrand-r11-legal-preserve.test.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`

## 4. Tests added first

Added `scripts/__tests__/rebrand-r11-legal-preserve.test.ts` coverage before
editing the goal. The new documentation test requires the R.11 goal to mention
`bun run rebrand:r11-legal-preserve` and to drop the old `/tmp/*.before`
manual snippets.

## 5. Expected failing test output

RED run before implementation:

```text
expect(received).toContain(expected)
Expected to contain: "bun run rebrand:r11-legal-preserve"
5 pass
1 fail
11 expect() calls
```

## 6. Implementation changes

- Updated `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
  so the R.11 legal-preserve section runs
  `bun run rebrand:r11-legal-preserve`.
- Replaced the manual `/tmp/license.before`, `/tmp/notice.before`, and
  `/tmp/trademark.before` snippets with a description of what the executable
  gate verifies.
- Updated the R.11 validation and stopping-condition bullets to require the
  executable runner.
- Did not alter `LICENSE`, `NOTICE`, `TRADEMARK.md`, or `Dockerfile.server`.
- Did not run `git filter-repo`, create backup artifacts, create mirrors,
  force-push, or call `update_goal`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-legal-preserve.test.ts`
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run rebrand:r11-legal-preserve`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Targeted legal-preserve test:

```text
6 pass
0 fail
14 expect() calls
```

Adjacent R.11 preflight docs test:

```text
20 pass
0 fail
60 expect() calls
```

Live legal-preserve runner remains red for the expected blocker:

```text
legal-file-LICENSE             fail
legal-file-NOTICE              fail
legal-file-TRADEMARK.md        fail
dockerfile-source-attribution  pass
red - 3 R.11 legal-preserve check(s) failing
```

Validation:

```text
bun run typecheck
exit 0

bun run lint
exit 0
0 errors, 7 pre-existing warnings

bun run validate:docs
[agent-contract] ok: 11 skills, 372 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /home/dev/craft/rox-one-terminal/docs/architecture/sync-v2-design.md

bun run validate:rebrand
rebrand validation passed: no forbidden tokens outside the allowlist

git diff --check
exit 0
```

## 9. Build output summary

No build expected. This is documentation plus documentation-test coverage only.

## 10. Remaining risks

R.11 remains blocked by the same hard prerequisite gates. This ticket must not
be read as authorization to create backups, rewrite history, force-push, or
mark the active goal complete.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED documentation test fails before implementation | Green | Section 5 records the missing-runner failure |
| R.11 goal mentions `bun run rebrand:r11-legal-preserve` | Green | Targeted documentation test passes |
| Manual snippets are replaced by the runner instruction | Green | Targeted documentation test rejects `/tmp/*.before` snippets |
| Relevant validation passes | Green | Section 8 records targeted tests, typecheck, lint, docs/rebrand validation, and diff-check |
| Commit created | Green | Lore commit created for this goal-wire update |
