# TASK_ID - TASK_TITLE

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.

Relevant product goals:

- local desktop app
- managed web/cloud app
- user/team workspaces
- prompt modes
- multi-agent workflows
- validation gates
- TDD-first implementation

## Goal

Describe the exact user-visible and system-level outcome.

## Required UI

List screens, buttons, panels, modals, states.

## Required Data/API

List schemas, services, adapters, persistence needs.

## Required Automations

List event triggers, labels, statuses, validation gates.

## Required Subagents

Before tests, spawn read-only explorer subagents only when relevant:

- UI explorer
- backend/server explorer
- config/workspace explorer
- skill/automation explorer
- storage/security explorer
- test harness explorer

## TDD Requirements

Before implementation:

1. Write unit tests.
2. Write integration tests.
3. Write UI tests if UI changes.
4. Write E2E/smoke tests if user-visible flow changes.
5. Write security/RBAC/quota tests if applicable.
6. Run tests and confirm expected failure.

## Implementation Requirements

Implement minimal code required to pass tests. Do not add unrelated changes.

## Validation Commands

Agent must discover exact commands from package scripts and run relevant ones.

At minimum consider:

- install if needed
- typecheck if available
- lint if available
- unit tests if available
- integration tests if available
- UI/E2E tests if available
- build if affected
- Mac ARM build if desktop/release affected

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
- [ ] Tests pass
- [ ] Build passes when applicable
- [ ] Worklog complete
- [ ] Commit created

## Worklog

Update `docs/worklog/TASK_ID.md`.
