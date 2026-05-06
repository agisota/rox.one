# ROX ONE Agent Workbench - Current State Snapshot

Date: 2026-05-06
Branch: `mac/upstream-v0.9.1-rox-merge`
Repository: `/Users/marklindgreen/Projects/rox/rox`

## 1. Reformulated Task

We are no longer just polishing a fork of Rox Agents. The current work is an integration push for ROX ONE / Agent Workbench Suite:

```text
Rox Agents OSS v0.9.1 base
  + ROX branding and Russian-first UX
  + Prompt-to-Spec workbench
  + account/team/billing/storage/sync contracts
  + Experience Layer surfaces
  + safe account persistence
  + public share provider seam
  + aggregate persistence contracts
  -> production-integrated agent workbench
```

The immediate objective is to close the integration contour after T060-T065 and prepare the next e2e phase: durable missions, real provider orchestration, Experience Layer real-state binding, visual QA, CI/CD, security gates, and final release candidate.

## 2. Assumptions And Boundaries

Assumptions:

- User-facing summaries are Russian-first, but code, package names, API names, file names, and commit messages remain English.
- Tests must not call real LLM, S3, payment, email, browser, marketplace, or public viewer providers.
- Fake providers must be deterministic and contract-compatible with future real providers.
- Paid entitlement can increase capacity, slots, duration, or budget only; it cannot satisfy quality gates, evidence gates, Quality Score, Execution Readiness, or Verified Deliverable Index.
- Game/Arena/Command presentation modes must remain skins over one truth model, not separate truth systems.

Boundaries:

- T060-T065 do not make every feature production-hosted.
- T063 persists local Electron account sessions, but tests do not validate a real rox.one login roundtrip.
- T064 adds a public share provider seam and safer default viewer provider. It does not create a new production shortlink service.
- T065 adds persistence contracts and deterministic in-memory implementations. It does not wire a production database.
- T066+ must connect these contracts to durable scheduler/state/runtime paths.

## 3. Fresh Repository Status

Fresh checks show:

```text
git branch: mac/upstream-v0.9.1-rox-merge
latest committed integration: T064
current uncommitted implementation: T065 persistence adapter contracts
ticket count: 66 canonical tickets
ticket status after accounting cleanup: 66 DONE
known unrelated dirty items: events.jsonl, .claude/
app process: Electron is running from this repo
```

Recent commits:

```text
a8f24ff Isolate public session sharing behind a provider contract
716d913 Keep desktop account sessions across Electron restarts
5c1f88b Integrate upstream v0.9.1 without dropping ROX product layers
076e1f5 Protect ROX layers before upstream v0.9.1 merge
6a6bc32 Make backlog accounting enforceable before integration
bc5d97b Make project state legible before upstream work
```

Current scoped work after this snapshot:

```text
docs/tickets/T064-public-share-shortlink-provider.md      accounting status correction
docs/tickets/T065-production-persistence-adapter.md       T065 DONE state
docs/worklog/T065-production-persistence-adapter.md       T065 evidence
packages/server-core/package.json                         persistence export
packages/server-core/src/persistence/*                    new persistence seam and tests
docs/release/current-state-snapshot-2026-05-06.md         this snapshot
docs/release/e2e-integration-plan-2026-05-06.md           next integration plan
```

Do not stage:

```text
events.jsonl
.claude/
```

These are unrelated runtime/local artifacts.

## 4. What Has Been Added At Product Level

The fork now contains these product layers on top of upstream Rox Agents:

```text
ROX ONE shell
  -> Russian-first UI labels and white-label product copy
  -> account settings and native sign-in panel
  -> team/billing/storage/sync settings surfaces

Workbench Layer
  -> Prompt Lab
  -> TDD Plan
  -> Spec Builder
  -> Review Gate
  -> composer product-mode toolbar
  -> fake-provider-safe flows

Experience Layer
  -> Command/Game/Arena layer model
  -> Deep Missions
  -> Arena Builder
  -> Mission Control
  -> Progression Observatory
  -> Quest Map / Skill Tree
  -> Agent Forge / Team Registry

Metrics Layer
  -> Quality Score
  -> Execution Readiness
  -> Verified Deliverable Index
  -> risk/noise/cost/capacity side metrics

Runtime Contracts
  -> account/team/billing/storage/sync contracts
  -> account session persistence
  -> public share provider contract
  -> aggregate persistence adapter contract
```

## 5. What T060-T065 Changed

### T060 - Backlog Normalization

Problem:

```text
T042-T053 existed as worklog slices but were not fully canonicalized as tickets.
Ticket accounting was ambiguous.
```

Result:

- Added canonical ticket/worklog consistency.
- Extended docs validation to catch missing ticket/worklog pairs.
- Normalized backlog status so DONE accounting is auditable.

Effect:

```text
The project now has enforceable ticket accounting instead of narrative-only status.
```

### T061 - Upstream v0.9.1 Merge Plan

Problem:

```text
Upstream Rox Agents moved to v0.9.1.
ROX layers needed protection before any merge.
```

Result:

- Added protected path map.
- Defined merge risk matrix.
- Defined required T062 validation commands.
- Did not merge in T061.

Protected surfaces:

```text
apps/electron/src/renderer/components/workbench/
apps/electron/src/renderer/pages/settings/
apps/electron/src/main/account-api.ts
packages/shared/src/workbench/
packages/shared/src/i18n/
packages/server-core/src/webui/
packages/server-core/src/sync/
docs/tickets/
docs/worklog/
docs/release/
.swarm/
```

### T062 - Upstream v0.9.1 Merge Implementation

Problem:

```text
Local fork was behind upstream and needed v0.9.1 without losing ROX product layers.
```

Result:

- Merged upstream `v0.9.1`.
- Preserved ROX Workbench, account, i18n, sync, and release docs.
- Repaired build scripts for upstream Claude SDK package layout.
- Repaired tests for browser/PDF/fetch constraints.

Validation evidence:

```text
bun test: 4625 pass, 13 skip, 0 fail
bun run validate:ci: passed
bun run e2e:core: all core scenarios passed
bun run electron:build: passed
```

### T063 - Account Persistent Session Storage

Problem:

```text
Login could appear successful, but rox_session lived only in main-process memory.
App restart or proxy recreation could lose account auth context.
```

Result:

- Added `AccountSessionStore`.
- Added encrypted Electron `safeStorage` persistence.
- Hydrates cookie before first account request.
- Clears persisted session on logout.
- Corrupt session file fails closed.
- Electron smoke uses isolated userData/config paths so a running local app does not break smoke tests.

Important boundary:

```text
The session cookie is never exposed to renderer state or public share payloads.
```

### T064 - Public Share Shortlink Provider

Problem:

```text
Session sharing directly called viewer upload endpoints.
Failures produced "Failed to upload session" and shortlink behavior was not isolated behind a provider contract.
```

Result:

- Added `ShareProvider` contract.
- Added default viewer-backed provider.
- Added deterministic fake provider.
- Added recursive public payload sanitizer.
- Rejects local/file/non-public shortlink URLs.
- `SessionManager.shareToViewer()`, update, revoke, and delete paths now use the provider seam.

Important boundary:

```text
This makes sharing explicit and testable.
It does not create a new production public shortlink backend.
```

Accounting note:

```text
T064 was already implemented and committed, but the ticket file still said TODO.
This snapshot corrects that ticket status to DONE.
```

### T065 - Production Persistence Adapter Contracts

Problem:

```text
Feature surfaces existed, but runtime state was split across local in-memory stores.
There was no single contract for account/team/ledger/storage/sync/mission/quest/metric/package persistence.
```

Result:

- Added `packages/server-core/src/persistence/`.
- Exported `@rox-agent/server-core/persistence`.
- Added `AgentWorkbenchPersistenceAdapter`.
- Aggregated existing stores:
  - accounts
  - teams
  - ledger
  - audit
  - cloud workspaces
  - team chat
  - billing intents
  - object storage and quota service
  - sync file store
  - workspace sync service
- Added new repositories:
  - mission runs
  - mission checkpoints
  - scheduler events
  - quest progress
  - progression ledger
  - metric snapshots
  - agent packages
- Added deterministic in-memory implementations.

T065 contract tests cover:

```text
account CRUD/session basics
team + ledger + audit + storage + sync access through one adapter
mission runs/checkpoints/events
checkpoint idempotency
quest evidence enforcement
XP/unlock ledger evidence enforcement
metric snapshots
private/team/public/built-in package visibility
```

Validation evidence:

```text
targeted T065: 4 pass, 0 fail
neighboring account/storage/sync/experience: 55 pass, 0 fail
full bun test: 4644 pass, 13 skip, 0 fail
validate:docs: passed
typecheck:all: passed
lint: 0 errors, 3 existing warnings
git diff --check: passed
electron:build: passed
```

## 6. Current System Architecture

```text
Electron App
  |
  |-- Renderer React
  |     |-- Composer / product mode toolbar
  |     |-- Prompt Lab / TDD Plan / Spec Builder / Review Gate
  |     |-- Experience screens
  |     |-- Account settings
  |
  |-- Preload Bridge
  |     |-- account:request
  |     |-- session commands
  |     |-- workbench events
  |
  |-- Electron Main
        |-- account API proxy
        |-- encrypted account session store
        |-- SessionManager
        |-- ShareProvider
        |-- server-core runtime

packages/shared
  |-- workbench schemas
  |-- mission truth model
  |-- validation/evidence rules
  |-- i18n and branding contracts

packages/server-core
  |-- account/team/billing/storage/sync stores
  |-- sessions/share provider seam
  |-- webui account contracts
  |-- persistence aggregate adapter
```

## 7. Core Sequence Diagrams

### Account Sign-In / Restore

```text
User
  -> AccountSettingsPage: submit email/password
  -> preload bridge: account:request /api/auth/login
  -> Electron main account proxy: forward to ROX account API
  -> ROX account API: Set-Cookie rox_session
  -> account proxy: capture rox_session
  -> AccountSessionStore: encrypt and persist cookie
  -> renderer: refresh /api/account/me
  -> AccountSettingsPage: show signed-in state only if user is returned

Failure points:
  x ROX API rejects credentials -> auth error
  x safeStorage unavailable -> sign-in can work, persistence disabled
  x corrupt persisted file -> fail closed, delete file, require login
```

### Public Share

```text
User
  -> SessionMenu: click share
  -> SessionManager.shareToViewer()
  -> ShareProvider.uploadBundle()
  -> sanitizer: remove secret/auth/session fields
  -> viewer backend: receive public bundle
  -> ShareProvider.createShortlink()
  -> public URL guard: reject local/file/non-public URL
  -> SessionManager: persist sharedId/sharedUrl only after success
  -> renderer: show share/copy feedback

Failure points:
  x auth required -> specific share error
  x payload too large/invalid -> specific share error
  x viewer upload fails -> no session metadata mutation
  x shortlink is local/non-public -> reject as unsafe
```

### T065 Persistence Adapter

```text
Domain service / future runtime
  -> AgentWorkbenchPersistenceAdapter
       |-- accounts
       |-- teams
       |-- ledger
       |-- audit
       |-- cloudWorkspaces
       |-- storage
       |-- syncFiles
       |-- workspaceSync
       |-- missions
       |-- questProgress
       |-- metrics
       |-- agentPackages
  -> fake deterministic adapter in tests
  -> future durable adapter in production

Failure points:
  x invalid mission/checkpoint schema -> reject
  x completed quest without evidence -> reject
  x XP/unlock ledger without evidence -> reject
  x private package viewed by another user -> hidden
  x team package viewed outside team -> hidden
```

### Intended E2E Mission Flow

```text
Raw prompt
  -> Prompt Lab rewrite
  -> Spec Builder requirements graph
  -> TDD Plan
  -> Deep Mission draft
  -> durable scheduler queue
  -> checkpoint worker
  -> artifact + gate evidence
  -> swarm signal processor
  -> Review Gate
  -> metric snapshot
  -> Quest/Progress unlock
  -> public share or team handoff
```

## 8. State Diagrams

### Ticket State

```text
TODO
  -> RED_CHECK_WRITTEN
  -> EXPECTED_FAIL_CONFIRMED
  -> IMPLEMENTED
  -> TARGETED_TESTS_PASS
  -> BROAD_VALIDATION_PASS
  -> WORKLOG_COMPLETE
  -> COMMITTED
  -> DONE

Invariants:
  - DONE requires worklog.
  - Runtime feature DONE requires tests or explicit blocker.
  - No production provider in tests.
```

### Account Session State

```text
unauthenticated
  -> login_submitted
  -> remote_login_accepted
  -> session_cookie_captured
  -> persisted_encrypted
  -> hydrated_on_restart
  -> authenticated
  -> logout
  -> cleared

Failure states:
  remote_rejected
  persistence_unavailable
  corrupt_session_deleted
```

### Mission Run State

```text
draft
  -> queued
  -> running
  -> checkpoint_due
  -> checkpoint_completed
  -> final_verification
  -> completed

Alternative states:
  blocked
  failed
  cancelled

Invariants:
  - elapsed time alone never completes a mission.
  - final pass requires artifact/gate evidence.
  - paid capacity does not satisfy quality gates.
```

### Package Visibility State

```text
built_in -> visible to all
public   -> visible to all after trust checks
private  -> visible only to owner user
team     -> visible only to owner team members

Failure states:
  missing contract -> cannot install
  prompt injection warning -> blocks public publish
  cross-tenant access -> hidden/denied
```

## 9. What Is Done

Done and verified:

- Upstream v0.9.1 is integrated into the ROX branch.
- ROX Workbench, account, Experience Layer, i18n, webui, and sync layers are preserved.
- Backlog accounting is normalized.
- Account session persistence exists and is tested.
- Public share provider seam exists and is tested.
- Aggregate persistence adapter contracts exist and are tested.
- Experience Layer screens exist and have deterministic component/domain tests.
- Full `bun test`, typecheck, docs validation, lint, and Electron build passed after T065.
- Local Electron app is running from this repo.

## 10. What Is Not Done

Not production-complete:

- Production DB adapter for the T065 aggregate persistence seam.
- Durable server-side scheduler for 6h/24h/72h missions.
- Real long-running worker recovery after app/backend restart.
- Real Workbench provider orchestration for new Prompt Lab / Spec / Review / Mission flows.
- New production public shortlink backend independent of the existing viewer contract.
- Real production S3/MinIO quota enforcement through the new persistence seam.
- Real billing settlement beyond deterministic ledger/provider contracts.
- Production email delivery.
- Signed/notarized production release.
- CI/CD private release pipeline for the final RC.
- GitHub push from this environment; push was blocked by the runtime approval policy before a git process could run.

## 11. Options And Tradeoffs

### Option A - Keep polishing UI first

Pros:

- Fast visible improvement.
- Helps user confidence.

Cons:

- Does not make missions durable.
- Does not fix provider/runtime gaps.
- Risks making beautiful demo screens over fake state.

### Option B - Wire production providers directly now

Pros:

- Faster path to real external behavior for one flow.

Cons:

- High coupling.
- Hard to test.
- Can leak provider assumptions into UI/domain code.
- Violates the fake-provider contract discipline.

### Option C - Finish integration seams first, then polish

Pros:

- Preserves testability.
- Lets UI, scheduler, providers, and storage share one truth model.
- Makes final e2e scenarios meaningful.
- Reduces regression risk after upstream merge.

Cons:

- Less immediately flashy than UI-only work.
- Requires more contract and state work before the product feels alive.

Recommendation:

```text
Use Option C.
Close T066-T068 first, then T069 visual polish, then T070-T072 release/security/RC.
```

## 12. Recommended Next Path

```text
T065 commit
  -> T066 durable mission scheduler
  -> T067 real provider orchestration
  -> T068 Experience Layer real-state binding
  -> T069 visual polish v2
  -> T070 CI/CD private release pipeline
  -> T071 security and abuse hardening
  -> T072 final release candidate
```

The critical rule:

```text
No UI state should pretend a mission, quest, unlock, score, or share is real
unless it has domain state, persistence, provider result, audit/artifact evidence,
and validation feedback behind it.
```
