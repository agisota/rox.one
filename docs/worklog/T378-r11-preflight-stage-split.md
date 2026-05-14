# T378 - R.11 preflight stage split

Status: DONE
Phase: R.11 preflight repair
Ticket: docs/tickets/T378-r11-preflight-stage-split.md

## 1. Task summary

Repair the R.11 preflight runner so the default pre-backup gate no longer
requires backup artifacts that the next procedure step is supposed to create.
Add an explicit pre-rewrite gate that still requires those artifacts before
`git filter-repo`.

## 2. Repo context discovered

The R.11 goal defines this sequence:

1. Hard prerequisites must pass.
2. Run `bun run rebrand:r11-preflight` before any backup step.
3. Create backup tag, backup branch, and offline mirror.
4. Confirm backup tag and offline mirror before any filter-repo invocation.

The old runner made step 2 fail on missing backup tag and offline mirror, so
step 3 could not be reached without bypassing the report-only helper.

## 3. Files inspected

- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`

## 4. Tests added first

Added failing tests to `scripts/__tests__/rebrand-r11-preflight.test.ts`:

- `pre-backup stage does not require backup artifacts before they can be created`
- `pre-rewrite stage requires backup artifacts before filter-repo`

## 5. Expected failing test output

Before implementation:

```text
Expected: true
Received: false

Expected length: 7
Received length: 9
```

The failures showed that default preflight still counted backup tag and offline
mirror as blockers.

## 6. Implementation changes

- Added `R11PreflightStage = 'pre-backup' | 'pre-rewrite'`.
- Added `R11PreflightOptions` and made `evaluateR11Preflight()` default to
  `pre-backup`.
- Moved `backup-tag` and `offline-mirror` checks behind the `pre-rewrite`
  stage.
- Added CLI parsing for `--stage pre-backup` and `--stage pre-rewrite`.
- Updated report summary copy to name the active stage.
- Did not create backup refs, mirrors, rewritten history, or force-pushed refs.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts` (RED)
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts` (GREEN)
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Targeted test:

```text
6 pass
0 fail
16 expect() calls
```

Default pre-backup live check before commit:

```text
no-active-goal       fail    Missing ROX_R11_NO_ACTIVE_GOAL=1 ac...
worktree-clean       fail    git status --porcelain is not empty.
red - 2 R.11 pre-backup prerequisite(s) failing
```

The `worktree-clean` failure is expected before this ticket is committed
because the T378 files are still uncommitted.

Explicit pre-rewrite live check before commit:

```text
backup-tag           fail    pre-rebrand-history-rewrite-backup ...
offline-mirror       fail    /tmp/rox-one-terminal-backup-2026-0...
worktree-clean       fail    git status --porcelain is not empty.
red - 3 R.11 pre-rewrite prerequisite(s) failing
```

Documentation validation:

```text
[agent-contract] ok: 11 skills, 343 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md
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

No build was run. The change is limited to the report-only preflight script,
its tests, and documentation artifacts.

## 10. Remaining risks

R.11 remains blocked by the active Codex goal. Once the active goal is paused
or otherwise truthfully absent, default pre-backup preflight can pass without
backup artifacts; the backup artifacts are still required by `--stage
pre-rewrite` before any filter-repo invocation.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Default preflight does not require backup artifacts before backup creation | Green | New pre-backup test passes |
| Explicit pre-rewrite preflight requires backup artifacts before rewrite | Green | New pre-rewrite test passes |
| No-active-goal remains a default hard stop | Green | Existing test and live preflight show no-active-goal red |
| Targeted tests pass | Green | `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`: 6 pass |
| Documentation/rebrand validation remains green | Green | `validate:docs`, `validate:rebrand`, and `git diff --check` passed |
| Commit created | Green | Local Lore commit created for this ticket |
