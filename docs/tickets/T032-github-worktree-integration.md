# T032-github-worktree-integration

Status: DONE

## Context

The project uses a private GitHub remote (`origin -> agisota/rox-one-terminal`) and multiple local Git worktrees for ticket execution. The current recovery audit found clean, merged T003-T012 feature worktrees, one prunable stale worktree, and `main` ahead of `origin/main`.

This ticket creates the safe Git/worktree execution surface needed before broad parallel implementation.

## Goal

Implement and document a GitHub/worktree integration layer that can:

- inventory worktrees
- classify clean/dirty/prunable/merged/unmerged branches
- generate safe worker branch/worktree names
- enforce exact staging allowlists
- block force-push/destructive prune by default
- verify private `origin` before push automation
- produce evidence for supervisor dispatch gates

## Required UI

No product UI required for the first implementation. If a UI surface is added later, it must be a read-only operations/admin screen with empty/loading/error states.

## Required Data/API

Create typed contracts or validation helpers for:

- `WorktreeInventoryEntry`
- `WorktreeClassification`
- `GitRemotePolicy`
- `StagingAllowlist`
- `PushPolicy`
- `DispatchGitEvidence`

The implementation should prefer pure parsing/classification functions and deterministic command-runner adapters so tests do not mutate real Git state.

## Required Automations

- Worktree inventory before worker dispatch.
- Staging allowlist before commit.
- Private remote verification before push.
- No-force push rule unless an explicit destructive approval artifact exists.
- Prune recommendations only; pruning is not automatic in this ticket.

## TDD Requirements

Before implementation:

1. Write unit tests for parsing `git worktree list --porcelain`.
2. Write classification tests for clean, dirty, prunable, merged, unmerged, and missing-upstream cases.
3. Write policy tests that block force-push and wrong remotes.
4. Write staging allowlist tests that reject unrelated files.
5. Confirm expected red output before feature code.

Required loop:

1. Inspect repo context.
2. Write tests or validation checks first.
3. Confirm expected failure.
4. Implement minimal change.
5. Run targeted checks.
6. Run full relevant validation.
7. Update matching worklog.
8. Commit.

## Validation Commands

At minimum:

- targeted unit tests for Git/worktree helpers
- `bun run validate:agent-contract`
- `git diff --check`
- `git status --short --branch`

Run broader typecheck/lint only if TypeScript runtime/source files are changed.

## Acceptance Criteria

- [ ] Matching worklog exists before implementation starts.
- [ ] Worktree parser and classifier are deterministic and tested.
- [ ] Private origin policy is tested.
- [ ] Force-push is blocked by default.
- [ ] Staging allowlist rejects unrelated files.
- [ ] Prunable worktrees are recommendation-only, not auto-deleted.
- [ ] Worker dispatch can consume the evidence shape.
- [ ] Targeted tests pass.
- [ ] Relevant validation commands pass.
- [ ] Worklog complete.
- [ ] Scoped commit created.
