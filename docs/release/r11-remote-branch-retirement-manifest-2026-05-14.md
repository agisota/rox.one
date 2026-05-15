# R.11 Remote Branch Retirement Manifest - 2026-05-14

Status: OPERATOR REVIEW MANIFEST

This report turns the live `remote-branch-review` blocker into operator-owned
review buckets. No branch deletion, pruning, merging, preservation, tag
mutation, backup creation, `git filter-repo`, force-push, or goal completion is
authorized by this manifest.

No branch deletion, pruning, merging, preservation, tag mutation, backup creation, `git filter-repo`, force-push, or goal completion is authorized by this manifest.

Source evidence:

```bash
gh pr list --repo agisota/rox-one-terminal --state open --limit 200 --json number
gh pr list --repo agisota/rox-one-terminal --state all --limit 1000 --json number,state,headRefName
git ls-remote --heads origin
```

Related full inventory:

- `docs/release/r11-remote-branch-review-2026-05-14.md`

## Summary

- Total origin heads: 158
- Non-main/non-R.11-backup origin branches: 157
- Open PR branches: 0
- Merged PR branch heads: 139
- Closed/unmerged PR branch heads: 9
- No-visible-PR branch heads: 8
- Backup/protected branch heads: 1

`R.11` is absent on origin at this snapshot. The required R.11 backup branch
`backup/pre-rebrand-history-rewrite-2026-05-13` is also absent and must not be
created until the default pre-backup gate is green.

## Bucket Policy

| Bucket | Count | Operator decision required |
| --- | ---: | --- |
| Open PR branches | 0 | No merge-queue blocker remains |
| Merged PR branch heads | 139 | Usually retirement candidates after verifying each PR merged and no active worktree still depends on the head |
| Closed/unmerged PR branch heads | 9 | Review manually; preserve only if the closed PR still carries needed work |
| No-visible-PR branch heads | 8 | Review manually because current GitHub PR metadata has no matching head |
| Backup/protected branch heads | 1 | Preserve or explicitly account for before any R.11 destructive window |

## Manual Review Branches

Closed/unmerged PR branch heads:

- `chore/bundle-shrinkage-findings` (#6)
- `chore/deps-cve-overrides` (#119)
- `feat/M16-T132e-shrink-main-chunk-direct` (#215)
- `feat/audit-a2-runtime` (#2)
- `feat/audit-a3-taste` (#4)
- `feat/audit-a4-e2e-flows` (#3)
- `feat/audit-harness-aggregate` (#23)
- `feat/d-a11y-perf-budgets` (#5)
- `fix/t132-main-bundle-regression` (#214)

No-visible-PR branch heads:

- `feat/M13-T038-input-validation-hardening`
- `feat/M14-T246-audit-wire`
- `feat/M17-private-release-pipeline`
- `feat/M6-sqlite-persistence-adapter`
- `feat/audit-harness-spec`
- `feat/f1-shiki-engine-swap`
- `circleci-project-setup`
- `mac/rox-production-ready-rc`

Backup/protected branch head:

- `backup/agent-workbench-t000-t012-2026-04-30`

Merged PR heads that still exist on origin include recent closeout branches:

- `chore/r11-t473-post-t470-audit-refresh` (#217)
- `docs/m21-prep-checklist` (#220)
- `fix/ci-ripgrep-github-token-auth` (#219)
- `fix/post-218-validation-closeout` (#222)
- `fix/t474-shiki-codeblock-timeout` (#218)
- `fix/user-data-migration-self-copy-guard` (#221)
- `feat/M16-T132e-shrink-main-chunk`

The complete 157-row branch inventory is preserved in
`docs/release/r11-remote-branch-review-2026-05-14.md`.

## Dry-run review commands

Dry-run review commands to run before any destructive branch operation:

```bash
gh pr list --repo agisota/rox-one-terminal --state all --limit 1000 \
  --json number,state,headRefName,mergedAt,closedAt,title
git ls-remote --heads origin
git worktree list --porcelain
git branch -r --contains origin/main
```

Potential deletion command shape, recorded only so an operator can review the
exact destructive surface:

```bash
git push origin --delete <branch-name>
```

Do not run the delete commands until an operator-owned destructive window is explicit.
Before that point, re-fetch the branch list, account for dependent worktrees,
and require the R.11 preflight owner to accept the final retirement set.

## R.11 Gate Impact

This manifest does not make `remote-branch-review` pass. The pre-rewrite gate
will remain red until origin exposes only `main` and the required R.11 backup
branch for the destructive rewrite window.
