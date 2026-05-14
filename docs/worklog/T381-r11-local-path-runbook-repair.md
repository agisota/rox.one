# T381 - R.11 local path runbook repair

Status: DONE
Phase: R.11 runbook hardening
Ticket: docs/tickets/T381-r11-local-path-runbook-repair.md

## 1. Task summary

Repair stale local checkout paths in the R.11 backup and rollback snippets so
the documented commands match the current checkout at
`/home/dev/craft/rox-one-terminal`.

## 2. Repo context discovered

`get_goal` still reports an active goal for the rebrand sweep. That blocks the
destructive R.11 history rewrite, so this ticket only hardens the report-only
runbook path checks.

The stale snippets were:

- `file:///home/dev/rox/rox-one-terminal` in the offline mirror command.
- `cd /home/dev/rox/rox-one-terminal` in the rollback command.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `docs/tickets/T380-r11-staged-blocker-refresh.md`
- `docs/worklog/T380-r11-staged-blocker-refresh.md`

## 4. Tests added first

Added a regression test in
`scripts/__tests__/rebrand-r11-preflight.test.ts` asserting that the R.11 goal
document:

- contains `file:///home/dev/craft/rox-one-terminal`;
- contains `cd /home/dev/craft/rox-one-terminal`;
- does not contain `/home/dev/rox/rox-one-terminal`.

## 5. Expected failing test output

Initial RED run:

```text
error: expect(received).toContain(expected)

Expected to contain: "file:///home/dev/craft/rox-one-terminal"
...
(fail) R.11 goal documentation > uses the current checkout path in R.11 mirror and rollback snippets

6 pass
1 fail
18 expect() calls
```

## 6. Implementation changes

- Updated the R.11 offline mirror command to clone from
  `file:///home/dev/craft/rox-one-terminal`.
- Updated the R.11 rollback command to `cd /home/dev/craft/rox-one-terminal`.
- Did not create backup refs, mirrors, rewritten history, or force-pushed refs.
- Did not call `update_goal`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `rg -n "/home/dev/rox/rox-one-terminal|file:///home/dev/craft/rox-one-terminal|cd /home/dev/craft/rox-one-terminal" docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Targeted test after the repair:

```text
7 pass
0 fail
20 expect() calls
Ran 7 tests across 1 file.
```

Path audit:

```text
docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md:645:cd /tmp && git clone --mirror file:///home/dev/craft/rox-one-terminal \
docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md:775:cd /home/dev/craft/rox-one-terminal
```

Documentation validation:

```text
[agent-contract] ok: 11 skills, 346 tickets, 7 required docs
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

## 9. Build output summary

No build was run. This is a documentation and regression-test hardening change
with no runtime behavior change.

## 10. Remaining risks

R.11 remains blocked by the active Codex goal. The backup and rewrite commands
are still intentionally not executed in this run.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Regression test fails before the runbook path repair | Green | RED run failed on missing `file:///home/dev/craft/rox-one-terminal` |
| Regression test passes after the runbook path repair | Green | Targeted test reports 7 pass, 0 fail |
| R.11 goal document no longer contains stale local path | Green | Regression test asserts absence of `/home/dev/rox/rox-one-terminal` |
| R.11 goal document contains current checkout mirror path | Green | Path audit shows `file:///home/dev/craft/rox-one-terminal` |
| Documentation/rebrand validation remains green | Green | `validate:docs`, `validate:rebrand`, and `git diff --check` passed |
| Destructive R.11 actions are not executed | Green | No backup, mirror, filter-repo, force-push, or update_goal action was run |
| Commit created | Green | Local Lore commit created for this ticket |
