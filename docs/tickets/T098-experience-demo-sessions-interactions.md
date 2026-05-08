# T098 - Experience Demo Sessions and Interactive State Proof

Status: DONE

## Context

The Experience workbench tabs currently render deterministic state projections,
but the production RC still needs a safe product layer that shows how sanitized
operator sessions, skills, quests, metrics, and agent packages connect across
the six Experience tabs.

## Goal

Ship a scoped Experience layer slice that installs sanitized demo sessions for
each tab, routes every tab through `ExperienceTruthState`, and proves the core
interactive state mutations without importing raw private session data.

## Required UI

- Add a compact demo-session selector above each Experience tab.
- Provide exactly five sanitized demo sessions per tab.
- Route selected demo session truth state into:
  - `DeepMissionsScreen`
  - `ArenaBuilderScreen`
  - `MissionControlRunDetail`
  - `ProgressionObservatory`
  - `QuestMapSkillTree`
  - `AgentForgeTeamRegistry`
- Expose minimal interactive controls for launch/draft/finalize/progression/
  quest/forge actions where the underlying state modules already support them.

## Required Data/API

- Demo data must use `ExperienceTruthState` and shared schemas.
- Demo data must not include credentials, cookies, raw private prompts, local
  absolute paths, auth headers, or mutable local DB state.
- Workbench route tests must prove tab renderability and the five-session
  contract for each tab.
- Interaction tests must prove state mutations through existing state modules.

## Required Automations

- Add or update documentation that maps tabs to session/skill/product roles.
- Keep the implementation local and deterministic; real raw session import is
  out of scope.

## Required Subagents

No subagent required for this slice: the dirty tree already identifies the UI,
state, and test surfaces, and the change is scoped to one workbench route layer.

## TDD Requirements

Before implementation:

1. Write focused route tests for the per-tab demo-session contract.
2. Write interaction/state tests for mission launch, mission control, arena
   draft, progression ledger, quest completion, and forge install/publish gates.
3. Run focused tests and confirm failures before completing implementation.

## Implementation Requirements

- Keep demo-session construction in a dedicated workbench module.
- Reuse existing `create*FromTruth` and state mutation helpers.
- Do not bulk-import real Rox sessions in this ticket.
- Do not mix unrelated runtime artifacts or branding-only edits into the task
  commit.

## Validation Commands

- `bun test apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx apps/electron/src/renderer/components/workbench/__tests__/workbench-interactions.test.ts`
- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run electron:build`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Five sanitized demo sessions exist for every Experience tab | DONE |
| Route layer injects selected `ExperienceTruthState` into each tab | DONE |
| Interaction tests cover launch/draft/finalize/progression/quest/forge actions | DONE |
| Product note documents sessions, skills, backend/model visibility, and import policy | DONE |
| Focused tests pass | DONE |
| Electron typecheck/lint/build pass or blockers are documented | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists without unrelated runtime artifacts | DONE |

## Worklog

Update `docs/worklog/T098-experience-demo-sessions-interactions.md`.
