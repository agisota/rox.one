# Dispatch Packet: W4 Metadata and Release Candidate

Phase: `ORGANIZE` then `VERIFY`

Tickets: `T000`, `T001`, `T002`, `T031`, `T033`, `T034`, `T035`, `T040`

## Objective

Keep metadata synchronized with existing PASS evidence, prune stale worktree metadata only through a safe gate, and create the final release-candidate proof under `T040`.

## Status Drift Closed

These tickets had PASS worklogs and were synchronized from `TODO` to `DONE`:

- `T000-bootstrap-agent-os`
- `T001-repo-cartography`
- `T002-baseline-ci`
- `T031-tdd-mode-task-generation`
- `T033-mac-arm-build`
- `T034-e2e-core-scenario-suite`
- `T035-team-workspace-sharing`

## Remaining Release Work

`T040-final-release-candidate` remains `TODO` because it has no matching worklog and no release-candidate validation evidence.

## Worktree Hygiene

Safe facts:

- `/Users/marklindgreen/Projects/craft/worktrees/T003-*` through `T012-*` are clean and merged.
- `/Users/marklindgreen/Projects/craft-worktrees/telegram-ru-polish` is prunable metadata pointing to a missing path.

Do not prune as part of feature tickets. Prune only after:

1. `git worktree list --porcelain`
2. `git merge-base --is-ancestor <worktree-head> main` for valid worktrees
3. `git status --short` is clean in the main worktree
4. stale entry is recorded in `.swarm/inventory.md`

## T040 Required Worklog

Create `docs/worklog/T040-final-release-candidate.md` before release work with:

- repo status and commit range
- ticket state summary
- validation commands and outputs
- E2E core scenario evidence
- Electron smoke/build evidence
- security/audit known risks
- release notes / user guide / known limitations pointers
- final acceptance matrix

## T040 Gate Commands

- `bun run validate:agent-contract`
- `bun run validate:architecture-docs`
- `bun run validate:ci`
- `bun run e2e:core`
- `bun run electron:smoke`
- `bun run typecheck`
- `bun run typecheck:electron`
- `git diff --check`

Build commands are required only when runtime/build surfaces changed during the release-candidate pass.

## Acceptance

- `T040` stays `TODO` until all release gates are current and recorded.
- Release notes and known limitations exist.
- The app has a fresh run/smoke proof.
- Private origin remains verified before any push.
