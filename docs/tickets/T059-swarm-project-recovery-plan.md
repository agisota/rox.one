# T059 - Swarm Project Recovery Plan

Status: DONE

## Context

The Agent Workbench Suite fork has completed bootstrap, white-label/product-mode work, Experience Layer work, and a session-refresh recovery patch. The repository still needs a single supervisor truth layer for backlog state, worktrees, dispatch contracts, QA gates, and next execution waves.

Live discovery found:

- `main` is clean and ahead of `origin/main` by local commits.
- `origin` points to the private GitHub repository `agisota/rox-one-terminal`.
- `.swarm/` was missing and needed to be restored as a planning/control surface.
- T003-T012 feature worktrees are clean and already merged into `main`.
- One stale `codex/telegram-ru-polish` worktree is prunable.
- Ticket/worklog naming had small metadata drift.

## Goal

Create the swarm project-control artifacts needed before launching autonomous parallel execution:

- `.swarm/config.json`
- `.swarm/spec.md`
- `.swarm/plan.md`
- `.swarm/inventory.md`

Also normalize the obvious ticket/worklog metadata drift found during DISCOVER.

## Required UI

No UI changes. This is a planning and orchestration task.

## Required Data/API

Define the supervisor truth model for:

- Ticket
- Worklog
- Worktree
- DispatchRun
- WorkerAssignment
- Artifact
- GateResult
- CommitRecord
- ReleaseCandidate

## Required Automations

No runtime automation implementation in this ticket. The plan must specify how future worker dispatch packets, QA gates, and evidence artifacts are produced.

## TDD Requirements

Before documentation changes:

1. Run read-only repo inventory.
2. Run ticket/worklog inventory.
3. Run worktree inventory.
4. Verify private origin state.
5. Use the evidence as the red/control check for `.swarm` absence and metadata drift.

## Implementation Requirements

- Do not merge or prune worktrees in this task.
- Do not edit feature code.
- Keep the plan phase-gated: DISCOVER -> PLAN -> ORGANIZE -> EXECUTE -> VERIFY.
- Record dispatch contracts and QA gates before any worker execution.

## Validation Commands

At minimum:

- `git status --short --branch`
- `git worktree list --porcelain`
- `bun run validate:agent-contract`
- `git diff --check`

## Acceptance Criteria

- [x] `.swarm/spec.md` exists and defines the target control system.
- [x] `.swarm/plan.md` exists and defines phased execution with gates.
- [x] `.swarm/inventory.md` captures current repo/ticket/worktree truth.
- [x] `.swarm/config.json` exists.
- [x] T041 status is normalized.
- [x] T058 has a matching worklog slug.
- [x] T032 has a concrete dispatch packet and matching initial worklog.
- [x] Worklog complete.

## Worklog

Update `docs/worklog/T059-swarm-project-recovery-plan.md`.
