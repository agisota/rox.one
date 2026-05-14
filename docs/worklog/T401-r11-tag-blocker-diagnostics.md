# T401 - R.11 tag blocker diagnostics

Status: DONE
Phase: R.11 preflight hardening
Ticket: docs/tickets/T401-r11-tag-blocker-diagnostics.md

## 1. Task summary

Improve the report-only R.11 preflight so the current `rebrand-v1` tag blockers
show concrete local and origin peeled commit targets. This does not unblock or
start R.11; it makes the blocker evidence exact enough for a future unblock
decision.

## 2. Repo context discovered

The active goal is still:

```text
follow the instructions in
  docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md
```

T400 showed R.11 remains blocked by:

- active `/goal` state,
- local/origin `rebrand-v1` tag drift,
- origin `rebrand-v1` target missing from `origin/main` ancestry,
- missing backup tag,
- missing backup branch,
- missing offline mirror.

The preflight already checked `rebrand-tag-local-sync` and
`rebrand-tag-on-main`, but the formatted CLI output previously truncated or
omitted the exact SHA evidence operators need.

Current read-only tag evidence:

```text
origin refs/tags/rebrand-v1^{}: b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99
local rebrand-v1^{commit}: 906896e145156d92cf98457c4dc1893c53323bac
remote_on_main_exit=1
local_on_main_exit=1
```

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T400-rebrand-goal-completion-audit-refresh-2.md`
- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`

## 4. Tests added first

Added regression coverage in `scripts/__tests__/rebrand-r11-preflight.test.ts`
before implementation:

- failed local-sync row includes both local and origin `rebrand-v1` targets;
- failed tag-on-main row includes the origin target;
- formatted report keeps the full tag target evidence visible.

## 5. Expected failing test output

First RED run after adding result-detail tests:

```text
15 pass
2 fail
53 expect() calls
```

Expected failures:

```text
detail: "Local rebrand-v1 target differs from origin or is missing."
detail: "rebrand-v1 target is missing from origin/main ancestry."
```

Second RED run after adding formatted-report coverage:

```text
17 pass
1 fail
55 expect() calls
```

Expected failure:

```text
Expected to contain: "906896e145156d92cf98457c4dc1893c53323bac"
Received: "... Local rebrand-v1 target differs fro..."
```

## 6. Implementation changes

- Added optional `rebrandTagRemoteCommit` and `rebrandTagLocalCommit` fields to
  the R.11 preflight snapshot.
- Collected origin and local peeled `rebrand-v1` commits with read-only git
  commands.
- Reused those collected commit values to evaluate local tag sync and
  origin-main ancestry.
- Included the local/origin values in `rebrand-tag-local-sync` details.
- Included the origin value in `rebrand-tag-on-main` details.
- Increased the formatted report detail column width so the full SHA evidence
  is visible in the CLI output.
- Did not fetch, re-point, create, or push tags.
- Did not create backup refs, offline mirrors, rewritten history, or
  force-pushed refs.
- Did not call `update_goal`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`

## 8. Passing test output summary

Targeted test after implementation:

```text
18 pass
0 fail
56 expect() calls
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
[agent-contract] ok: 11 skills, 366 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /home/dev/craft/rox-one-terminal/docs/architecture/sync-v2-design.md
```

Rebrand validation:

```text
rebrand validation passed: no forbidden tokens outside the allowlist
```

Current preflight detail now includes full tag targets:

```text
rebrand-tag-local-sync  fail  Local rebrand-v1 target differs from origin: local 906896e145156d92cf98457c4dc1893c53323bac, origin b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99.
rebrand-tag-on-main     fail  origin rebrand-v1 target b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99 is missing from origin/main ancestry.
```

Whitespace validation:

```text
git diff --check
```

exited 0 with no output.

## 9. Build output summary

No build was run. This changed report-only validation tooling and tests, not
product runtime behavior. Typecheck, lint, targeted tests, docs validation, and
rebrand validation were run instead.

## 10. Remaining risks

R.11 remains blocked. The diagnostic output is stronger, but no blocker was
cleared: active goal state, tag drift, off-main origin tag target, backup tag,
backup branch, and offline mirror still need legitimate resolution before any
history rewrite can start.

The pre-commit preflight runs showed `worktree-clean` red while this T401
change was uncommitted. A clean post-commit/post-push preflight must be captured
before final reporting.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED test fails before implementation for missing tag target detail | Green | Section 5 records the 2-fail and formatted-output 1-fail RED runs |
| Failed local-sync row includes both local and origin `rebrand-v1` targets when known | Green | Section 8 records full local and origin targets in the row detail |
| Failed tag-on-main row includes the origin `rebrand-v1` target when known | Green | Section 8 records the origin target in the row detail |
| Preflight remains report-only | Green | Implementation only reads git state and did not mutate refs or history |
| Targeted tests and relevant validation pass | Green | Section 8 records targeted test, typecheck, lint, docs, rebrand, and whitespace validation |
| Current R.11 blockers remain explicit | Green | Section 8 records the current tag blockers; Section 10 lists the full remaining blocker set |
| Commit created | Green | Lore commit created for this diagnostic hardening |
