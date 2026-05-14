# R.11 Consolidation Backlog - 2026-05-14

Status: ACTIVE CONSOLIDATION BACKLOG

This is the single current execution surface for the post-merge/R.11 cleanup
queue. It is report-only evidence. No branch deletion, tag mutation, backup ref
creation, mirror creation, filter-repo, force-push, or PR merge was authorized
by this artifact.

No branch deletion, tag mutation, backup ref creation, mirror creation, filter-repo, force-push, or PR merge was authorized by this artifact.

## Current Baseline

- origin/main: `2fa129f3`
- Local `main`: `2fa129f3`
- Report-only branch: `report/r11-t463-consolidation-backlog`
- Open PRs: `#214`
- Origin heads: `149`
- R.11 branch blocker count: `148 non-main/non-R.11-backup`

## Already Integrated

PRs #207 through #213 are merged into `origin/main`:

- #207 `fix/renderer-prod-sourcemap-leak`
- #208 `chore/bundle-budget-pdf-worker-carveout`
- #209 `feat/M13-T086d-abuse-guard-remaining-handlers`
- #210 `feat/M10-T237c-drag-from-other-apps`
- #211 `feat/M10-T240c-cheatsheet-i18n`
- #212 `feat/M18-T253b-linux-deb-rpm`
- #213 `feat/M14-T250-rpc-admin-audit-list`

## Open PR Queue

| PR | Head | Status | Required next action |
| --- | --- | --- | --- |
| #214 | `fix/t132-main-bundle-regression` | Mergeable, CI blocked by GitHub account billing lock | Resolve account billing lock, rerun checks, then merge only after green or explicitly accepted |

## Remote Branch Cleanup Matrix

The current R.11 branch-review blocker is not a code merge queue; it is a
remote-ref hygiene gate before destructive history rewrite.

| Category | Count | Disposition |
| --- | ---: | --- |
| Merged PR branch cleanup candidates | 132 | Safe candidates for operator-approved remote branch retirement after verification |
| Open PR branches | 1 | Retain `fix/t132-main-bundle-regression` until PR #214 is merged or closed |
| Obvious backup/protected branches | 2 | Retain `main`; review `backup/agent-workbench-t000-t012-2026-04-30` separately from the R.11 backup branch |
| Operator-review branches | 14 | Review closed-PR/no-PR branches before any deletion or preservation decision |

Summary: 132 merged PR branch cleanup candidates and 14 operator-review
branches remain before the R.11 remote-branch gate can be green.

The 14 operator-review branches are:

- `chore/bundle-shrinkage-findings`
- `chore/deps-cve-overrides`
- `feat/audit-a2-runtime`
- `feat/audit-a3-taste`
- `feat/audit-a4-e2e-flows`
- `feat/audit-harness-aggregate`
- `feat/d-a11y-perf-budgets`
- `feat/M13-T038-input-validation-hardening`
- `feat/M14-T246-audit-wire`
- `feat/M17-private-release-pipeline`
- `feat/M6-sqlite-persistence-adapter`
- `feat/audit-harness-spec`
- `feat/f1-shiki-engine-swap`
- `mac/rox-production-ready-rc`

## R.11 Blocker Queue

1. Resolve PR #214 and rerun GitHub checks after the account billing lock is
   cleared.
2. Keep `no-active-goal` as a hard stop until an operator-controlled
   destructive R.11 window begins.
3. Re-review fork policy: current fork count is `1`, default expected count is
   `0`.
4. Reconcile `rebrand-v1`: local target
   `906896e145156d92cf98457c4dc1893c53323bac`, origin target
   `b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99`, and origin target is not on
   `origin/main` ancestry.
5. Switch the destructive-window checkout to real `main`; report branches keep
   `current-branch` red by design.
6. Complete remote branch review so explicit pre-rewrite mode no longer sees
   `148 non-main/non-R.11-backup` branches.
7. Only after the pre-backup gate is green, create the R.11 backup tag, backup
   branch, and offline mirror.
8. Rerun explicit pre-rewrite mode and require backup target rows to pass.
9. Run legal-preserve against the backup tag.
10. Execute destructive R.11 rewrite, force-push with lease, and record the
    exact command transcript.
11. Run post-rewrite validation and history scan, then close mapping SHA,
    README banner, and commit-count delta artifacts.

## Validation Debt

Required before release/R.11 closeout:

- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`
- `bun run rebrand:r11-legal-preserve`
- `bun run rebrand:r11-history-scan`
- `bun run validate:release`
- `bun run validate:rebrand`
- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `git diff --check`

The current main validation evidence is pre-rewrite only. It cannot satisfy the
post-rewrite requirement until rewritten ancestry exists.

## Stop Rule

Continue with non-destructive inventory, docs, tests, and local validation.
Stop before destructive R.11 gates unless the required preflight rows are green
and the operator-controlled destructive window is explicit.
