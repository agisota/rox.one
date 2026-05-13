# Agent Workbench Suite Plan

Date: 2026-05-13
Repository: `/home/dev/rox/rox-one-terminal`
Successor goal: this rebrand sweep (R.0-R.10) and the end-to-end spine roadmap.

> See also: **end-to-end spine roadmap** at
> [`docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md`](docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md).
> The spine supersedes this file's §4 (Next Tickets), §6 (upstream merge target
> bumped from v0.9.1 to **v0.9.3**), and §17 (Parallel Execution Plan, replaced
> by the spine's concurrency rules). Other sections remain useful as historical
> design context.

This plan records the historical Agent Workbench Suite direction and now points
forward to the active ROX.ONE rebrand sweep before the next roadmap phase.

## 1. Target Definition

The target product is:

```text
ROX.ONE Agent Workbench Suite

A white-label ROX.ONE fork descended from upstream Rox Agents OSS that turns
rough user intent into:
  - improved prompts
  - structured specs
  - TDD task packs
  - agent execution plans
  - long-running missions
  - swarm reviews
  - validated deliverables
  - account/team/cloud workspace operations
```

North Star:

```text
Verified Deliverable Index (VDI)
```

Submetrics:

```text
Quality Score
Execution Readiness
Open Risk Score
Cost Efficiency
Noise Score
Trust / Mastery / XP
```

## 2. Definition Of Done

The project is done when all of the following are true.

### 2.1 Product UX

- User can start from a raw prompt and route it through Rewrite, Think, Spec,
  TDD, Review, Verify and Experience Mission flows.
- Composer/action buttons are not demo shells; they create real state,
  artifacts, tasks or missions.
- Deep Missions, Arena Builder, Mission Control, Progression, Quest Map and
  Agent Forge are visually coherent, Russian-first and connected to shared
  mission truth.
- Command/Game/Arena mode switch changes presentation only; evidence, gates,
  metrics and ledger stay shared.
- UI has polished typography, color hierarchy, alignment, hover/focus/disabled/
  loading/error states and responsive behavior.

### 2.2 Account And Team

- Registration, login, logout and password reset work inside the app.
- Account session persists securely across app restarts.
- Personal cabinet is user-centered, not a white-label info dump.
- Teams, invites, spaces and shared workspaces have RBAC tests and production
  persistence.
- Billing ledger is idempotent, auditable and protected against spoofing.
- Paid capacity can increase limits only; it never satisfies quality gates.

### 2.3 Execution And Missions

- Long-running 6h/24h/72h missions can run through a durable scheduler.
- Checkpoints produce intermediate artifacts on cadence.
- Final mission status depends on validation evidence, not elapsed time.
- Swarm runs dedupe contributions and preserve severe minority reports.
- 100-agent/large swarm paths require budget/capacity approval.
- Agent packages require contracts, permissions, trust checks and visibility
  controls.

### 2.4 Storage, Sync And Share

- Local-cloud sync uses explicit snapshots, conflict detection and no silent
  overwrite.
- Public session sharing generates a working shortlink through a real backend.
- Share failures are specific and actionable.
- Storage quotas are enforced against production object storage.
- Large artifacts have a durable storage strategy.

### 2.5 Upstream And Release

- The fork is merged/rebased onto current upstream Rox Agents OSS v0.9.x without
  losing ROX branding, localization, account, registration or Experience Layer
  changes.
- Electron app builds locally.
- Mac ARM dev package builds.
- CI runs lint, typecheck, unit, integration, UI, E2E, docs and security gates.
- Release candidate includes known limitations, user guide and admin guide.
- Private GitHub repo is the canonical remote for ROX work.

## 3. Current State Summary

Already done in the current branch:

```text
T000-T041
T054-T059
```

Implemented as worklog slices under T041:

```text
T042-T053
```

Next accounting cleanup:

```text
Create canonical docs/tickets/T042-T053*.md files
or explicitly declare T042-T053 as T041 subtasks.
```

Private GitHub state:

```text
origin: https://github.com/agisota/rox-one-terminal.git
visibility: private
```

Upstream state:

```text
local package.json: 0.8.12
observed upstream tags: v0.9.0, v0.9.1
```

## 4. Next Tickets

The next clean sequence should start at T060 to avoid rewriting already closed
history.

```text
T060 - Backlog normalization
T061 - Upstream v0.9.1 merge/rebase plan and protected-file map
T062 - Upstream v0.9.1 merge implementation
T063 - Account persistent session storage
T064 - Public share shortlink backend hardening
T065 - Production account/team/storage persistence adapter
T066 - Durable long-running mission scheduler
T067 - Real provider orchestration for Workbench flows
T068 - Experience Layer real-state binding
T069 - Visual polish v2 and motion/interaction QA
T070 - CI/CD private release pipeline
T071 - Security and abuse hardening pass
T072 - Final product release candidate
```

## 5. T060 - Backlog Normalization

Goal:

```text
Make ticket accounting unambiguous.
```

Work:

- Create or normalize `docs/tickets/T042-T053*.md`.
- Link each ticket to existing worklog.
- Keep status as `DONE` only where matching worklog and commit evidence exists.
- Update `.swarm/inventory.md` and `.swarm/backlog-status.md`.
- Add a validation script or extend existing docs validator so missing
  ticket/worklog aliases are caught.

Acceptance:

```text
48 or 60+ count is no longer ambiguous.
Every DONE ticket has a matching worklog.
Every T041 subtask is explicitly represented.
```

## 6. T061-T062 - Upstream v0.9.1 Merge

### 6.1 Merge Strategy

Do not merge upstream directly into `main`.

Use:

```text
branch: mac/upstream-v0.9.1-rox-merge
```

Remote setup:

```text
origin       -> private ROX.ONE repo
rox-origin -> current agisota/rox reference
upstream     -> https://github.com/lukilabs/rox-agents-oss.git
```

Recommended commands:

```text
git remote add upstream https://github.com/lukilabs/rox-agents-oss.git
git fetch upstream --tags
git switch -c mac/upstream-v0.9.1-rox-merge
git diff --stat v0.8.12..v0.9.1
git merge --no-ff v0.9.1
```

The exact base may need adjustment after inspecting the upstream tag ancestry.

### 6.2 Protected ROX-Owned Surfaces

These areas need explicit owner review during merge:

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

### 6.3 Merge Data Flow

```text
upstream v0.9.1
    |
    v
diff analysis
    |
    +-- upstream bugfixes
    +-- dependency updates
    +-- session/auth changes
    +-- shell/renderer changes
    |
    v
protected ROX map
    |
    +-- keep ROX branding/localization
    +-- keep account proxy/register/login
    +-- keep workbench screens
    +-- keep Experience Layer
    |
    v
merge branch
    |
    v
targeted tests
    |
    v
Electron smoke
    |
    v
private GitHub push
```

### 6.4 Merge Gate

Required checks after merge:

```text
bun run validate:agent-contract
bun run validate:docs
bun run typecheck:all
bun test
bun run lint:i18n:parity
bun run e2e:core
bun run electron:build
git diff --check
```

If `typecheck:all` or full `bun test` is too large/noisy, first fix targeted
failures, then rerun the full relevant gate.

## 7. T063 - Account Persistent Session Storage

Problem:

```text
Current desktop account proxy stores rox_session in main-process memory.
That fixes same-process requests but not app restart persistence.
```

Target:

```text
secure persistent account session
```

Implementation options:

```text
Option A: Electron safeStorage + local encrypted session file
  Pros: fast local implementation, desktop-native
  Cons: needs careful migration/logout handling

Option B: OS keychain
  Pros: stronger native secret storage
  Cons: extra integration complexity

Option C: remote refresh token only
  Pros: cleaner SaaS model
  Cons: needs backend refresh-token design
```

Recommendation:

```text
Start with Electron safeStorage, then add keychain/refresh-token support later.
```

Sequence:

```text
login/register
    |
    v
capture rox_session
    |
    v
encrypt with safeStorage
    |
    v
persist under app userData
    |
    v
on app start: decrypt and hydrate proxy cookie
    |
    v
/api/account/me confirms session
```

Acceptance:

- Login survives app restart.
- Logout clears encrypted session.
- Corrupt session file fails closed.
- Tests do not use real ROX API.

## 8. T064 - Public Share Shortlink

Problem:

```text
Local app can only generate a real shortlink if the remote viewer/share backend
accepts the session upload.
```

Target:

```text
Working public session share shortlink.
```

Flow:

```text
Session bundle
    |
    v
share upload API
    |
    v
viewer object storage
    |
    v
shortlink service
    |
    v
public URL
```

Required work:

- Verify remote viewer endpoint.
- Define auth contract.
- Add deterministic fake share provider tests.
- Add production upload retry/error handling.
- Add UI states: copying, copied, expired, failed, auth required.
- Add server-side shortlink model.

Acceptance:

- Public share creates a real URL.
- Failure reasons are specific.
- No secret/session token leaks into public payload.

## 9. T065 - Production Persistence

Current MVP contracts should move from in-memory stores to a production adapter.

Surfaces:

```text
account users
teams/invites/spaces
billing ledger
storage quota
cloud workspaces
sync operations
audit events
mission runs
quest progress
agent packages
```

Recommended data model:

```text
users
sessions
teams
team_members
invites
spaces
workspaces
workspace_members
ledger_entries
storage_objects
sync_snapshots
sync_operations
mission_runs
mission_checkpoints
agent_packages
quest_progress
audit_events
```

Rule:

```text
Start with an adapter interface and fake implementation tests.
Do not wire production DB before contracts are stable.
```

## 10. T066 - Durable Mission Scheduler

Current scheduler is deterministic and in-process/fake. Production needs durable
execution.

Target:

```text
24h/72h missions continue across app sleep/restart/backend restart.
```

State machine:

```text
draft -> queued -> running -> blocked/completed/failed/cancelled
```

Sequence:

```text
Mission created
    |
    v
persist MissionRun
    |
    v
enqueue checkpoint jobs
    |
    v
worker executes due checkpoint
    |
    v
artifact/gate evidence persisted
    |
    v
user notified every cadence
    |
    v
final verification
```

Acceptance:

- No completion by elapsed time alone.
- Restart does not lose mission state.
- Budget/capacity is checked before each branch.
- Human approval gates block expensive expansions.

## 11. T067 - Real Provider Orchestration

Current tests forbid real providers. Production work should add provider
adapters while keeping fake deterministic providers in tests.

Providers:

```text
LLM
browser research
object storage
email
billing/payment
shortlink/viewer
scheduler
agent package registry
```

Rule:

```text
Every real provider must have a fake provider with identical contract tests.
```

## 12. T068 - Experience Real-State Binding

Current Experience screens can render states and fake data. They need to bind to
real mission state.

Required:

- mission store
- checkpoint updates
- live audit feed
- VDI snapshots
- quest progress updates
- agent package install/fork actions
- command/game/arena preference persistence

Data flow:

```text
Mission store
    |
    v
Experience selector
    |
    v
screen state builder
    |
    v
React Experience screens
    |
    v
actions/events
    |
    v
mission store
```

## 13. T069 - Visual Polish v2

Goal:

```text
Make the product feel like a serious mission-control tower by default,
with switchable Game/Arena modes that feel intentional, not decorative.
```

Work:

- audit typography scale
- reduce dead empty space
- improve grid rhythm
- add loading/skeleton/empty/error states
- add hover/focus/selected/disabled states
- add subtle motion only where it clarifies progress
- tune color hierarchy so gamification states are visible but not noisy
- run screenshot comparison across core screens

Screens:

```text
Composer
Prompt Lab
Spec Builder
Review Gate
Account
Deep Missions
Arena Builder
Mission Control
Progression
Quest Map
Agent Forge
```

## 14. T070 - CI/CD And Private Release

Target:

```text
Private GitHub is canonical.
CI proves app quality on every push.
Release artifacts are reproducible.
```

Required:

- GitHub Actions for lint/typecheck/test/docs/build.
- Mac ARM dev build.
- Release notes generation.
- Private artifact upload.
- Dependency vulnerability review.
- Dependabot alerts triage.

## 15. T071 - Security And Abuse Hardening

Required checks:

```text
tenant isolation
workspace RBAC
team package visibility
ledger spoofing
quota bypass
shortlink payload leakage
prompt-injection package scan
mission budget bypass
paid entitlement bypass
secret redaction
sync conflict overwrite
```

Rule:

```text
Security tests must fail closed.
```

## 16. T072 - Final Product Release Candidate

Release candidate scenarios:

```text
1. Register -> login -> account persists after restart.
2. Raw prompt -> Rewrite -> Spec -> TDD -> Review.
3. Create 24h mission -> checkpoint -> final verification.
4. Arena swarm -> dedupe signals -> review board -> VDI update.
5. Team invite -> shared workspace -> RBAC check.
6. File upload -> entity graph -> source link.
7. Sync push/pull -> conflict -> explicit resolution.
8. Share session -> public shortlink opens.
9. Upstream v0.9.1 base still passes ROX custom flows.
10. Mac ARM build opens and smoke passes.
```

## 17. Parallel Execution Plan

Use independent lanes only after T060/T061 clarify ownership.

```text
Lane A - Upstream merge
  owns: package/app shell/session/provider conflicts

Lane B - Account/share
  owns: persistent login, shortlink, account UX

Lane C - Experience runtime
  owns: durable scheduler, real-state binding, mission persistence

Lane D - Visual polish
  owns: shared UI primitives, screenshots, responsive states

Lane E - Security/CI
  owns: RBAC, ledger, quota, CI/CD, release gates
```

Shared-file rule:

```text
Only one lane owns shared files at a time:
package.json
bun.lock
global CSS
route registry
shared schemas
app shell
account API bridge
```

## 18. Recommended Immediate Next Commands

After this snapshot/plan commit:

```text
git status --short --branch
bun run validate:docs
bun run electron:build
bun run electron:start
```

Then start T060:

```text
Create docs/tickets/T060-backlog-normalization.md
Update docs/worklog/T060-backlog-normalization.md
Normalize T042-T053 accounting
Run docs validator
Commit and push
```

Then T061:

```text
Add upstream remote if missing
Fetch v0.9.1
Create mac/upstream-v0.9.1-rox-merge
Generate protected-file conflict map
Write merge test matrix
```
