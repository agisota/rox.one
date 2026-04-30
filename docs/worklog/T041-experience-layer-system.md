# T041 - Experience Layer Core Models

## Task summary

Implement the shared truth-layer contracts for the Experience Layer System described in `docs/product/experience-layer-system-prd.md`.

This ticket is intentionally core-only:

- no UI screens
- no real providers
- no scheduler infrastructure
- no marketplace implementation
- no billing integration

It defines and tests the data model and deterministic rules that later Command/Game/Arena screens must share.

## Reformulated task

Add typed, validated shared workbench models for:

- `ExperiencePreference`
- `MissionRun`
- `MissionCheckpoint`
- `AgentPackage`
- `SkillContract`
- `AgentRun`
- `Contribution`
- `MetricSnapshot`
- `Quest`
- `QuestProgress`
- `ProgressLedger`
- `SubscriptionEntitlement`

Also add deterministic helpers for:

- default Command-layer preferences
- VDI scoring
- quest completion evidence requirements
- mission completion rules
- paid entitlement integrity rules

## Assumptions and boundaries

- Command/Game/Arena are presentation layers over one truth model.
- The default layer is `command`.
- Game/Arena labels and language cannot alter mission ids, artifacts, gates, ledgers, or metric semantics.
- Paid entitlements can increase capacity, duration, storage, private package count, and swarm slots.
- Paid entitlements cannot satisfy validation gates or directly increase quality metrics.
- Elapsed mission time alone never means success.
- Tests use only deterministic fixtures and pure functions.

## ERD / schema view

```text
ExperiencePreference
  userId/teamId -> defaultLayer + allowedLayers + presentation flags

MissionRun
  ownerUserId/teamId/workspaceId -> mode + experienceLayer + budget/caps + requiredGateIds

MissionCheckpoint
  missionRunId -> ordinal + dueAt + artifacts + vdiDelta + status

AgentPackage
  ownerUserId/ownerTeamId -> visibility + trustScore + permissionProfileId + version

SkillContract
  packageId -> input/output schema + permissions + tools + gates + fixtures

AgentRun
  missionRunId + agentPackageId -> counters + penalties + cost + confidence

Contribution
  agentRunId -> claim + evidenceRefs + uniqueness + accepted/rejected state

MetricSnapshot
  missionRunId/artifactId/userId/teamId -> Quality + Readiness + VDI + evidence

Quest
  lane/defaultLayer -> requirements + rewards + unlocks

QuestProgress
  questId + userId/teamId -> status + percent + evidence

ProgressLedger
  userId/teamId -> xp/credit/entitlement/penalty/unlock event with evidence source

SubscriptionEntitlement
  userId/teamId -> capacity limits only
```

## Sequence diagram

```text
User selects layer
  -> ExperiencePreference validates allowed layer
  -> MissionRun keeps same ids/artifacts/gates/ledger semantics
  -> Mission produces artifacts and gate results
  -> MetricSnapshot calculates VDI from evidence-backed submetrics
  -> QuestProgress can complete only with artifact or gate evidence
  -> ProgressLedger can record rewards only from evidence-backed sources
```

## Component / screen map impact

T041 affects only shared core modules. Later UI tickets consume these contracts:

- T043 Deep Missions uses `MissionRun` and `MissionCheckpoint`.
- T044 Arena Builder uses `AgentPackage`, `SubscriptionEntitlement`, and mission caps.
- T045 Mission Control uses mission close evaluation and checkpoints.
- T046 Progression Observatory uses `MetricSnapshot` and `ProgressLedger`.
- T047 Quest Map uses `Quest` and `QuestProgress`.
- T048 Agent Forge uses `AgentPackage` and `SkillContract`.

## Options and tradeoffs

1. Add models inside feature UI modules.
   - Rejected because Command/Game/Arena would drift and tests would duplicate truth logic.
2. Add one shared workbench core module.
   - Chosen because existing workbench modules already use shared Zod schemas and pure deterministic tests.
3. Add persistence/services now.
   - Rejected for T041 because later tickets own scheduler, registry, UI, and stores.

## Recommended path

Implement `packages/shared/src/workbench/experience-layer.ts` plus focused tests in `packages/shared/src/workbench/__tests__/experience-layer.test.ts`, then export through `packages/shared/src/workbench/index.ts`.

## Repo context discovered

- `packages/shared/src/workbench` is the existing home for prompt/spec/review/validation shared workbench logic.
- Existing tests use `bun:test` and relative imports from sibling modules.
- Existing shared workbench modules use `zod/v4`.
- Existing `ValidationGateSchema` already defines validation gate ids and should be reused.
- `packages/shared/src/workbench/index.ts` is the barrel export for workbench features.

## Files inspected

- `AGENTS.md`
- `package.json`
- `packages/shared/package.json`
- `packages/shared/src/workbench/index.ts`
- `packages/shared/src/workbench/product-mode-registry.ts`
- `packages/shared/src/workbench/validation-gates.ts`
- `packages/shared/src/workbench/__tests__/product-mode-registry.test.ts`
- `packages/shared/src/workbench/__tests__/validation-gates.test.ts`
- `packages/shared/src/workbench/__tests__/agent-pipeline-planner.test.ts`
- `docs/product/experience-layer-system-prd.md`

## Tests added first

- `packages/shared/src/workbench/__tests__/experience-layer.test.ts`
  - validates core schema surface and invalid fixtures
  - verifies default Command layer preference
  - verifies Command/Game/Arena projections preserve shared mission truth
  - fixture-tests VDI, Agent XP, and Skill Mastery formulas
  - enforces quest completion evidence
  - verifies paid entitlements cannot satisfy validation gates
  - verifies elapsed time alone cannot complete a long-running mission

## Expected failing test output

`bun test packages/shared/src/workbench/__tests__/experience-layer.test.ts` initially failed as expected:

```text
error: Cannot find module '../experience-layer'
0 pass
1 fail
```

## Implementation changes

- Added `packages/shared/src/workbench/experience-layer.ts`.
- Added Zod schemas for the T041 Experience Layer entities.
- Added deterministic helpers:
  - `createDefaultExperiencePreference`
  - `calculateVerifiedDeliverableIndex`
  - `calculateAgentExperience`
  - `calculateSkillMastery`
  - `projectExperienceLayerView`
  - `assertQuestCompletionEvidence`
  - `paidEntitlementCanSatisfyValidationGate`
  - `evaluateMissionCompletion`
- Exported the module from `packages/shared/src/workbench/index.ts`.

## Validation commands run

- `bun test packages/shared/src/workbench/__tests__/experience-layer.test.ts` - pass
- `bun run typecheck:shared` - pass
- `bun run validate:agent-contract` - pass
- `bun run lint:shared` - pass
- `bun test` from `packages/shared` - fail on pre-existing unrelated suites; see remaining risks

## Passing test output summary

- Targeted T041 test: 7 pass, 0 fail, 46 assertions.
- Shared typecheck: passed.
- Agent contract validation: `[agent-contract] ok: 11 skills, 42 tickets, 7 required docs`.
- Shared lint: passed.

## Build output summary

No runtime/build surfaces changed in T041. Build was not run.

## Remaining risks

- Full `packages/shared` test suite currently fails in unrelated pre-existing areas:
  - PowerShell plans folder exception tests in `packages/shared/tests/mode-manager.test.ts`
  - `upgradePromptCacheTtl` tests
  - Bedrock auth env handling
  - OAuth deeplink URL tests
  - session tool safe-mode classification
  - send developer feedback safe-mode classification
- Root `bun run lint` fails in existing renderer UI code:
  - `apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx`
  - disallowed `shadow-sm` / `shadow-lg` classes
- These failures are not caused by T041 files and were not mixed into the scoped commit.

## Acceptance criteria matrix

- [x] Core schemas exist and validate valid/invalid fixtures.
- [x] Default experience preference uses Command layer.
- [x] Game/Arena cannot change validation semantics.
- [x] VDI formula is deterministic and fixture-tested.
- [x] Quest completion requires artifact or gate evidence.
- [x] Paid entitlement cannot mark gates passed.
- [x] Elapsed mission time alone cannot complete a mission.
- [x] Targeted tests pass.
- [x] Relevant broader validation passes for the changed shared workbench surface.
- [ ] Scoped commit exists.
