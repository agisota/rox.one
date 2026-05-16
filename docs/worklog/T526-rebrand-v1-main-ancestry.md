# T526 - Rebrand v1 main ancestry repair

## 1. Task summary

Repair the remaining R.11 pre-backup blocker by merging the existing
`rebrand-v1` tagged R10 branch into `main` through a normal PR path, avoiding a
remote tag rewrite.

## 2. Repo context discovered

- PR #248 merged into `main` as `1fb0a9d4`.
- `gh pr list --state open --limit 50` returned `[]`.
- With `ROX_R11_NO_ACTIVE_GOAL=1 ROX_R11_EXPECTED_FORKS=2`, pre-backup R.11
  preflight fails only on `rebrand-tag-on-main`.
- `rebrand-v1` peels to `b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99`.
- `git branch -r --contains b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99` reports
  only `origin/chore/rebrand-R10-final-sweep-and-gate`.
- `git merge-base --is-ancestor b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99
  origin/main` exits `1`.
- `origin/main...origin/chore/rebrand-R10-final-sweep-and-gate` is `395 3`,
  so the tagged branch has three commits not on current `main`.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `scripts/rebrand-r11-preflight.ts`

## 4. Tests added first

No new code test is needed. The RED gate is the report-only R.11 preflight.

## 5. Expected failing test output

Acknowledged pre-backup preflight before the ancestry repair:

```text
rebrand-tag-on-main     fail    origin rebrand-v1 target b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99 is missing from origin/main ancestry.
red - 1 R.11 pre-backup prerequisite(s) failing
```

## 6. Implementation changes

- Created branch `chore/T526-rebrand-v1-main-ancestry` from synced `main`.
- Merged `origin/chore/rebrand-R10-final-sweep-and-gate` with
  `--no-ff --no-commit`.
- Resolved conflicts in favor of current `main` content because those files
  already contain newer closeout/gate evidence:
  - `.husky/pre-push`
  - `.swarm/master-roadmap-log.md`
  - `docs/worklog/T296-rebrand-sweep-closeout.md`
  - `docs/worklog/T297-rebrand-prepush-hook-and-ci-gate.md`
  - `scripts/__tests__/rebrand-permanent-gate.test.ts`
- Added this ticket/worklog as the only content delta on top of the ancestry
  merge.
- Did not retarget or force-push `rebrand-v1`.
- Did not create backup refs, create an offline mirror, or run `git
  filter-repo`.

## 7. Validation commands run

- `bun run validate:rebrand`
- `bun run validate:docs`
- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`
- `git diff --check`
- `git diff --cached --check`

## 8. Passing test output summary

- `bun run validate:rebrand`: `rebrand validation passed: no forbidden tokens
  outside the allowlist`.
- `bun run validate:docs`: agent-contract, architecture-docs, and
  sync-v2-design validators passed; agent-contract reported 482 tickets.
- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`: 6 pass, 0 fail,
  12 `expect()` calls.
- `git diff --check` and `git diff --cached --check` exited 0 with no output.

## 9. Risks and follow-ups

- This ticket only repairs tag ancestry through a normal merge. It does not
  execute R.11.
- The ancestry repair is complete only after the PR branch lands on `main`; the
  post-merge proof point is an acknowledged R.11 pre-backup preflight on synced
  `main`.
- After this branch lands, R.11 still needs backup refs, offline mirror,
  explicit pre-rewrite validation, legal-preserve validation, history rewrite,
  force-push with lease, and post-rewrite validation.

## 10. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| RED acknowledged pre-backup gate fails only on `rebrand-tag-on-main` before merge | PASS | Preflight fails exactly one row after PR #248 merged. |
| PR branch merge parent is existing `rebrand-v1` target | PASS | `MERGE_HEAD` is `b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99`. |
| Current `main` content wins conflicts with older R10 branch | PASS | Five conflicts resolved with `--ours`; no old R10 file content replaces newer main content. |
| No tag retarget or force-push occurs | PASS | No `git tag -f`, `git push --force`, or tag push command was run. |
| No R.11 backup refs, offline mirror, or filter-repo command is run | PASS | No backup ref, mirror, or filter-repo command was run. |
| Targeted validation passes | PASS | `validate:rebrand`, `validate:docs`, rebrand permanent gate test, and diff checks passed. |
| Worklog complete | PASS | This 11-section worklog has a green acceptance matrix. |
| Commit created | PASS | This ticket is committed in the ancestry-repair merge commit. |

## 11. Final notes

This is a non-destructive unblocker for the R.11 pre-backup gate. It repairs
ancestry by carrying the existing tagged branch as a merge parent; it does not
rewrite refs or start the R.11 destructive sequence.
