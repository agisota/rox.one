# T393 - R.11 preflight rebrand tag main check

Status: IN PROGRESS
Phase: R.11 preflight hardening
Ticket: docs/tickets/T393-r11-preflight-rebrand-tag-main-check.md

## 1. Task summary

Add a report-only preflight row proving the existing `rebrand-v1` tag target is
on `origin/main` before R.11 can proceed.

## 2. Repo context discovered

The current preflight checks `rebrand-v1` visibility on origin, but not whether
the tag target is on the current main ancestry. A local check found the current
tag target is not an ancestor of `origin/main`:

```text
tag_on_main_exit=1
rebrand-v1^{commit}=906896e1
```

This is a blocker to record, not a tag to rewrite in this slice.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/worklog/T296-rebrand-sweep-closeout.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`

## 4. Tests added first

Added `scripts/__tests__/rebrand-r11-preflight.test.ts` coverage before
implementation. The new evaluator regression asserts an off-main
`rebrand-v1` target creates a distinct `rebrand-tag-on-main` failure.

## 5. Expected failing test output

RED run:

```text
Expected: false
Received: true

(fail) evaluateR11Preflight > fails closed when the rebrand-v1 tag target is not on origin main

Expected length: 13
Received length: 12

(fail) evaluateR11Preflight > reports every blocker instead of stopping after the first red check

10 pass
2 fail
31 expect() calls
```

The failure proved the evaluator ignored the tag-on-main condition.

## 6. Implementation changes

- Added `rebrandTagOnMain` to the R.11 preflight snapshot.
- Added a distinct `rebrand-tag-on-main` report row.
- Collected the remote peeled `rebrand-v1` target with `git ls-remote` and
  checked it against local `origin/main` ancestry with `git merge-base
  --is-ancestor`.
- Kept the runner report-only; it does not fetch, create, delete, or re-point
  tags.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts` (RED)
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run typecheck`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Targeted test after implementation:

```text
12 pass
0 fail
39 expect() calls
```

Typecheck:

```text
bun run typecheck:shared
```

exited 0.

Documentation validation:

```text
[agent-contract] ok: 11 skills, 358 tickets, 7 required docs
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

No build was run. This changes the report-only preflight script and tests, not
product runtime behavior.

## 10. Remaining risks

R.11 remains blocked. This slice does not create or re-point tags, create
backup refs, create mirrors, run `git filter-repo`, force-push, or call
`update_goal`.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Regression test fails before implementation | Green | RED run showed the evaluator ignored tag-on-main |
| Regression test passes after implementation | Green | Targeted test reports 12 pass, 0 fail |
| Preflight has a distinct `rebrand-tag-on-main` row | Green | `rebrand-tag-on-main` row added and tested |
| Live preflight reports the current tag-on-main state | Pending | Not rerun yet |
| Documentation/rebrand validation remains green | Green | `typecheck`, `validate:docs`, `validate:rebrand`, and `git diff --check` passed |
| Destructive R.11 actions are not executed | Green | No tag rewrite, backup, mirror, filter-repo, force-push, or update_goal action was run |
| Commit created | Pending | Commit not created yet |
