# T402 - R.11 stale remote branch preflight

Status: DONE
Phase: R.11 preflight hardening
Ticket: docs/tickets/T402-r11-stale-remote-branch-preflight.md

## 1. Task summary

Add a report-only R.11 preflight row that fails closed during the explicit
`--stage pre-rewrite` phase when origin still exposes non-main,
non-R.11-backup branches. This does not remove branches or start history
rewrite work; it only makes an existing global rebrand blocker visible before
any destructive operation.

## 2. Repo context discovered

The active goal is still:

```text
follow the instructions in
  docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md
```

The R.11 global stop condition includes a `git log -p --all` gate. That means
remote refs matter: stale origin branches can keep legacy history visible even
when `main` is clean.

Current read-only origin evidence:

```text
git ls-remote --heads origin => 140 heads
non-main/non-R.11-backup heads => 139
```

The stale set includes `chore/rebrand-R10-final-sweep-and-gate`, which contains
the current origin `rebrand-v1` target. The work here keeps that as a reportable
pre-rewrite blocker instead of pruning, deleting, or rewriting any refs.

## 3. Files inspected

- `docs/tickets/T401-r11-tag-blocker-diagnostics.md`
- `docs/worklog/T401-r11-tag-blocker-diagnostics.md`
- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`

## 4. Tests added first

Added regression coverage in `scripts/__tests__/rebrand-r11-preflight.test.ts`
before implementation:

- default pre-backup evaluation ignores stale remote branches;
- explicit pre-rewrite evaluation fails when stale origin branches remain;
- the failing pre-rewrite row includes stale branch name evidence.

## 5. Expected failing test output

RED run after adding the tests and before implementation:

```text
19 pass
1 fail
59 expect() calls
```

Expected failure:

```text
pre-rewrite stage fails closed while stale origin branches remain
Expected: false
Received: true
```

This proved the test was exercising missing behavior rather than an existing
check.

## 6. Implementation changes

- Added `staleRemoteBranches` and `staleRemoteBranchesError` to the R.11
  preflight snapshot.
- Added a shared `R11_BACKUP_BRANCH` constant for
  `backup/pre-rebrand-history-rewrite-2026-05-13`.
- Collected remote branch names with read-only
  `git ls-remote --heads origin`.
- Parsed and sorted `refs/heads/*` branch names without mutating local or
  remote refs.
- Added a `remote-branch-review` row only for `--stage pre-rewrite`.
- Kept the default pre-backup stage focused on pre-backup blockers, so branch
  cleanup is not required before the backup prerequisites exist.
- Did not delete, prune, fetch-prune, push, force-push, create backups, mutate
  tags, create mirrors, run `git filter-repo`, or call `update_goal`.

## 7. Validation commands run

- `brv query "R11 rebrand preflight stale remote branches"`
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`

## 8. Passing test output summary

ByteRover remains unavailable in this environment:

```text
/bin/bash: line 1: brv: command not found
```

Targeted preflight test after implementation:

```text
20 pass
0 fail
60 expect() calls
```

Typecheck:

```text
bun run typecheck
```

exited 0.

Lint:

```text
bun run lint
```

exited 0 with 7 pre-existing warnings and 0 errors.

Documentation validation:

```text
[agent-contract] ok: 11 skills, 367 tickets, 7 required docs
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

Current dirty-worktree default preflight remains report-only and red:

```text
red - 4 R.11 pre-backup prerequisite(s) failing
```

Current dirty-worktree simulated pre-rewrite preflight reports the new remote
branch blocker:

```text
remote-branch-review fail origin has 139 non-main/non-R.11-backup branch(es): backup/agent-workbench-t000-t012-2026-04-30; chore/T297-rebrand-prepush-ci-gate; chore/bundle-shrinkage-fin...
red - 7 R.11 pre-rewrite prerequisite(s) failing
```

## 9. Build output summary

No build was run. This changed report-only validation tooling, documentation,
and tests, not product runtime behavior. Typecheck, lint, targeted tests, docs
validation, rebrand validation, whitespace validation, and live preflight runs
were used as the relevant validation set.

## 10. Remaining risks

R.11 remains blocked. This ticket adds one more explicit diagnostic blocker for
the pre-rewrite stage, but it does not clear any of the existing blockers:
active goal state, local/origin `rebrand-v1` drift, off-main origin tag target,
missing backup tag, missing backup branch, missing offline mirror, and stale
remote branches.

The preflight runs in Section 8 were captured before this ticket was committed,
so `worktree-clean` was expected to be red. A clean post-commit/post-push
preflight must be captured before final reporting.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED test fails before implementation for missing stale remote branch row | Green | Section 5 records the 1-fail RED run |
| Default pre-backup preflight does not require remote branch cleanup | Green | Targeted test `pre-backup stage does not require stale remote branch cleanup before backups exist` passes |
| Explicit pre-rewrite preflight fails when stale origin branches remain | Green | Targeted test `pre-rewrite stage fails closed while stale origin branches remain` passes |
| Explicit pre-rewrite row reports the stale branch names | Green | Section 8 records `remote-branch-review` with stale branch examples |
| Preflight remains report-only | Green | Implementation only reads origin heads and did not mutate refs, history, tags, backups, or mirrors |
| Targeted tests and relevant validation pass | Green | Section 8 records targeted test, typecheck, lint, docs, rebrand, and whitespace validation |
| Commit created | Green | Lore commit created for this diagnostic hardening |
