# T406 - R.11 legal preserve runner

Status: DONE
Phase: R.11 validation hardening
Ticket: docs/tickets/T406-r11-legal-preserve-runner.md

## 1. Task summary

Add an executable, report-only R.11 legal-preserve runner for the post-rewrite,
pre-force-push checks. The runner compares the three legal attribution files to
the backup tag and verifies the Dockerfile source-label attribution.

## 2. Repo context discovered

The active goal is still:

```text
follow the instructions in
  docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md
```

The goal's legal-preserve section had manual commands for `LICENSE`, `NOTICE`,
`TRADEMARK.md`, and Dockerfile attribution. The live runner currently fails, as
expected before backup creation:

```text
legal-file-LICENSE      fail
legal-file-NOTICE       fail
legal-file-TRADEMARK.md fail
dockerfile-source-attribution pass
red - 3 R.11 legal-preserve check(s) failing
```

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `Dockerfile.server`
- `scripts/rebrand-r11-history-scan.ts`
- `package.json`

## 4. Tests added first

Added `scripts/__tests__/rebrand-r11-legal-preserve.test.ts` before
implementation. The tests covered:

- passing byte-identical legal files plus intact Dockerfile attribution;
- failing legal-file drift;
- failing missing backup content;
- failing missing Dockerfile attribution;
- formatted red report evidence.

## 5. Expected failing test output

RED run before implementation:

```text
error: Cannot find module '../rebrand-r11-legal-preserve'
0 pass
1 fail
1 error
```

## 6. Implementation changes

- Added `scripts/rebrand-r11-legal-preserve.ts`.
- Exported pure helpers:
  - `evaluateLegalPreserveSnapshot`;
  - `collectLegalPreserveSnapshot`;
  - `formatLegalPreserveReport`.
- Compared `LICENSE`, `NOTICE`, and `TRADEMARK.md` between
  `pre-rebrand-history-rewrite-backup` and `HEAD`.
- Failed closed when backup or HEAD content cannot be read.
- Checked that `Dockerfile.server` still contains the source attribution label
  pointing at `github.com/lukilabs/rox-agents-oss`.
- Wired `package.json` script `rebrand:r11-legal-preserve`.
- Updated T298 to point its legal-preserve validation at the new package
  script.
- Did not mutate refs, create backup artifacts, create mirrors, delete
  branches, run `git filter-repo`, force-push, or call `update_goal`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-legal-preserve.test.ts`
- `bun run rebrand:r11-legal-preserve`
- `bun run validate:rebrand`

Additional validation before commit:

- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `git diff --check`

## 8. Passing test output summary

Targeted unit test:

```text
5 pass
0 fail
10 expect() calls
```

Live legal-preserve runner is red, as expected before backup creation:

```text
legal-file-LICENSE             fail
legal-file-NOTICE              fail
legal-file-TRADEMARK.md        fail
dockerfile-source-attribution  pass
red - 3 R.11 legal-preserve check(s) failing
```

Rebrand validation:

```text
rebrand validation passed: no forbidden tokens outside the allowlist
```

Docs validation:

```text
[agent-contract] ok: 11 skills, 371 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /home/dev/craft/rox-one-terminal/docs/architecture/sync-v2-design.md
```

Typecheck:

```text
bun run typecheck
exit 0
```

Lint:

```text
bun run lint
exit 0
0 errors, 7 pre-existing warnings
```

Whitespace:

```text
git diff --check
exit 0
```

## 9. Build output summary

No build was run. This is a report-only validation script and test slice, not a
runtime product change.

## 10. Remaining risks

R.11 remains blocked. The new runner proves the legal-preserve check cannot
pass until the backup tag exists and the post-rewrite legal files are compared
against it. After the authorized rewrite, this runner must exit 0 before T298
can become `Status: DONE` or any force-push can proceed.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED unit tests fail before implementation | Green | Section 5 records the module-missing RED run |
| Evaluator passes when attribution files match and Dockerfile attribution is intact | Green | Targeted unit test passes |
| Evaluator fails on attribution-file drift | Green | Targeted unit test passes |
| Evaluator fails on missing backup content | Green | Targeted unit test passes |
| Evaluator fails on Dockerfile attribution loss | Green | Targeted unit test passes |
| Package script `rebrand:r11-legal-preserve` exists | Green | `package.json` script added |
| Runner remains report-only | Green | Script only reads git objects and Dockerfile.server; no refs, backups, mirrors, branches, filter-repo, force-push, or update_goal actions |
| Relevant validation passes | Green | Section 8 records targeted test, expected-red live runner, rebrand/docs validation, typecheck, lint, and diff-check |
| Commit created | Green | Lore commit created for this runner |
