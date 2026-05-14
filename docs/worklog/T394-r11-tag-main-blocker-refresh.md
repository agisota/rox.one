# T394 - R.11 tag main blocker refresh

Status: DONE
Phase: R.11 preflight evidence
Ticket: docs/tickets/T394-r11-tag-main-blocker-refresh.md

## 1. Task summary

Record the post-push `rebrand-tag-on-main` preflight blocker and keep T298's
R.11 blocker surface current.

## 2. Repo context discovered

After pushing `cbe6912a`, `HEAD` and `origin/main` matched. The new preflight
row showed:

- `rebrand-tag` passes because `rebrand-v1` is visible on origin;
- `rebrand-tag-on-main` fails because the tag target is not on `origin/main`
  ancestry.

This is a blocker to record. This ticket does not re-point the tag.

## 3. Files inspected

- `docs/tickets/T393-r11-preflight-rebrand-tag-main-check.md`
- `docs/worklog/T393-r11-preflight-rebrand-tag-main-check.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `scripts/rebrand-r11-preflight.ts`

## 4. Tests added first

No code test was added. This is a post-push evidence refresh for the already
tested T393 implementation.

## 5. Expected failing test output

The expected RED evidence is the live R.11 blocker state:

```text
rebrand-tag-on-main   fail    rebrand-v1 target is missing from o...
red - 2 R.11 pre-backup prerequisite(s) failing
```

## 6. Implementation changes

- Marked T393 ticket/worklog `Status: DONE`.
- Recorded post-push `rebrand-tag-on-main` evidence in T393.
- Refreshed T298 with the new blocker.
- Kept T298 `Status: BLOCKED`.
- Did not re-point `rebrand-v1`.
- Did not create backup refs, mirrors, rewritten history, or force-pushed refs.
- Did not call `update_goal`.

## 7. Validation commands run

- `get_goal`
- `git status --short --branch`
- `git rev-parse --short HEAD`
- `git rev-parse --short origin/main`
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Post-push sync:

```text
## main...origin/main
cbe6912a
cbe6912a
```

Default pre-backup preflight:

```text
no-active-goal        fail    Missing ROX_R11_NO_ACTIVE_GOAL=1 ac...
rebrand-tag           pass    rebrand-v1 is visible on origin.
rebrand-tag-on-main   fail    rebrand-v1 target is missing from o...
main-sync             pass    origin/main...main is 0 0.
worktree-clean        pass    git status --porcelain is empty.
red - 2 R.11 pre-backup prerequisite(s) failing
```

Explicit pre-rewrite preflight:

```text
rebrand-tag           pass    rebrand-v1 is visible on origin.
rebrand-tag-on-main   fail    rebrand-v1 target is missing from o...
backup-tag            fail    pre-rebrand-history-rewrite-backup ...
backup-branch         fail    backup/pre-rebrand-history-rewrite-...
offline-mirror        fail    /tmp/rox-one-terminal-backup-2026-0...
main-sync             pass    origin/main...main is 0 0.
worktree-clean        pass    git status --porcelain is empty.
red - 4 R.11 pre-rewrite prerequisite(s) failing
```

Documentation validation:

```text
[agent-contract] ok: 11 skills, 359 tickets, 7 required docs
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

No build was run. This is a documentation-only evidence refresh.

## 10. Remaining risks

R.11 remains blocked by active goal state, off-main `rebrand-v1`, and missing
backup artifacts. Backup creation, `git filter-repo`, force-push,
post-rewrite validation, and `update_goal` remain unexecuted.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| T393 ticket is `Status: DONE` | Green | T393 ticket updated |
| T393 worklog is `Status: DONE` | Green | T393 worklog updated |
| T298 records `rebrand-tag-on-main` as a blocker | Green | T298 matrix includes the blocker |
| T298 remains `Status: BLOCKED` | Green | T298 status unchanged |
| Documentation/rebrand validation remains green | Green | `validate:docs`, `validate:rebrand`, and `git diff --check` passed |
| Destructive R.11 actions are not executed | Green | No tag rewrite, backup, mirror, filter-repo, force-push, or update_goal action was run |
| Commit created | Green | Lore commit created for this ticket |
