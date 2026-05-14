# T395 - R.11 preflight local tag sync check

Status: DONE
Phase: R.11 preflight hardening
Ticket: docs/tickets/T395-r11-preflight-local-tag-sync-check.md

## 1. Task summary

Add a fail-closed R.11 preflight check for local-vs-origin `rebrand-v1` tag
target drift so the eventual destructive tag push cannot start from stale local
tag state.

## 2. Repo context discovered

Current read-only tag evidence:

```text
origin refs/tags/rebrand-v1      e32deed37b33fe3296edde6228adb1f76255027d
origin refs/tags/rebrand-v1^{}   b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99
local refs/tags/rebrand-v1       8e30f545169e52daa2763659d6c562a699a2575b
local refs/tags/rebrand-v1^{}    906896e145156d92cf98457c4dc1893c53323bac
```

The remote peeled target `b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99` is not on
`origin/main` ancestry. The local peeled target also differs from the remote.
The existing `rebrand-tag-on-main` row catches the ancestry issue, but does not
make local tag drift explicit.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `docs/tickets/T351-rebrand-r11-preflight-handoff.md`
- `docs/worklog/T351-rebrand-r11-preflight-handoff.md`
- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`

## 4. Tests added first

Added two focused regressions to
`scripts/__tests__/rebrand-r11-preflight.test.ts` before production code:

- `evaluateR11Preflight` fails closed when the local `rebrand-v1` tag target
  differs from origin.
- The aggregate "reports every blocker" test includes
  `rebrand-tag-local-sync`.

## 5. Expected failing test output

RED run:

```text
(fail) evaluateR11Preflight > fails closed when the local rebrand-v1 tag target differs from origin
Expected: false
Received: true

(fail) evaluateR11Preflight > reports every blocker instead of stopping after the first red check
Expected length: 14
Received length: 13

11 pass
2 fail
33 expect() calls
```

The failure proved the evaluator ignored local-vs-origin tag drift.

## 6. Implementation changes

- Added `rebrandTagLocalMatchesRemote` to the R.11 preflight snapshot.
- Added a distinct `rebrand-tag-local-sync` report row.
- Collected local-vs-origin tag parity with read-only git commands:
  origin's peeled `refs/tags/rebrand-v1^{}` is compared with local
  `rebrand-v1^{commit}`.
- Kept the existing `rebrand-tag-on-main` ancestry gate separate.
- Updated T298's blocker surface to record the tag drift.
- Did not fetch, create, delete, re-point, or push any tag.
- Did not create backup refs, mirrors, rewritten history, force-push, or call
  `update_goal`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run typecheck`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`
- `git status --short --branch`
- `git rev-parse --short HEAD`
- `git rev-parse --short origin/main`

## 8. Passing test output summary

Targeted test:

```text
13 pass
0 fail
42 expect() calls
```

Typecheck:

```text
$ bun run typecheck:shared
$ cd packages/shared && bun run tsc --noEmit
```

exited 0.

Documentation validation:

```text
[agent-contract] ok: 11 skills, 360 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /home/dev/craft/rox-one-terminal/docs/architecture/sync-v2-design.md
```

Rebrand validation:

```text
rebrand validation passed: no forbidden tokens outside the allowlist
```

Pre-commit default preflight:

```text
no-active-goal          fail    Missing ROX_R11_NO_ACTIVE_GOAL=1 ac...
rebrand-tag             pass    rebrand-v1 is visible on origin.
rebrand-tag-local-sync  fail    Local rebrand-v1 target differs fro...
rebrand-tag-on-main     fail    rebrand-v1 target is missing from o...
worktree-clean          fail    git status --porcelain is not empty.
red - 4 R.11 pre-backup prerequisite(s) failing
```

Pre-commit explicit pre-rewrite preflight:

```text
rebrand-tag-local-sync  fail    Local rebrand-v1 target differs fro...
rebrand-tag-on-main     fail    rebrand-v1 target is missing from o...
backup-tag              fail    pre-rebrand-history-rewrite-backup ...
backup-branch           fail    backup/pre-rebrand-history-rewrite-...
offline-mirror          fail    /tmp/rox-one-terminal-backup-2026-0...
worktree-clean          fail    git status --porcelain is not empty.
red - 6 R.11 pre-rewrite prerequisite(s) failing
```

The dirty worktree failure is expected before the T395 commit. A post-push
rerun must verify `worktree-clean` and `main-sync` return to pass.

Post-push sync:

```text
## main...origin/main
8be58252
8be58252
```

Post-push default pre-backup preflight:

```text
no-active-goal          fail    Missing ROX_R11_NO_ACTIVE_GOAL=1 ac...
rebrand-tag             pass    rebrand-v1 is visible on origin.
rebrand-tag-local-sync  fail    Local rebrand-v1 target differs fro...
rebrand-tag-on-main     fail    rebrand-v1 target is missing from o...
main-sync               pass    origin/main...main is 0 0.
worktree-clean          pass    git status --porcelain is empty.
red - 3 R.11 pre-backup prerequisite(s) failing
```

Post-push explicit pre-rewrite preflight:

```text
rebrand-tag             pass    rebrand-v1 is visible on origin.
rebrand-tag-local-sync  fail    Local rebrand-v1 target differs fro...
rebrand-tag-on-main     fail    rebrand-v1 target is missing from o...
backup-tag              fail    pre-rebrand-history-rewrite-backup ...
backup-branch           fail    backup/pre-rebrand-history-rewrite-...
offline-mirror          fail    /tmp/rox-one-terminal-backup-2026-0...
main-sync               pass    origin/main...main is 0 0.
worktree-clean          pass    git status --porcelain is empty.
red - 5 R.11 pre-rewrite prerequisite(s) failing
```

## 9. Build output summary

No build was run. This changes a report-only release preflight script and its
focused tests, not product runtime behavior.

## 10. Remaining risks

R.11 remains blocked by active goal state, local/remote tag drift, off-main
`rebrand-v1`, and missing backup artifacts. Backup creation, tag re-pointing,
`git filter-repo`, force-push, and `update_goal` remain unexecuted.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Regression test fails before implementation | Green | RED run showed the evaluator ignored local/remote tag drift |
| Regression test passes after implementation | Green | Targeted test reports 13 pass, 0 fail |
| Preflight has a distinct `rebrand-tag-local-sync` row | Green | Row added and tested |
| Live preflight reports the local/remote tag mismatch | Green | Post-push live preflight reports `rebrand-tag-local-sync` fail |
| T298 blocker surface records the mismatch | Green | T298 table and current evidence updated |
| Documentation/rebrand validation remains green | Green | `typecheck`, `validate:docs`, and `validate:rebrand` passed |
| Destructive R.11 actions are not executed | Green | No tag rewrite, backup, mirror, filter-repo, force-push, or update_goal action was run |
| Commit created | Green | Lore commit `8be58252` created and pushed |
