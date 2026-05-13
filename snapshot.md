# Agent Workbench Suite Snapshot

Date: 2026-05-13
Repository: `/home/dev/craft/rox-one-terminal`
Private GitHub remote: `https://github.com/agisota/rox-one-terminal.git`
Local branch at update: `chore/rebrand-R4-doc-plan-cleanup`

This file records the current state of the ROX.ONE / Agent Workbench Suite fork:
what is actually implemented, how the new logic works, what was not touched,
what is still incomplete, and how account/auth/share/upstream integration should
be understood.

Historical note: this file supersedes the 2026-05-05 snapshot. The prior
snapshot remains useful for chronology, but this version is the active R.4
orientation document.

## 1. Executive Summary

This repository is a ROX.ONE / Agent Workbench Suite fork descended from
upstream Craft Agents OSS. It keeps the useful upstream agent desktop
foundation and adds a ROX.ONE product layer on top:

- Russian-first ROX.ONE branding/localization.
- In-app prompt/product workflow surfaces.
- Prompt Lab, TDD Plan, Spec Builder, Review Gate.
- Account cabinet, teams, billing ledger, storage quota, cloud workspace and
  sync contracts.
- Experience Layer: Command/Game/Arena presentation, Deep Missions, Arena
  Builder, Mission Control, Progression, Quest Map, Agent Forge.
- Evidence-backed metrics: `Quality Score`, `Execution Readiness`,
  `Verified Deliverable Index`.
- Deterministic fake-provider tests for scheduler, swarm, ledger, billing,
  account, sync and E2E release-candidate flows.

Important distinction:

`48 DONE` means 48 real ticket files in `docs/tickets/T*.md` are marked done and
their matching implementation/worklog evidence exists in this repository.

It does not mean every commercial/production integration is finished. Several
features are implemented as MVP contracts, local UI, deterministic fake
providers, or architecture-safe seams. Real provider hardening, durable backend
persistence, upstream v0.9.x merge, production share links, and signed release
distribution remain future work.

## 2. Current Git And Ticket State

Current remotes:

```text
origin       https://github.com/agisota/rox-one-terminal.git
craft-origin https://github.com/agisota/craft.git
```

`origin` is the private ROX.ONE repository. At the time this snapshot was
written, `origin/main` and local `main` were synchronized before the snapshot
docs were added.

The canonical upstream project should be verified explicitly before merge work:

```text
candidate upstream: https://github.com/lukilabs/craft-agents-oss.git
observed tags: v0.9.0, v0.9.1
local package.json version: 0.8.12
```

Ticket accounting:

```text
docs/tickets real ticket files:
  T000-T041
  T054-T059
  = 48 real task tickets

docs/worklog has additional implementation slices:
  T042-T053
```

So the confusing part is this:

```text
T041 Experience Layer System
  -> was executed as a multi-slice implementation sequence:
     T042 registry
     T043 Deep Missions
     T044 Arena Builder
     T045 Mission Control
     T046 Progression
     T047 Quest Map
     T048 Agent Forge
     T049 Scheduler
     T050 Swarm Signal Processor
     T051 E2E Scenario
     T052 Security and Integrity
     T053 Toolbar/lint cleanup

But T042-T053 currently exist as worklog files, not as canonical
docs/tickets/T042-... files.
```

That means the code/worklogs for these slices exist, but backlog accounting is
not perfectly normalized. Normalization should be a follow-up task: create
canonical `docs/tickets/T042-T053*.md` files or explicitly document that these
were subtasks under T041.

## 3. High-Level Application Architecture

The app is now documented as the ROX.ONE Agent Workbench Suite:

```text
Desktop user
    |
    v
Electron app
    |
    +-- main process
    |     |
    |     +-- server-core RPC handlers
    |     +-- session manager
    |     +-- account API proxy
    |     +-- browser/file/system handlers
    |
    +-- preload bridge
    |     |
    |     +-- typed IPC / accountRequest / RPC bridge
    |
    +-- renderer React app
          |
          +-- sessions shell
          +-- settings/account cabinet
          +-- workbench artifact screens
          +-- Experience Layer screens
```

Package layout:

```text
apps/electron/
  src/main/       Electron main process, IPC, app lifecycle, account proxy
  src/renderer/   React UI, settings, shell, workbench, Experience screens

packages/shared/
  src/workbench/  pure product logic, schemas, fake-provider-safe services
  src/i18n/       localization registry and locale data
  src/protocol/   shared protocol/types

packages/server-core/
  src/webui/      account, auth, teams, billing, storage, cloud workspace APIs
  src/sync/       local-cloud sync contracts and fake/in-memory service
  src/sessions/   core session manager, share-to-viewer flow

packages/server/
  src/index.ts    standalone/headless server bootstrap

docs/
  tickets/        canonical roadmap tickets
  worklog/        evidence logs per ticket/slice
  release/        release-candidate notes
```

## 4. Product Flow Overview

The intended product flow is:

```text
Raw prompt / document / task
    |
    v
Intent and mode selection
    |
    +--> Rewrite Prompt
    +--> Thinking Partner
    +--> Spec Builder
    +--> TDD Plan
    +--> Review Gate
    +--> Experience Mission
    |
    v
Option graph / roles / skills / validation gates
    |
    v
Compiled spec / task pack / mission run
    |
    v
Agent or fake-provider execution path
    |
    v
Artifacts + checkpoints + findings
    |
    v
Validation gates
    |
    v
Verified deliverable + VDI/submetrics
```

The app should not be read as a plain chat UI anymore. The new layer turns
rough user input into structured artifacts, missions, review plans and
validation-backed deliverables.

## 5. What Was Added

### 5.1 White-Label And Localization

Added/changed:

- ROX.ONE naming and white-label config.
- Russian-first account and workbench copy.
- i18n parity checks.
- Removal/polish of English scaffolding on Experience screens.

Core areas:

```text
packages/shared/src/i18n/
apps/electron/src/renderer/pages/settings/
apps/electron/src/renderer/components/workbench/
```

### 5.2 Product Modes And Composer Actions

The shared product mode registry defines modes such as:

```text
rewrite
think
spec
plan
build
review
verify
board
tdd
research
```

These are not the same thing as runtime permission modes. They are cognitive /
product modes. They determine:

- default skills
- default agents
- expected validation gates
- UI artifact screen
- output shape

Main code:

```text
packages/shared/src/workbench/product-mode-registry.ts
apps/electron/src/renderer/components/workbench/WorkbenchRoutePage.tsx
apps/electron/src/renderer/components/workbench/artifact-screen-state.ts
```

### 5.3 Prompt Lab

Prompt Lab turns an original prompt into a cleaner/enriched prompt and exposes:

- original prompt
- improved prompt
- diff categories
- missing questions
- suggestions
- actions to replace input, send to Spec, or send to TDD

Main code:

```text
packages/shared/src/workbench/prompt-rewrite-engine.ts
apps/electron/src/renderer/components/workbench/PromptLabScreen.tsx
```

### 5.4 Thinking Partner And Round Table

Thinking Partner models a multi-role reasoning surface:

- Product
- Architect
- Skeptic
- Researcher
- QA

It creates hypotheses, risks, questions and spec candidates.

Main code:

```text
packages/shared/src/workbench/thinking-partner.ts
```

### 5.5 Spec Builder

Spec Builder uses an option graph to turn a rough input into an executable spec.
Options affect skills, agents, validation gates and artifact contracts.

Main code:

```text
packages/shared/src/workbench/option-graph.ts
packages/shared/src/workbench/spec-compiler.ts
apps/electron/src/renderer/components/workbench/SpecBuilderScreen.tsx
apps/electron/src/renderer/components/workbench/spec-builder-state.ts
```

### 5.6 Review Gate

Review Gate checks output before execution/acceptance. It returns:

- verdict
- findings
- severity
- evidence
- reviewer checks
- fix recommendations

Main code:

```text
packages/shared/src/workbench/review-board.ts
packages/shared/src/workbench/validation-gates.ts
apps/electron/src/renderer/components/workbench/ReviewGateScreen.tsx
```

### 5.7 Account, Teams, Billing, Storage, Sync

The account surface now includes MVP contracts for:

- account profile
- login/register/reset flow
- billing ledger
- DV.net payment intent/webhook contract
- audit events
- teams and invites
- spaces
- managed cloud workspaces
- storage quotas
- local-cloud sync snapshots and operations

Main code:

```text
packages/server-core/src/webui/account-cabinet.ts
packages/server-core/src/webui/account-ledger.ts
packages/server-core/src/webui/account-billing.ts
packages/server-core/src/webui/account-events.ts
packages/server-core/src/webui/account-teams.ts
packages/server-core/src/webui/account-cloud-workspaces.ts
packages/server-core/src/webui/account-session-boundary.ts
packages/server-core/src/sync/local-cloud-sync.ts
packages/server-core/src/sync/workspace-sync-service.ts
apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx
apps/electron/src/renderer/pages/settings/AccountAuthPanel.tsx
```

### 5.8 Experience Layer

The Experience Layer adds a switchable presentation layer:

```text
Command mode: serious mission-control/productivity surface
Game mode: quests, unlocks, progression, agent collection
Arena mode: swarm missions, competitive/board-style framing
```

Important: all three modes must use one shared truth model. Presentation can
change, but evidence, progress, gates, ledger, entitlements and mission truth
cannot diverge.

Core model:

```text
packages/shared/src/workbench/experience-layer.ts
packages/shared/src/workbench/experience-layer-registry.ts
packages/shared/src/workbench/experience-layer-security.ts
```

Screens:

```text
apps/electron/src/renderer/components/workbench/DeepMissionsScreen.tsx
apps/electron/src/renderer/components/workbench/ArenaBuilderScreen.tsx
apps/electron/src/renderer/components/workbench/MissionControlRunDetail.tsx
apps/electron/src/renderer/components/workbench/ProgressionObservatory.tsx
apps/electron/src/renderer/components/workbench/QuestMapSkillTree.tsx
apps/electron/src/renderer/components/workbench/AgentForgeTeamRegistry.tsx
apps/electron/src/renderer/components/workbench/experience-ui.tsx
```

### 5.9 Long-Running Missions

Long-running missions are represented by `MissionRun` and checkpoints:

```text
MissionRun
    |
    +-- Mission brief
    +-- Checkpoint 6h
    +-- Checkpoint 12h
    +-- Checkpoint 18h
    +-- Final verification 24h
```

The current scheduler is deterministic and fake-provider-safe. It proves:

- due checkpoint selection
- idempotent tick behavior
- budget/capacity checks
- no success by elapsed time alone
- gate evidence required for completion

Main code:

```text
packages/shared/src/workbench/mission-scheduler-adapter.ts
packages/shared/src/workbench/experience-layer-e2e-scenario.ts
```

### 5.10 Swarm Signal Processor

Swarm mode deduplicates many agent opinions into evidence-backed contributions.

Main rules:

- duplicate claims collapse into clusters
- unsupported claims are penalized
- severe minority reports stay visible
- XP/contribution scoring requires evidence

Main code:

```text
packages/shared/src/workbench/swarm-signal-processor.ts
```

## 6. Shared Truth Model

The Experience Layer truth model includes:

```text
ExperiencePreference
MissionRun
MissionCheckpoint
AgentPackage
SkillContract
AgentRun
Contribution
MetricSnapshot
Quest
QuestProgress
ProgressLedger
SubscriptionEntitlement
MissionGateResult
MissionCompletionDecision
```

Core integrity rule:

```text
Paid entitlement -> can increase capacity
Paid entitlement -> cannot satisfy validation gates
Paid entitlement -> cannot improve Quality Score or VDI by itself
```

ASCII model:

```text
                    +----------------------+
                    | ExperiencePreference |
                    | command/game/arena   |
                    +----------+-----------+
                               |
                               v
                    +----------------------+
                    |     MissionRun       |
                    +----------+-----------+
                               |
         +---------------------+---------------------+
         |                     |                     |
         v                     v                     v
+----------------+    +----------------+    +----------------+
| Checkpoints    |    | AgentRuns      |    | Contributions  |
+--------+-------+    +--------+-------+    +--------+-------+
         |                     |                     |
         v                     v                     v
+------------------------------------------------------------+
| Validation Gates / Evidence / Artifacts / Ledger / Metrics |
+------------------------------------------------------------+
         |
         v
+-----------------------------+
| Verified Deliverable Index  |
+-----------------------------+
```

## 7. Cross-Cutting Metrics

The North Star metric is:

```text
Verified Deliverable Index (VDI)
```

Submetrics:

```text
Quality Score
  -> how well the task is formulated

Execution Readiness
  -> how ready the task is for agent execution

Verified Deliverable Index
  -> whether the work reached a verified, evidence-backed result
```

Supporting metrics:

```text
Cost Efficiency
Open Risk Score
Noise Score
Swarm Capacity
Agent Experience
Skill Mastery
Trust Score
```

Metric flow:

```text
Prompt quality
    |
    v
Spec completeness
    |
    v
Execution plan readiness
    |
    v
Artifacts + checkpoints
    |
    v
Validation gates
    |
    v
VDI + risk + cost + leaderboard position
```

## 8. Account, Registration And Sign-In

### 8.1 Current UX

The account page is inside the app. It should not throw the user to an external
browser for basic login/register/reset.

Main renderer files:

```text
apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx
apps/electron/src/renderer/pages/settings/AccountAuthPanel.tsx
apps/electron/src/renderer/lib/account-api.ts
```

Desktop bridge:

```text
Renderer accountApi
    |
    v
window.api.accountRequest
    |
    v
Electron IPC
    |
    v
apps/electron/src/main/account-api.ts
    |
    v
https://rox.one/api/auth/*
https://rox.one/api/account/*
```

Server-side/headless web routes:

```text
packages/server-core/src/webui/http-server.ts
packages/server-core/src/webui/auth.ts
packages/server-core/src/webui/account-cabinet.ts
```

### 8.2 Registration Sequence

```text
User
  |
  | enters email/password
  v
AccountAuthPanel
  |
  | POST /api/auth/register
  v
accountApi
  |
  | desktop: window.api.accountRequest(...)
  v
Electron main account proxy
  |
  | allowlisted request
  | forwards to https://rox.one/api/auth/register
  v
ROX account API
  |
  | Set-Cookie: rox_session=...
  v
Electron main account proxy
  |
  | stores rox_session in main-process memory
  v
AccountAuthPanel
  |
  | GET /api/account/me
  v
ROX account API
  |
  | account payload
  v
AccountSettingsPage
  |
  | renders personal cabinet
  v
User sees logged-in cabinet
```

### 8.3 Login Sequence

```text
User
  |
  v
AccountAuthPanel
  |
  | POST /api/auth/login
  v
Electron account proxy
  |
  | forwards credentials to ROX account API
  | captures rox_session cookie
  v
AccountSettingsPage
  |
  | refreshes /api/account/me
  | success shown only after account payload is confirmed
  v
Personal cabinet
```

### 8.4 Account Session State

```text
           +-------------+
           | Logged out  |
           +------+------+
                  |
                  | register/login success + /me confirms
                  v
           +-------------+
           | Logged in   |
           +------+------+
                  |
                  | /me returns 401 or cookie lost
                  v
           +-------------+
           | Auth needed |
           +-------------+
```

### 8.5 Known Account Limitations

Current account behavior is better than the earlier broken state, but not final:

- Desktop proxy stores `rox_session` in main-process memory for the current app
  process. Cross-restart persistence needs a secure storage pass.
- The UI suppresses stale `Authentication required` feedback after successful
  `/api/account/me`, but real remote failures can still happen.
- Durable production account storage is not fully implemented locally; several
  server-core pieces are in-memory MVP contracts.
- Account, billing, teams and storage need a production database and migration
  plan before real paid users.

## 9. Public Session Sharing

Current sharing path:

```text
User clicks share
    |
    v
Renderer RPC
    |
    v
SessionManager.shareToViewer(sessionId)
    |
    v
Create/share session bundle
    |
    v
Remote viewer upload endpoint
    |
    +--> success: returns share URL / shortlink payload
    |
    +--> failure: mapped to actionable share error
```

Important:

The app now has better error mapping for share failures, but public shortlink
generation still depends on the remote viewer accepting the upload and auth
state. If the remote viewer rejects the upload, the local app cannot fabricate a
valid public shortlink without a working share backend.

Main code:

```text
packages/server-core/src/sessions/SessionManager.ts
packages/server-core/src/sessions/share-errors.ts
```

## 10. Experience Layer Sequences

### 10.1 Deep Mission Launch

```text
User
  |
  | selects 6h / 24h / 72h preset
  v
DeepMissionsScreen
  |
  | builds MissionRun draft
  v
Shared Experience schemas
  |
  | validate duration, checkpoint cadence, agent count, caps
  v
Mission scheduler adapter
  |
  | fake/deterministic in tests
  v
Mission Control
  |
  | checkpoints, gates, artifacts, audit trace
  v
Progression Observatory
  |
  | VDI + submetrics
```

### 10.2 Swarm/Arena Flow

```text
User
  |
  | selects agents / capacity / arena mode
  v
Arena Builder
  |
  | creates candidate agent set
  v
Swarm Signal Processor
  |
  | receives many claims/opinions
  | normalizes claims
  | deduplicates clusters
  | scores evidence-backed contributions
  | preserves severe minority reports
  v
Review / Validation
  |
  v
Mission output / VDI / ledger
```

### 10.3 Quest/Unlock Flow

```text
Quest available
    |
    | user starts quest
    v
Quest active
    |
    | artifact refs + gate evidence present
    v
Quest completed
    |
    | emits XP/unlock ledger event
    v
Rewards visible

Invalid path:

paid entitlement
    |
    v
cannot complete quest
cannot satisfy gate
cannot raise VDI alone
```

### 10.4 Mission State Machine

```text
draft
  |
  | launch
  v
queued
  |
  | scheduler tick
  v
running
  |
  +-- checkpoint pass/warn --> running
  |
  +-- blocking gate fail ----> blocked
  |
  +-- fatal failure ---------> failed
  |
  +-- final gates pass/warn -> completed
  |
  +-- user cancellation ----> cancelled
```

## 11. Local-Cloud Sync

Current sync is an explicit snapshot/push/pull model, not invisible realtime
collaboration.

```text
Local workspace
    |
    | create snapshot
    v
Sync service
    |
    | compare base/local/cloud
    v
Conflict detector
    |
    +--> no conflict: push/pull operation
    |
    +--> conflict: explicit user approval required
```

Main code:

```text
packages/server-core/src/sync/local-cloud-sync.ts
packages/server-core/src/sync/workspace-sync-service.ts
packages/server-core/src/webui/http-server.ts
```

Core rule:

```text
No silent overwrite.
```

## 12. What We Did Not Touch Or Did Not Finish

Not touched as production-ready systems:

- Real LLM provider orchestration for all new workbench flows.
- Real long-running 24h/72h background worker infrastructure.
- Real production S3 storage and quota enforcement against a live object store.
- Real payment settlement beyond deterministic DV.net contract tests.
- Real public marketplace.
- Production-grade email delivery.
- Production-grade public shortlink backend.
- Signed/notarized production release.
- Upstream v0.9.x full merge.

Implemented but still MVP/incomplete:

- Account/team/billing/storage stores are largely in-memory or fake-provider
  tested at this stage.
- Desktop account cookie continuity works inside the current app process, but
  secure persistent session storage is still needed.
- Experience screens are reachable and polished, but they need deeper data
  binding to real mission runs once real scheduler/provider execution exists.
- `T042-T053` implementation slices have worklogs but should be normalized into
  formal ticket files for clean backlog accounting.
- Public session sharing has better error behavior, but shortlink generation
  still depends on remote backend success.

## 13. Validation Evidence

Recent release-candidate gates recorded in repo docs:

```text
bun run validate:ci
bun run e2e:core
bun run validate:e2e-core-scenarios
bun run validate:docs
git diff --check
```

Release notes:

```text
docs/release/agent-workbench-rc-2026-05-05.md
```

Swarm/project state:

```text
.swarm/spec.md
.swarm/plan.md
.swarm/inventory.md
.swarm/backlog-status.md
```

## 14. Upstream Merge Context

Current local app version:

```text
package.json version: 0.8.12
```

Observed canonical upstream tags:

```text
v0.9.0
v0.9.1
```

The safe next step is not a blind merge. The safe next step is:

```text
1. Add/verify canonical upstream remote.
2. Fetch upstream tags and branches.
3. Create a merge branch.
4. Diff upstream v0.9.1 against current base.
5. Protect ROX-owned files and product layers.
6. Merge/rebase in small gates.
7. Run account/session/share/Experience/UI/E2E checks.
8. Push only after green validation.
```

ROX-owned layers that must be protected:

```text
branding/localization
account cabinet and account proxy
teams/billing/storage/cloud workspace contracts
Workbench artifact screens
Experience Layer screens and shared truth model
validation gates and fake-provider tests
release/snapshot/plan docs
```

## 15. Current Interpretation

If the question is:

> Are the 48 changes already inside the app?

Answer:

Mostly yes for code-backed tickets: they are implemented in the local branch and
pushed to the private `origin`. Some tickets are documentation, release,
validation, architecture, or fake-provider contract tasks rather than visible UI
buttons. Product-ready completion still requires the next plan.

If the question is:

> Can I run and inspect the app?

Answer:

Yes. The current repo has Electron build/start scripts and recent smoke evidence.
The next live command is:

```text
bun run electron:start
```

If the question is:

> Is this already a production SaaS?

Answer:

No. It is a local/desktop release-candidate-quality fork with substantial
product-layer implementation and deterministic tests. Production SaaS readiness
requires durable storage, real account/payment/email/share/provider integrations,
upstream v0.9.x merge, signed release, and CI/CD hardening.
