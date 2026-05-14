# T397 - R.11 tag prerequisite doc wire

Status: DONE
Phase: R.11 preflight documentation
Ticket: docs/tickets/T397-r11-tag-prereq-doc-wire.md

## 1. Task summary

Align the canonical R.11 runbook with the executable tag-target preflight rows
added by T393 and T395.

## 2. Repo context discovered

The current R.11 preflight helper fails closed on:

- `rebrand-tag-local-sync`;
- `rebrand-tag-on-main`.

The R.11 hard-prerequisite list still only states that `rebrand-v1` exists,
and the spine still describes R.11 as having exactly nine hard prerequisites.
That count is stale once the tag-target gates are documented.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`

## 4. Tests added first

Added the documentation regression to
`scripts/__tests__/rebrand-r11-preflight.test.ts` before editing the goal
files. It asserts:

- the rebrand-sweep R.11 goal names the origin tag-on-main prerequisite;
- the rebrand-sweep R.11 goal names the local/remote tag-sync prerequisite;
- the spine no longer says the stale exact count "nine hard prerequisites";
- the spine still states that R.11 has hard prerequisites.

## 5. Expected failing test output

RED run:

```text
(fail) R.11 goal documentation > documents the tag-target prerequisites enforced by the preflight runner
Expected to contain: "origin `rebrand-v1` target is on `origin/main` ancestry"

13 pass
1 fail
43 expect() calls
```

The failure proved the canonical runbook had not been updated for the T393 and
T395 tag-target gates.

## 6. Implementation changes

- Added the origin tag-on-main prerequisite to the R.11 hard-prerequisite list.
- Added the local/remote tag-sync prerequisite to the R.11 hard-prerequisite
  list.
- Renumbered the local worktree and main-sync prerequisites.
- Updated the spine wording from "R.11 has nine hard prerequisites" to
  "R.11 has hard prerequisites".
- Did not change any R.11 command sequence.
- Did not re-point `rebrand-v1`, create backup artifacts, run `git
  filter-repo`, force-push, or call `update_goal`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Targeted test:

```text
14 pass
0 fail
46 expect() calls
```

Documentation/rebrand/whitespace validation is run after this worklog update.

## 9. Build output summary

No build was run. This is a documentation/test alignment slice.

## 10. Remaining risks

R.11 remains blocked by active goal state, local/remote tag drift, off-main
`rebrand-v1`, and missing backup artifacts. This ticket does not execute any
destructive R.11 command.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Regression test fails before documentation update | Green | RED run showed the R.11 goal lacked the tag-on-main text |
| Regression test passes after documentation update | Green | Targeted test reports 14 pass, 0 fail |
| R.11 hard-prerequisite list includes tag-on-main | Green | Rebrand-sweep goal prerequisite list updated |
| R.11 hard-prerequisite list includes local/remote tag sync | Green | Rebrand-sweep goal prerequisite list updated |
| Spine text no longer says the stale "nine hard prerequisites" count | Green | Spine wording updated |
| Documentation/rebrand validation remains green | Green | `validate:docs`, `validate:rebrand`, and `git diff --check` passed |
| Destructive R.11 actions are not executed | Green | No tag rewrite, backup, mirror, filter-repo, force-push, or update_goal action was run |
| Commit created | Green | Lore commit created for this ticket |
