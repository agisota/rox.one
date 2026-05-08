# ROX ONE Agent Workbench Suite - Current State Snapshot 2026-05-06

Repository: `/Users/marklindgreen/Projects/craft/craft`
Branch: `mac/rox-production-ready-rc`
Base: Craft Agents OSS v0.9.1
Snapshot status: T074-T096 private/local RC handoff validated locally; T094/T095 reconcile release state and T096 closes the live verification blockers without converting the RC into public production.

## 1. Current Product Shape

ROX ONE is a Russian-first white-label Agent Workbench Suite with:

- Composer product mode toolbar.
- Prompt Lab.
- Spec Builder.
- TDD Plan.
- Review Gate.
- ROX ID account screen.
- Team/account/billing/storage/sync contracts.
- Experience Layer screens:
  - `Долгие миссии`
  - `Арена агентов`
  - `Центр миссий`
  - `Прогресс`
  - `Карта квестов`
  - `Кузница агентов`
- Global Experience HUD.
- Quality Score, Execution Readiness, VDI, risk/noise/cost/capacity metrics.
- Durable scheduler contracts.
- Provider gateway contracts.
- Share provider contracts.
- Private CI/release validation contracts.

## 2. Integration Truth Model

The main integration rule is now enforced in shared runtime code:

```text
UI action
  -> typed event
  -> deterministic reducer
  -> replayable runtime state
  -> persistence seam
  -> fake-safe provider/scheduler/share seam
  -> artifact/gate evidence
  -> metrics, quests, ledger, notifications
  -> UI projection
```

Experience screens are no longer allowed to own separate truth when runtime
truth exists.

## 3. Key Runtime Surfaces

| Area | Current surface |
|---|---|
| Runtime truth | `packages/shared/src/workbench/experience-runtime-store.ts` |
| Mission prompts | `packages/shared/src/workbench/mission-mode-prompt-registry.ts` |
| Deep Missions | `apps/electron/src/renderer/components/workbench/DeepMissionsScreen.tsx` |
| Mission Control | `apps/electron/src/renderer/components/workbench/mission-control-state.ts` |
| Quest Map | `apps/electron/src/renderer/components/workbench/quest-map-state.ts` |
| Arena | `apps/electron/src/renderer/components/workbench/arena-builder-state.ts` |
| HUD | `apps/electron/src/renderer/components/workbench/ExperienceGlobalHud.tsx` |
| Provider gateway | `packages/server-core/src/provider-gateway/` |
| Mission scheduler | `packages/server-core/src/mission-scheduler/` |
| Share provider | `packages/server-core/src/sessions/share-provider.ts` |
| Account feedback | `apps/electron/src/renderer/pages/settings/account-auth-feedback.ts` |

## 4. Current Commit Chain

```text
0ec59b8 T074 Experience Runtime Store
aa1fe47 T075 Deep Missions Launch Flow
f912ec8 T076 Mission Control Runtime Binding
437382c T077 Global Metrics / Quest Engine
32f18aa T078 Agent Arena / Forge Actions
3396acb T079 Mission Mode Prompt Registry / Provider Orchestration
caefffc T080 Global Experience HUD
52f2bdd T081 Visual Polish
1a354e2 T082 E2E Experience Journey
11c5172 T083 ROX ID Account Fix
06a61d2 T084 Public Share Contract
07ec92a T085 Private CI/CD Release Pipeline
67e4695 T086 Security and Abuse Hardening
1190514 T087 Final Product RC Documentation Build
ab33f70 T088 MissionRun Lifecycle Contract Alignment
4eb6dcd T089 Runtime Module Depth and Action Seams
8ab5c11 Finalize release hardening validation pass
0dba818 T091 Packaged Release Hardening
bee0aa5 T092 Bundle Artifact Baseline Report
efec07a T093 React Hook Lint Cleanup
handoff commit T094 Release Doc Reconciliation
handoff commit T095 Release State Reconciliation
handoff commit T096 Private RC Verification Stabilization
```

## 5. Runtime Boundaries

Fake-provider-safe by design:

- LLM/provider outputs.
- Mission scheduler execution.
- Public share upload/shortlink lifecycle.
- Account API tests.
- Agent registry trust checks.
- E2E Experience journey.

Production-connected by contract:

- Typed DTOs and IPC boundaries.
- Persistence adapter seams.
- Provider adapter seams.
- Share provider interface.
- Scheduler repository and clock seams.
- Security and redaction checks.

Not production-hosted yet:

- Real LLM provider orchestration with credentials.
- Public shortlink/viewer backend.
- Production object storage.
- Payment settlement.
- Email verification provider.
- Hosted durable workers.
- Signed/notarized macOS release.
- Bundle-size policy and chunk-splitting gate beyond the current read-only T092 baseline.
- External dependency/security audit and public-infra abuse controls.

## 6. Local Worktree Note

Do not stage unrelated runtime files:

```text
events.jsonl
.claude/
.ouroboros/
```

They are local runtime artifacts and are not part of the RC commit scope.
