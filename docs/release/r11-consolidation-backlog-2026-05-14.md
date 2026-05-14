# R.11 Consolidation Backlog - 2026-05-14

Status: ACTIVE CONSOLIDATION BACKLOG

This is the single current execution surface for the post-merge/R.11 cleanup
queue. It is report-only evidence. No branch deletion, tag mutation, backup ref
creation, mirror creation, filter-repo, force-push, or PR merge was authorized
by this artifact.

No branch deletion, tag mutation, backup ref creation, mirror creation, filter-repo, force-push, or PR merge was authorized by this artifact.

## Current Baseline

- Pre-T463 origin/main baseline: `2fa129f3`
- Landed branch: `main`
- Authoring branch: `report/r11-t463-consolidation-backlog`
- T464 live refresh baseline: `8923923e`
- T464 post-PR-closeout live baseline: `0b0a218f`
- Open PRs: none
- PR queue status: cleared after PR #216 merged and PR #214 closed unmerged
- Origin heads: `151`
- R.11 branch blocker count: `150 non-main/non-R.11-backup`

## Already Integrated

PRs #207 through #213 and #216 are merged into `origin/main`:

- #207 `fix/renderer-prod-sourcemap-leak`
- #208 `chore/bundle-budget-pdf-worker-carveout`
- #209 `feat/M13-T086d-abuse-guard-remaining-handlers`
- #210 `feat/M10-T237c-drag-from-other-apps`
- #211 `feat/M10-T240c-cheatsheet-i18n`
- #212 `feat/M18-T253b-linux-deb-rpm`
- #213 `feat/M14-T250-rpc-admin-audit-list`
- #216 `feat/M16-T132e-shrink-main-chunk`

PR #216 merged into `origin/main` as `0b0a218f`. PR #214 closed without merge
after local validation showed it could merge cleanly over the earlier
T464 baseline; it did not land on `origin/main`.

## PR Queue

| PR | Head | Status | Required next action |
| --- | --- | --- | --- |
| #214 | `fix/t132-main-bundle-regression` | Closed unmerged at 2026-05-14T09:59:58Z | Decide whether the remaining remote branch should be deleted or preserved during branch review |
| #216 | `feat/M16-T132e-shrink-main-chunk` | Merged at 2026-05-14T09:59:33Z as `0b0a218f` | No PR merge action remains; branch cleanup is still operator-owned |

## Local PR Merge Evidence

These checks do not replace GitHub CI. They prove the PR heads were locally
mergeable and validated over `origin/main` at `8923923e` before GitHub state
changed.

| PR | Local merge result | Local validation evidence |
| --- | --- | --- |
| #214 | Clean no-commit merge over `8923923e`; head `78104413` | `bun run typecheck`; `bun run lint` with existing 7 warnings; `bun run electron:build:renderer`; `bun run validate:bundle-policy`; `bun run validate:bundle-budget` with `main-1y7s7wwf.js` at 389202 gzip bytes |
| #216 | Clean no-commit merge over `8923923e`; head `61f1a691` | `bun run typecheck`; `bun run lint` with existing 7 warnings; `git diff --check`; `bun run electron:build:renderer`; `bun run validate:bundle-policy`; `bun run validate:bundle-budget` with `main-BHwce3Eh.js` at 354435 gzip bytes |

## Remote Branch Cleanup Matrix

The current R.11 branch-review blocker is not a code merge queue; it is a
remote-ref hygiene gate before destructive history rewrite.

| Category | Count | Disposition |
| --- | ---: | --- |
| Merged PR branch cleanup candidates | 133 | Candidate remote branches whose matching PR is merged; retire only in an operator-approved cleanup window |
| Open PR branches | 0 | No open PR branch blocks the merge queue now |
| Closed/unmerged PR branch review candidates | 9 | Review before deleting or preserving because their PRs did not merge |
| No-visible-PR branch review candidates | 7 | Review manually because GitHub PR metadata is absent from the current API window |
| Obvious backup/protected branches | 1 | Retain or explicitly account for `backup/agent-workbench-t000-t012-2026-04-30` separately from the R.11 backup branch |

Summary: 150 origin branch review candidates remain before the R.11
remote-branch gate can be green. There are 0 open PR branches.

The 17 closed/no-visible-PR/backup review branches are:

- `backup/agent-workbench-t000-t012-2026-04-30`
- `chore/bundle-shrinkage-findings`
- `chore/deps-cve-overrides`
- `feat/M16-T132e-shrink-main-chunk-direct`
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
- `fix/t132-main-bundle-regression`
- `mac/rox-production-ready-rc`

## R.11 Blocker Queue

1. Keep `no-active-goal` as a hard stop until an operator-controlled
   destructive R.11 window begins.
2. Re-review fork policy: current fork count is `1`, default expected count is
   `0`.
3. Reconcile `rebrand-v1`: local target
   `906896e145156d92cf98457c4dc1893c53323bac`, origin target
   `b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99`, and origin target is not on
   `origin/main` ancestry.
4. Keep the destructive-window checkout on real `main`; do not run destructive
   R.11 commands from report branches.
5. Complete remote branch review so explicit pre-rewrite mode no longer sees
   `150 non-main/non-R.11-backup` branches.
6. Only after the pre-backup gate is green, create the R.11 backup tag, backup
   branch, and offline mirror.
7. Rerun explicit pre-rewrite mode and require backup target rows to pass.
8. Run legal-preserve against the backup tag.
9. Execute destructive R.11 rewrite, force-push with lease, and record the
    exact command transcript.
10. Run post-rewrite validation and history scan, then close mapping SHA,
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
