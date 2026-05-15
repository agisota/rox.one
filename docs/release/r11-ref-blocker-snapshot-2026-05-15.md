# R.11 Ref Blocker Snapshot - 2026-05-15

Status: REVIEWED FOR REPORT-ONLY HANDOFF

This snapshot refreshes the R.11 ref-related blockers after PR #227 merged into
`main`. It does not authorize tag deletion, tag retargeting, branch deletion,
backup creation, offline mirror creation, `git filter-repo`, force-push,
`/goal` state changes, or `update_goal`.

Source evidence:

```bash
git status --short --branch
git rev-parse origin/main
git rev-parse main
git rev-parse --verify 'rebrand-v1^{commit}'
git for-each-ref refs/tags/rebrand-v1 --format='%(refname) %(objecttype) %(objectname) %(*objecttype) %(*objectname)'
git ls-remote --tags origin 'refs/tags/rebrand-v1' 'refs/tags/rebrand-v1^{}'
git merge-base --is-ancestor 'rebrand-v1^{commit}' origin/main
git branch -r --contains "$(git rev-parse --verify 'rebrand-v1^{commit}')"
git ls-remote --heads origin
bun run rebrand:r11-preflight
ROX_R11_NO_ACTIVE_GOAL=1 ROX_R11_EXPECTED_FORKS=2 bun run rebrand:r11-preflight
ROX_R11_NO_ACTIVE_GOAL=1 ROX_R11_EXPECTED_FORKS=2 bun run rebrand:r11-preflight --stage pre-rewrite
```

Evidence artifact:

- `/tmp/r11-ref-blockers-post-pr227-main-20260515T1138.log`
- SHA-256:
  `40075f721604434982eb86e6b9fd0ec647baf54075ec9be531e0bd9615f3e65f`

## Current Ref State

- `main` and `origin/main`: `0643869f570a1fa684e3fd655390b462d8165a4a`
- Local `rebrand-v1` tag object:
  `e32deed37b33fe3296edde6228adb1f76255027d`
- Local `rebrand-v1` peeled commit:
  `b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99`
- Origin `rebrand-v1` tag object:
  `e32deed37b33fe3296edde6228adb1f76255027d`
- Origin `rebrand-v1` peeled commit:
  `b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99`
- Local and origin peeled commits match: yes
- Origin peeled commit on `origin/main` ancestry: no
- Remote branch containing the peeled commit:
  `origin/chore/rebrand-R10-final-sweep-and-gate`
- Non-`main`, non-R.11-backup origin branch count: 158

## Gate Impact

| Gate | Current state | Evidence |
| --- | --- | --- |
| `rebrand-tag` | pass | `rebrand-v1` is visible on origin |
| `rebrand-tag-local-sync` | pass | Local and origin peel to `b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99` |
| `rebrand-tag-on-main` | fail | `git merge-base --is-ancestor 'rebrand-v1^{commit}' origin/main` exits 1 |
| `remote-branch-review` | fail | Origin has 158 non-`main`, non-R.11-backup branches |
| `worktree-clean` | fail in this session | `.omc/state/last-tool-error.json` is dirty and must not be mixed into R.11 |

## Ancestry Repair Note

A no-retag path would have to change `main` ancestry so the current
`rebrand-v1` peeled commit becomes reachable from `main`. Read-only inspection
shows that is not a clean report-only unblock:

- `main...rebrand-v1^{}` is `347 3`.
- The three commits on `main..rebrand-v1^{}` are:
  - `8dc41f46 docs: land R.10 T296 rebrand-sweep closeout summary`
  - `4e3de8b8 chore: install permanent validate:rebrand gate (T297)`
  - `b817d1c3 docs: record R.10 closeout in master-roadmap-log`
- The existing squash commit `ff687795` and `b817d1c3` have the same tree:
  `532a418f6351006f10de60286df484392f080262`.

That means an ancestry-only merge would reintroduce already-squashed R.10
branch history. Treat this as operator-owned policy work, not an agent-safe
report-only action.

## Required Next Decision

Before R.11 can enter the destructive window, an operator must choose the
accepted tag policy:

- retarget `rebrand-v1` to a commit on `origin/main`, or
- intentionally preserve the current off-main tag and change the gate policy,
  with a documented rationale.

Both options are ref-control decisions. Neither is authorized by this snapshot.
