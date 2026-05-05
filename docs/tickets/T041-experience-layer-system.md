# T041 - Experience Layer System

Status: DONE

## Context

We are building a white-label fork of Craft Agents OSS into ROX ONE Agent Workbench.

This ticket starts the implementation track for the Experience Layer System described in:

- `docs/product/experience-layer-system-prd.md`

The system introduces a switchable Command/Game/Arena layer over a shared truth model:

- Command: serious mission control, gates, risk, audit, cost.
- Game: quests, unlocks, skill mastery, agent XP.
- Arena: swarm missions, boss runs, ranked agents, 24h runs.

## Goal

Implement the Experience Layer System incrementally, beginning with core models and tests.

The first implementation step must establish typed schemas/fixtures and tests for the shared truth layer so future UI screens cannot diverge by experience mode.

## Required UI

The full PRD covers these future screens:

- Deep Missions
- Agent Collection + Arena Builder
- Mission Control Run Detail
- Progression / Metrics Observatory
- Quest Map / Skill Tree / Unlocks
- Agent Forge / Skill Marketplace

This first ticket may avoid UI implementation if the repo shape suggests models first. If UI is touched, component tests are required first.

## Required Data/API

Start with schemas/types/fixtures for:

- ExperiencePreference
- MissionRun
- MissionCheckpoint
- AgentPackage
- SkillContract
- AgentRun
- Contribution
- MetricSnapshot
- Quest
- QuestProgress
- ProgressLedger
- SubscriptionEntitlement

## Required Automations

Future automations:

- prompt submitted -> mode/quest suggestion
- spec generated -> gate suggestions
- mission launched -> checkpoints and budget reservation
- checkpoint due -> checkpoint artifact
- contribution accepted -> XP/ledger update
- gate passed/failed -> VDI and quest progress update
- package forged -> forge gauntlet

This first ticket should define contracts so automations can be added safely later.

## Required Subagents

Before tests, spawn read-only explorer subagents only when they materially improve correctness:

- UI explorer
- core/schema explorer
- test harness explorer
- security/RBAC explorer

## TDD Requirements

Before implementation:

1. Write schema/fixture tests.
2. Write VDI formula tests.
3. Write quest evidence requirement tests.
4. Write entitlement rule tests showing paid capacity cannot mark quality gates passed.
5. Run tests and confirm expected failure.

## Implementation Requirements

Implement minimal code required to pass tests.

Do not add unrelated UI, public marketplace, real billing, real scheduler, or real provider calls in this ticket.

## Validation Commands

Agent must discover exact commands from package scripts and run relevant ones.

At minimum consider:

- `bun run validate:agent-contract`
- targeted tests
- `bun test` or relevant package tests
- `bun run typecheck` if TypeScript source changed

## Acceptance Criteria

- [ ] Shared schemas/types exist for the Experience Layer core.
- [ ] Default experience layer is Command.
- [ ] Game/Arena layers cannot alter validation gate truth.
- [ ] VDI formula is deterministic and tested.
- [ ] Quest completion requires artifact/gate evidence.
- [ ] Paid entitlements increase capacity only, not quality.
- [ ] Tests pass.
- [ ] Worklog complete.
- [ ] Scoped commit created.

## Worklog

Update:

- `docs/worklog/T041-experience-layer-system.md`
