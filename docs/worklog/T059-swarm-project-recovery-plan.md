# T059 - Swarm Project Recovery Plan

## 1. Task summary

Created the control-plane artifacts for finishing Agent Workbench Suite safely: swarm specification, phased execution plan, inventory, and config. Also normalized the ticket/worklog metadata drift discovered during the audit.

## 2. Repo context discovered

- Repo path: `/Users/marklindgreen/Projects/craft/craft`.
- Branch: `main`.
- Baseline working tree: clean before T059 edits.
- `main` was ahead of `origin/main` by 21 commits.
- `origin` is `https://github.com/agisota/rox-one-terminal.git`.
- GitHub reports `agisota/rox-one-terminal` as private.
- `.swarm/` was absent in the live repo.
- `docs/tickets` contained 48 ticket files.
- `docs/worklog` contained 57 worklog files.
- T003-T012 worktree HEADs are all ancestors of `main`.
- One stale `codex/telegram-ru-polish` worktree is prunable.
- Initial critic gate failed because the plan had only a generic worker template, unsafe T032 ordering, no concrete dispatch packet, and incomplete safe push rules.

## 3. Files inspected

- `AGENTS.md`
- `package.json`
- `docs/tickets/README.md`
- `docs/worklog/README.md`
- `docs/tickets/T041-experience-layer-system.md`
- `docs/worklog/T041-experience-layer-system.md`
- `docs/tickets/T058-upstream-session-refresh-recovery.md`
- `docs/worklog/T058-upstream-v0.9.0-session-refresh.md`
- `git worktree list --porcelain` output
- `git remote -v` output

## 4. Tests added first

No production tests were added because T059 only changes planning/docs metadata.

Read-only validation checks were run before edits and served as the control checks:

- `.swarm/` absence.
- T041 missing `Status:`.
- T058 exact worklog slug missing.
- T003-T012 worktrees merged and clean.
- Private origin verified.

## 5. Expected failing test output

Expected pre-edit control failures:

- `.swarm/` not found.
- `docs/tickets/T041-experience-layer-system.md` had no `Status:` line.
- `docs/worklog/T058-upstream-session-refresh-recovery.md` did not exist.

## 6. Implementation changes

- Added `.swarm/config.json`.
- Added `.swarm/spec.md`.
- Added `.swarm/plan.md`.
- Added `.swarm/inventory.md`.
- Added `Status: DONE` to `docs/tickets/T041-experience-layer-system.md`.
- Added `docs/worklog/T058-upstream-session-refresh-recovery.md` as a matching alias to the detailed T058 evidence.
- Added `docs/tickets/T059-swarm-project-recovery-plan.md`.
- Added this worklog.
- Expanded `docs/tickets/T032-github-worktree-integration.md` into a self-contained dispatchable ticket.
- Added `docs/worklog/T032-github-worktree-integration.md` as the initial matching T032 worklog.
- Added `.swarm/dispatch/T032-github-worktree-integration.md`.
- Updated `.swarm/plan.md` with concrete T032 test-first ordering and safe git/push rules.

## 7. Validation commands run

- `bun run validate:agent-contract` - pass
- `bun run validate:architecture-docs` - pass
- `bun run validate:ci-contract` - pass
- `git diff --check` - pass
- `git status --short --branch` - inspected changed scope
- Critic re-check - pass
- `gh repo view agisota/rox-one-terminal --json nameWithOwner,visibility,isPrivate` - pass/private
- `git remote get-url origin` - pass/private remote URL

## 8. Passing test output summary

- `bun run validate:agent-contract`: `[agent-contract] ok: 11 skills, 48 tickets, 7 required docs`
- `bun run validate:architecture-docs`: `[architecture-docs] ok: 4 docs, 10 subsystem headings`
- `bun run validate:ci-contract`: `[ci-contract] ok: workflow, package scripts, and validator fixture checks passed`
- `git diff --check`: no whitespace errors
- Critic re-check: `PASS`; no blockers remain before T059 commit.
- GitHub private check: `{"isPrivate":true,"nameWithOwner":"agisota/rox-one-terminal","visibility":"PRIVATE"}`

## 9. Build output summary

No build required for docs/control-plane changes.

## 10. Remaining risks

- Repo-wide tests are known from prior T058 worklog to have unrelated failures. T059 does not claim release readiness.
- Worker execution is still pending; `.swarm/plan.md` intentionally gates EXECUTE behind validation and critic review.
- Worktree pruning is documented but not performed in this task.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---:|---|
| `.swarm/spec.md` exists | DONE | `.swarm/spec.md` |
| `.swarm/plan.md` exists | DONE | `.swarm/plan.md` |
| `.swarm/inventory.md` exists | DONE | `.swarm/inventory.md` |
| `.swarm/config.json` exists | DONE | `.swarm/config.json` |
| T041 status normalized | DONE | `Status: DONE` |
| T058 matching worklog slug exists | DONE | `docs/worklog/T058-upstream-session-refresh-recovery.md` |
| T032 dispatch packet exists | DONE | `.swarm/dispatch/T032-github-worktree-integration.md` |
| Validation commands pass | DONE | agent-contract, architecture-docs, ci-contract, diff-check, critic re-check |
| Scoped commit exists | DONE | This T059 Lore commit |
