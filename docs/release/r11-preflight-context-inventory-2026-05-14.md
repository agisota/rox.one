# R.11 Preflight Context Inventory - 2026-05-14

Status: PREFLIGHT CONTEXT BLOCKERS

This report is read-only evidence for volatile R.11 preflight context rows. It
does not authorize destructive R.11 work, clearing `/goal`, merging PRs,
changing local branch refs, mutating tags, creating backup artifacts, invoking
`git filter-repo`, force-pushing, cleaning branches, or contacting fork owners.

Source commands:

```bash
bun run rebrand:r11-preflight
ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite
gh pr list --state open --json number,title,headRefName,baseRefName,url --limit 20
git status --short --branch
git rev-parse --short HEAD
git rev-parse --short main
git rev-parse --short origin/main
git rev-list --left-right --count main...origin/main
```

## Summary

- Open PRs: 2
- Current checkout: `fix/renderer-prod-sourcemap-leak`
- Primary worktree `HEAD`: `dfb730f7`
- Local `main`: `8ce67b4d`
- Origin `main`: `16c8321b`
- main...origin/main: `1 2`
- Worktree clean: yes, `git status --porcelain is empty`
- Default pre-backup preflight blockers: 7
- Explicit pre-rewrite preflight blockers: 10

## Open PR Inventory

| PR | Head | Base | Title | URL |
| --- | --- | --- | --- | --- |
| #207 | `fix/renderer-prod-sourcemap-leak` | `main` | fix(renderer): disable sourcemaps in production build (T132/RC1 blocker) | https://github.com/agisota/rox-one-terminal/pull/207 |
| #208 | `chore/bundle-budget-pdf-worker-carveout` | `main` | chore(bundle-budget): carve out pdf.worker (lazy worker, T132 budget exception) | https://github.com/agisota/rox-one-terminal/pull/208 |

## Preflight Rows

| Row | Status | Evidence |
| --- | --- | --- |
| `no-open-prs` | fail | PR #207 and PR #208 are open against `main` |
| `current-branch` | fail | Current checkout is `fix/renderer-prod-sourcemap-leak`; switch to `main` before R.11 |
| `main-sync` | fail | `origin/main...main` is not `0 0`; observed `main...origin/main` is `1 2` |
| `worktree-clean` | pass | `git status --porcelain` is empty |

## Operator Notes

The open PRs and local checkout/main-sync rows must be resolved by the operator
before any future R.11 destructive window. This inventory is a blocker snapshot,
not a cleanup instruction.
