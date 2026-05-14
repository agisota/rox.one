# T373 - Rebrand R.11 open PR blocker clearance

Status: DONE
Phase: R.11 prerequisite repair
Ticket: docs/tickets/T373-rebrand-r11-open-pr-blocker-clearance.md

## 1. Task summary

Cleared the R.11 `no-open-prs` blocker by resolving the two remaining
conflicting GitHub PRs in isolated worktrees, merging them to `main`, and
rerunning the R.11 preflight.

## 2. Repo context discovered

Fresh preflight before this ticket still failed because PR #171 and PR #189
were open. PR #171 removed `unsafe-inline` from renderer `script-src` CSP
entries. PR #189 added a generic `RouteErrorBoundary` and wrapped settings,
source-info, and skill-info routes.

The active Codex goal remains present, so `ROX_R11_NO_ACTIVE_GOAL=1` would be a
false acknowledgement. Backup tag and offline mirror creation remain blocked.

## 3. Files inspected

- `scripts/rebrand-r11-preflight.ts`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `apps/electron/src/renderer/index.html`
- `apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx`
- `apps/electron/src/renderer/components/RouteErrorBoundary.tsx`
- `apps/electron/src/renderer/components/__tests__/RouteErrorBoundary.rtl.test.tsx`

## 4. Tests added first

No new code test was added in this repair branch. The RED validation was the
existing R.11 preflight `no-open-prs` failure. PR #189 already carried
`RouteErrorBoundary.rtl.test.tsx`; it was run as the targeted behavior check
after conflict resolution.

## 5. Expected failing test output

Preflight before PR cleanup reported open PR blockers:

```text
no-open-prs          fail    #189 feat/per-route-error-boundaries ...; #171 feat/csp-remove-unsafe-inline-script ...
red -- R.11 prerequisite(s) failing
```

## 6. Implementation changes

- Created `/home/dev/worktrees/pr171-csp`, merged `origin/main` into PR #171,
  resolved `apps/electron/src/renderer/index.html`, pushed
  `c673922350346d2a9676c321db62bece5fce6a3b`, and merged PR #171 as
  `6134a88698853296950a29d6751fd655c2bbb041`.
- Created `/home/dev/worktrees/pr189-error-boundaries`, merged `origin/main`
  into PR #189, resolved `MainContentPanel.tsx` by preserving current main's
  lazy/Suspense route loading while adding `RouteErrorBoundary`, pushed
  `cdd3afe82dc93c12945f0400c4857e4c623fbe2d`, and merged PR #189 as
  `4cc20089c15daee7becbcee6149dc87fb39e122f`.
- Fast-forwarded `/home/dev/craft/rox-one-terminal` local `main` from
  `303b0b05` to `4cc20089` after verifying it had no tracked local changes.
- Did not run `git filter-repo`.
- Did not create backup tags, backup branches, offline mirrors, or force-push
  rewritten refs.

## 7. Validation commands run

- `bun install --frozen-lockfile` in each PR worktree
- `bun run validate:docs` in both PR worktrees
- `bun run validate:rebrand` in both PR worktrees and as a pre-push hook
- `git diff --check` in both PR worktrees
- PR #171 CSP scan for `script-src` in four renderer HTML entrypoints
- `bun run electron:build:renderer` in both PR worktrees
- `~/.bun/bin/bunx vitest run --config vitest.config.ts src/renderer/components/__tests__/RouteErrorBoundary.rtl.test.tsx`
- `bun run lint:electron`
- `bun run typecheck:electron`
- `gh pr view 171 --json number,state,mergedAt,mergeCommit,headRefName,url`
- `gh pr view 189 --json number,state,mergedAt,mergeCommit,headRefName,url`
- `gh pr list --state open --json number,title,mergeable,headRefName,url --limit 20`
- `bun run rebrand:r11-preflight`

## 8. Passing test output summary

PR #171 targeted checks:

```text
validate:docs: pass
validate:rebrand: pass
git diff --check: pass
electron:build:renderer: pass
apps/electron/src/renderer/index.html: script-src 'self' 'wasm-unsafe-eval' http://localhost:8097
apps/electron/src/renderer/playground.html: script-src 'self' 'wasm-unsafe-eval' http://localhost:8097
apps/electron/src/renderer/browser-toolbar.html: script-src 'self' 'wasm-unsafe-eval'
apps/electron/src/renderer/browser-empty-state.html: script-src 'self' 'wasm-unsafe-eval'
```

PR #189 targeted checks:

```text
validate:docs: pass
validate:rebrand: pass
git diff --check: pass
electron:build:renderer: pass
RouteErrorBoundary.rtl.test.tsx: 4 tests passed
```

GitHub state after merge:

```text
PR #171 state: MERGED, mergeCommit: 6134a88698853296950a29d6751fd655c2bbb041
PR #189 state: MERGED, mergeCommit: 4cc20089c15daee7becbcee6149dc87fb39e122f
gh pr list --state open: []
```

Fresh R.11 preflight now reports:

```text
no-active-goal       fail    Missing ROX_R11_NO_ACTIVE_GOAL=1 acknowledgement.
no-open-prs          pass    GitHub reports no open PRs.
rebrand-tag          pass    rebrand-v1 is visible on origin.
backup-tag           fail    pre-rebrand-history-rewrite-backup is missing on origin.
offline-mirror       fail    /tmp/rox-one-terminal-backup-2026-05-13.git is missing.
git-filter-repo      pass    git-filter-repo is on PATH.
r11-closeout-ticket  pass    docs/tickets/T298-rebrand-git-history-rewrite.md exists.
main-sync            pass    origin/main...main is 0 0.
worktree-clean       pass    git status --porcelain is empty.

red -- 3 R.11 prerequisite(s) failing
```

## 9. Build output summary

`bun run electron:build:renderer` passed in both PR worktrees. No build was
needed for this documentation-only repair branch commit.

## 10. Remaining risks

R.11 remains blocked. The active Codex goal is still present, and creating the
backup tag or offline mirror before truthfully clearing that gate would violate
the T298 safety contract. `bun run lint:electron` and
`bun run typecheck:electron` were rerun for PR evidence and still fail on
existing current-main issues outside the PR diffs:

- `CheatsheetOverlay.tsx` uses disallowed `shadow-sm`.
- `auto-update.signature.test.ts` mock types infer `updateInfo: null`.
- `BrowserInstanceInfo` fixtures are missing `hungTab`.
- RTL matcher types are missing for `toHaveAttribute` and `toBeDisabled`.
- `TeamManagementSettingsPage.rtl.test.tsx` still passes `"idle"` where
  `TeamManagementStatus` is expected.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| PR #171 is merged or closed with evidence | Green | PR #171 merged as `6134a88698853296950a29d6751fd655c2bbb041` |
| PR #189 is merged or closed with evidence | Green | PR #189 merged as `4cc20089c15daee7becbcee6149dc87fb39e122f` |
| Open PR list is empty | Green | `gh pr list --state open ...` returned `[]` |
| R.11 `no-open-prs` preflight gate passes | Green | Fresh preflight reports `no-open-prs pass` |
| Remaining R.11 blockers are documented | Green | Active goal, backup tag, and offline mirror remain red |
| No destructive R.11 command was run | Green | No `git filter-repo`, backup ref creation, mirror creation, or force-push was run |
