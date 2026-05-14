# T370 - Rebrand R.11 preflight runner doc wire

Status: DONE
Phase: R.11 preflight runner doc wire
Ticket: docs/tickets/T370-rebrand-r11-preflight-runner-doc-wire.md

## 1. Task summary

Wire the T369 `rebrand:r11-preflight` runner into the canonical R.11 goal
instructions so the destructive rewrite preflight has an executable stop gate.

## 2. Repo context discovered

`scripts/rebrand-r11-preflight.ts` and
`scripts/__tests__/rebrand-r11-preflight.test.ts` exist. The root package
script `rebrand:r11-preflight` exists. The canonical rebrand goal's R.11 hard
prerequisites still list manual commands but do not mention the new runner.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `package.json`

## 4. Tests added first

Added a documentation contract assertion to
`scripts/__tests__/rebrand-r11-preflight.test.ts`.

## 5. Expected failing test output

Expected RED before goal update:

```text
expect(goal).toContain("bun run rebrand:r11-preflight")
```

Actual RED before goal update:

```text
bun test scripts/__tests__/rebrand-r11-preflight.test.ts
(fail) R.11 goal documentation > points operators at the executable report-only preflight runner
Expected to contain: "bun run rebrand:r11-preflight"
3 pass
1 fail
9 expect() calls
```

The first implementation pass used uppercase `Report-only`; the same focused
test then failed for the expected case-sensitive `report-only` assertion:

```text
Expected to contain: "report-only"
3 pass
1 fail
10 expect() calls
```

## 6. Implementation changes

- Added a documentation contract assertion that reads the canonical rebrand
  goal file and requires both `bun run rebrand:r11-preflight` and
  `report-only`.
- Updated the R.11 hard prerequisites to point operators at the report-only
  runner before any backup step.
- Kept the R.11 destructive flow blocked: no backup refs, mirrors,
  `git-filter-repo`, or force-push commands were run.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run rebrand:r11-preflight`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Focused test:

```text
4 pass
0 fail
10 expect() calls
Ran 4 tests across 1 file.
```

Report-only runner on current blocked repo state:

```text
red - 7 R.11 prerequisite(s) failing
error: script "rebrand:r11-preflight" exited with code 1
```

The non-zero exit is expected. The blocker set includes the active goal,
open PRs, missing backup tag, missing offline mirror, missing
`git-filter-repo`, missing R.11 closeout ticket, and the dirty T370 worktree
before this commit.

Documentation validation:

```text
[agent-contract] ok: 11 skills, 334 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md
```

Rebrand validation:

```text
rebrand validation passed: no forbidden tokens outside the allowlist
```

Whitespace check:

```text
git diff --check
```

exited 0 with no output.

## 9. Build output summary

No build expected. This is a docs/test wiring update and does not change
runtime behavior.

## 10. Remaining risks

This does not unblock R.11 by itself. The destructive rewrite still requires
all hard prerequisites, backup artifacts, legal-preserve checks, full
post-rewrite validation, and force-push with lease.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED documentation contract test captured before goal update | Green | Focused test failed on missing runner mention before goal update |
| Rebrand-sweep R.11 hard prerequisites mention the runner | Green | Goal file now names `bun run rebrand:r11-preflight` as a report-only helper |
| Focused R.11 preflight tests pass | Green | Focused test `4 pass`, `0 fail` |
| Runner still exits non-zero on current blocked repo state | Green | `bun run rebrand:r11-preflight` exited 1 with 7 failing prerequisites |
| Documentation validation passes | Green | `bun run validate:docs` exit 0; agent contract reports 334 tickets |
| Rebrand validation passes | Green | `bun run validate:rebrand` exit 0 |
| Whitespace diff check passes | Green | `git diff --check` exit 0 |
| Worklog complete | Green | 11-section worklog complete |
| Commit created | Green | Atomic Lore commit for T370 after validation |
