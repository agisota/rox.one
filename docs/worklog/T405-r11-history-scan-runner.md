# T405 - R.11 history scan runner

Status: DONE
Phase: R.11 validation hardening
Ticket: docs/tickets/T405-r11-history-scan-runner.md

## 1. Task summary

Add an executable, report-only R.11 history scan for the global
`git log -p --all` zero-forbidden-token gate. The runner is intentionally not
part of the pre-backup gate because it is expected to stay red until the
authorized history rewrite succeeds.

## 2. Repo context discovered

The active goal is still:

```text
follow the instructions in
  docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md
```

T404 made the history-scan global stopping condition explicit in T298, but it
was still a manual command. The new runner makes that gate executable and
bounded without mutating refs or history.

The live runner currently fails, as expected before R.11:

```text
red - git log -p --all history scan found 9 forbidden-token patch line(s) outside the legal-preserve allowlist
... output truncated after 8 finding(s)
```

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `docs/tickets/T404-r11-global-closeout-criteria-refresh.md`
- `scripts/validate-rebrand.cjs`
- `scripts/rebrand-r11-preflight.ts`
- `package.json`

## 4. Tests added first

Added `scripts/__tests__/rebrand-r11-history-scan.test.ts` before
implementation. The tests covered:

- legal-preserve path allowlisting;
- ordinary runtime path rejection;
- forbidden-token patch finding collection;
- legal-preserve patch line suppression;
- bounded finding truncation;
- formatted red report evidence.

## 5. Expected failing test output

RED run before implementation:

```text
error: Cannot find module '../rebrand-r11-history-scan'
0 pass
1 fail
1 error
```

After implementation, the tests exposed a fixture issue: fake commit `abc123`
was shorter than the runner's real git SHA pattern. The fixture was corrected
to `abc1234`, then the tests passed.

## 6. Implementation changes

- Added `scripts/rebrand-r11-history-scan.ts`.
- Exported pure helpers:
  - `isHistoryPathAllowlisted`;
  - `collectHistoryFindingsFromText`;
  - `formatHistoryScanReport`;
  - `runHistoryScan`.
- Streamed `git log --all --no-color --no-ext-diff -p` instead of loading the
  full history into memory up front.
- Tracked current commit and diff path while scanning patch lines.
- Added path/line allowlisting for legal-preserve history surfaces.
- Added the runner and its tests to the scanner's own allowlist because they
  necessarily contain the literal tokens they detect.
- Added bounded output via `REBRAND_R11_HISTORY_MAX_FINDINGS`.
- Wired `package.json` script `rebrand:r11-history-scan`.
- Updated T298 to point its history validation at the new package script.
- Added a narrow `validate-rebrand.cjs` allowlist entry for the history-scan
  runner and its test fixtures because they necessarily contain the literal
  legacy tokens they detect.
- Did not mutate refs, create backup artifacts, create mirrors, delete
  branches, run `git filter-repo`, force-push, or call `update_goal`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-history-scan.test.ts`
- `REBRAND_R11_HISTORY_MAX_FINDINGS=8 bun run rebrand:r11-history-scan`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Targeted unit test:

```text
6 pass
0 fail
16 expect() calls
```

Live history scan is red, as expected before R.11 rewrite:

```text
red - git log -p --all history scan found 9 forbidden-token patch line(s) outside the legal-preserve allowlist
... output truncated after 8 finding(s)
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
[agent-contract] ok: 11 skills, 370 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /home/dev/craft/rox-one-terminal/docs/architecture/sync-v2-design.md
```

Rebrand validation:

```text
rebrand validation passed: no forbidden tokens outside the allowlist
```

The first push attempt correctly failed the pre-push `validate:rebrand` hook
because the new runner and tests contained literal fixture tokens. The narrow
allowlist entry was added, then `validate:rebrand` was rerun successfully.

Whitespace validation:

```text
git diff --check
```

exited 0 with no output.

## 9. Build output summary

No build was run. This is a report-only validation script and test slice, not a
runtime product change.

## 10. Remaining risks

R.11 remains blocked. The new scanner proves the all-history gate is currently
red; it does not clear the gate. After the authorized history rewrite, this
runner must exit 0 before T298 can become `Status: DONE`.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED unit tests fail before implementation | Green | Section 5 records the module-missing RED run |
| Parser records forbidden-token findings outside the history allowlist | Green | Targeted unit test passes |
| Parser ignores legal-preserve paths | Green | Targeted unit test passes |
| CLI exits non-zero on current history and prints bounded findings | Green | Section 8 records the expected red live scan |
| Package script `rebrand:r11-history-scan` exists | Green | `package.json` script added |
| Runner remains report-only | Green | Script only streams `git log`; no refs, backups, mirrors, branches, filter-repo, force-push, or update_goal actions |
| Relevant validation passes | Green | Section 8 records unit, typecheck, lint, docs, rebrand, and whitespace validation |
| Commit created | Green | Lore commit created for this runner |
