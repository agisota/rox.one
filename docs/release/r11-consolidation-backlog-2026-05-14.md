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
- Latest report-only validation baseline: `e4f3970e`
- T470 current-main validation baseline: `02275b9b`
- Current full-suite evidence: `6910 pass`, `13 skip`, `0 fail`
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

## Full Remaining Worklist

This is the ordered continuation list for R.11. It is intentionally split into
report-only work, operator decisions, backup gates, destructive rewrite work,
and post-rewrite closeout so future turns do not mix safe evidence refreshes
with irreversible ref or history operations.

Current gate snapshot:

- Open PRs: 0
- Latest report-only validation baseline: `e4f3970e`
- T470 current-main validation baseline: `02275b9b`
- Current full-suite evidence: `6910 pass`, `13 skip`, `0 fail`
- Remote branches requiring review: 150
- Default preflight blockers: `no-active-goal`, `fork-review`, `rebrand-tag-local-sync`, `rebrand-tag-on-main`
- Pre-rewrite blockers: `fork-review`, `rebrand-tag-local-sync`, `rebrand-tag-on-main`, `backup-tag`, `backup-branch`, `offline-mirror`, `remote-branch-review`
- Legal-preserve blockers: `legal-file-LICENSE`, `legal-file-NOTICE`,
  `legal-file-TRADEMARK.md`
- History scan findings: 81 forbidden-token patch lines

Do not delete remote branches or mutate tags until an operator-owned destructive window is explicit.
Do not create backup refs, create mirrors, run `git filter-repo`, force-push,
clear `/goal`, or call `update_goal` while the report-only gates remain red.

### Phase 0 - Keep report-only evidence fresh

- Re-run `bun run rebrand:r11-preflight` after each report-only commit and
  record the 4 expected default blockers while the active goal remains in
  progress.
- Re-run
  `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`
  when any fork, tag, branch, backup, or worktree evidence changes.
- Keep `docs/release/r11-completion-audit-2026-05-14.md`,
  `docs/release/r11-blocker-inventory-index-2026-05-14.md`, and this backlog
  aligned with fresh evidence.
- Keep ticket and 11-section worklog evidence green for every report-only
  change.

### Phase 1 - Operator decisions before unblock

- Decide when the active `/goal` state is intentionally handed into a
  destructive R.11 window. Until that point, keep `no-active-goal` red.
- Re-fetch GitHub fork state and choose a fork policy. Current evidence is 1
  visible fork, `dofaromg/rox-one-terminal`, against expected count 0.
- Reconcile `rebrand-v1` tag drift. Current local target is
  `906896e145156d92cf98457c4dc1893c53323bac`; origin target is
  `b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99`; the origin target is not on
  `origin/main` ancestry.
- Do not set `ROX_R11_EXPECTED_FORKS`, mutate `rebrand-v1`, or clear `/goal`
  until the destructive window and operator policy are explicit.

### Phase 2 - Remote branch retirement

- Treat the PR merge queue as clear: there are 0 open PRs and 0 open PR
  branches.
- Review all 150 non-main/non-R.11-backup origin branches before pre-rewrite
  can pass.
- Retire or preserve the 133 merged-PR branch cleanup candidates in an
  operator-approved branch cleanup window.
- Decide the 9 closed/unmerged PR branch review candidates, including
  `fix/t132-main-bundle-regression`.
- Decide the 7 no-visible-PR branch review candidates.
- Account for `backup/agent-workbench-t000-t012-2026-04-30` separately from the
  missing R.11 backup branch.

### Phase 3 - Backup artifact creation

- Create `pre-rebrand-history-rewrite-backup` only after the default
  pre-backup gate is green.
- Create `backup/pre-rebrand-history-rewrite-2026-05-13` only after the default
  pre-backup gate is green.
- Create `/tmp/rox-one-terminal-backup-2026-05-13.git` only after the default
  pre-backup gate is green.
- After those artifacts exist, re-run explicit pre-rewrite mode and require
  `backup-tag-target`, `backup-branch-target`, and `offline-mirror-target` to
  match current `main`.

### Phase 4 - Legal preserve and rewrite readiness

- Re-run `bun run rebrand:r11-legal-preserve` only after the backup tag exists.
- Require `legal-file-LICENSE`, `legal-file-NOTICE`, and
  `legal-file-TRADEMARK.md` to compare cleanly against the backup tag.
- Re-run `bun run rebrand:r11-history-scan` and keep the 81 historical
  findings visible until rewritten ancestry exists.
- Require the pre-rewrite gate to be fully green before any history rewrite
  command is run.

### Phase 5 - Destructive rewrite window

- Run the history rewrite only from real `main`, with clean worktree and
  `origin/main...main` equal to `0 0`.
- Run the approved `git filter-repo` command only after fork, tag, branch,
  backup, legal-preserve, and pre-rewrite rows are green.
- Force-push only with the agreed lease procedure and record the exact command
  transcript.
- Preserve the backup tag, backup branch, and offline mirror until post-rewrite
  validation and rollback review are complete.

### Phase 6 - Post-rewrite closeout

- Re-run `bun run validate:release`, `bun run validate:rebrand`,
  `bun run validate:docs`, `bun run validate:roadmap`, `bun run typecheck`,
  `bun run lint`, full `bun test`, `bun run build`, and `git diff --check`.
- Re-run `bun run rebrand:r11-history-scan` against rewritten ancestry and
  require it to pass.
- Record the rewritten mapping SHA and update
  `docs/release/rebrand-mapping-2026-05-13.md`.
- Add the README 72-hour coordination banner only after rewritten history is
  live.
- Record the post-rewrite commit-count delta and close
  `docs/tickets/T298-rebrand-git-history-rewrite.md` plus its worklog.

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
