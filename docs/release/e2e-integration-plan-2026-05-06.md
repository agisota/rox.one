# ROX ONE Agent Workbench - E2E Integration Plan

Date: 2026-05-06
Branch: `mac/upstream-v0.9.1-rox-merge`

## 1. Goal

Complete the e2e integration of the new ROX ONE / Agent Workbench features so that the product is not just a set of screens and fake-provider contracts, but a working agent workbench with durable state, reliable account/share behavior, mission execution, evidence-backed progression, and final release gates.

Target end state:

```text
User intent
  -> prompt/spec/review/mission UI
  -> typed domain event
  -> durable state mutation
  -> provider adapter call
  -> artifact/audit/evidence record
  -> validation gate
  -> score/progression update
  -> share/team handoff
  -> e2e test + build + release evidence
```

## 2. Definition Of Done

A feature is done only if this chain is true:

```text
UI action
  -> typed event or RPC
  -> domain state mutation
  -> persistence adapter write
  -> provider adapter interaction or deterministic fake equivalent
  -> audit/artifact/evidence record
  -> validation gate result
  -> user-visible feedback state
  -> unit/integration/UI/e2e/security tests
  -> build/smoke validation
```

Non-negotiable invariants:

- No real provider calls in tests.
- No elapsed-time-only mission completion.
- No paid entitlement satisfying quality/evidence gates.
- No public share payload containing secrets, session cookies, tokens, or private paths.
- No cross-tenant package, workspace, ledger, quest, mission, or share access.
- No Game/Arena presentation mode mutating truth differently from Command mode.
- No uncommitted runtime logs/caches/secrets mixed into feature commits.

## 3. Current Baseline Before Next Work

Known green validation after T065 implementation:

```text
bun test packages/server-core/src/persistence/__tests__/agent-workbench-persistence.test.ts
  -> 4 pass, 0 fail

neighboring account/storage/sync/experience tests
  -> 55 pass, 0 fail

bun run validate:docs && bun test
  -> 4644 pass, 13 skip, 0 fail

bun run typecheck:all
  -> pass

bun run lint
  -> 0 errors, 3 existing warnings

git diff --check
  -> pass

bun run electron:build
  -> pass
```

Current branch already includes:

```text
T060 backlog normalization
T061 protected upstream merge plan
T062 upstream v0.9.1 merge implementation
T063 account persistent session storage
T064 public share provider seam
T065 persistence adapter contracts
```

## 4. High-Level Sequence

```text
User
  -> Composer / Experience screen
  -> Renderer action builder
  -> Preload / IPC / RPC
  -> Domain service
  -> AgentWorkbenchPersistenceAdapter
  -> Provider adapter
  -> Artifact store
  -> Validation gate engine
  -> Audit ledger
  -> Metrics projector
  -> Renderer state selector
  -> User-visible feedback
```

Failure boundaries:

```text
renderer validation failure
IPC serialization failure
persistence write failure
provider timeout/failure
quota/budget denial
RBAC denial
validation gate fail
artifact schema fail
share URL safety fail
mission approval required
```

## 5. T066 - Durable Long-Running Mission Scheduler

### Goal

Make 6h/24h/72h missions survive restart/sleep/backend recovery and execute checkpoints from persisted mission state.

### Write Tests First

Unit tests:

- mission state transition reducer
- due checkpoint calculation
- idempotency key handling
- no completion by elapsed time alone
- budget/capacity preflight before branch expansion

Integration tests:

- create mission persists `MissionRun`
- enqueue checkpoint jobs
- restart recovery finds due checkpoint
- checkpoint completion writes artifact/gate evidence
- final verification requires evidence and pass/warn/fail result

Security tests:

- user cannot execute another user's mission
- team mission requires team membership
- paid entitlement increases capacity only
- approval required for expensive swarm expansion

### Implementation Scope

Likely files:

```text
packages/server-core/src/persistence/
packages/server-core/src/missions/
packages/shared/src/workbench/mission-scheduler-adapter.ts
packages/shared/src/workbench/experience-layer.ts
apps/electron/src/main/
apps/electron/src/renderer/components/workbench/
```

New contracts:

```text
MissionScheduler
MissionJobRepository
MissionWorkerRuntime
MissionCheckpointExecutor
MissionArtifactWriter
MissionGateRunner
```

### State Diagram

```text
draft
  -> queued
  -> running
  -> checkpoint_due
  -> checkpoint_running
  -> checkpoint_completed
  -> final_verification
  -> completed

blocked:
  quota_denied
  approval_required
  gate_failed
  provider_failed

terminal:
  completed
  failed
  cancelled
```

### Acceptance

- Mission persists before execution.
- Restart recovery resumes due checkpoints.
- Checkpoints are idempotent.
- Final completion requires evidence.
- Fake scheduler tests pass.
- Existing full test suite remains green.

## 6. T067 - Real Provider Orchestration For Workbench Flows

### Goal

Connect Prompt Lab, Spec Builder, Review Gate, TDD Plan, and missions to provider adapters without hardcoding real providers in tests.

### Provider Matrix

| Domain | Fake Provider | Real Adapter Later |
|---|---|---|
| LLM rewrite/spec/review | deterministic text fixture | OpenAI/Anthropic/Google/local model |
| Browser/research | fixture pages | browser/search provider |
| Artifact storage | in-memory/local blob | S3/R2/MinIO/GCS |
| Email | captured outbox | SMTP/provider |
| Billing | deterministic ledger | DV.net/payment backend |
| Share | fake URL registry | production viewer/shortlink |
| Scheduler | fake clock | durable queue/worker |
| Agent registry | fixture packages | team/private marketplace |

### Write Tests First

- provider contract tests with fake implementation
- timeout/retry/cancel mapping
- provider failure -> actionable UI state
- no real network calls in tests
- no provider secrets in audit/share/log output

### Sequence

```text
Workbench action
  -> Build typed provider request
  -> ProviderRouter
  -> FakeProvider in tests / RealProvider in runtime
  -> Normalize response
  -> Persist artifact
  -> Run gates
  -> Emit audit event
  -> Update UI state
```

### Acceptance

- Prompt rewrite/spec/review can run through one provider gateway.
- Fake provider contract tests match real adapter interface.
- Provider failures do not mutate state as success.
- UI shows loading/error/retry/success states.

## 7. T068 - Experience Layer Real-State Binding

### Goal

Bind Experience screens to mission truth, not static fixture state.

### Screens

```text
Deep Missions
Arena Builder
Mission Control
Progression Observatory
Quest Map
Agent Forge
```

### Required Store Flow

```text
AgentWorkbenchPersistenceAdapter
  -> Mission/Quest/Metric selectors
  -> screen state builders
  -> React components
  -> user actions
  -> domain commands
  -> persistence adapter
```

### Write Tests First

UI/component:

- Deep Mission launch writes draft/queued mission.
- Mission Control shows persisted checkpoints.
- Progression reads persisted metric snapshots.
- Quest Map reads persisted quest progress.
- Agent Forge filters persisted packages by visibility.
- Command/Game/Arena labels differ but evidence/gates/ledger do not.

Integration:

- completing checkpoint updates Mission Control and Progression.
- quest unlock requires persisted evidence.
- package install requires contract/trust checks.

### Acceptance

- No screen depends only on local fixture state for primary data.
- Presentation mode changes copy/framing only.
- VDI/Quality/Execution Readiness are evidence-backed.

## 8. T069 - Visual Polish V2

### Goal

Make the product feel like a serious command center by default, with optional Game/Arena mode for motivation, unlocks, quests, hovers, motion, and feedback.

### Scope

- typography rhythm
- grid density
- consistent cards/panels
- selected/hover/focus/disabled/loading/error states
- screen empty states
- mission progress animations
- progression visual hierarchy
- game/arena toggle affordance
- screenshot QA on core screens

### Write Tests First

- visual contract tests for mode copy
- no horizontal overflow at target widths
- hover/selected class contract tests where feasible
- screenshot smoke if available

### Acceptance

- Command mode remains professional.
- Game/Arena mode is switchable.
- No hidden critical controls.
- Screens align visually with the original wireframe intent.

## 9. T070 - CI/CD Private Release Pipeline

### Goal

Make private GitHub validation and Mac build artifacts reliable.

### Required Checks

```text
validate:agent-contract
validate:docs
typecheck:all
lint
bun test
e2e:core
electron:build
secret scan
artifact upload
release notes validation
```

### Acceptance

- Private repository has protected CI workflow.
- Mac ARM build artifact is generated.
- CI does not upload caches/secrets/logs as release artifacts.
- Build can be reproduced from clean checkout.

## 10. T071 - Security And Abuse Hardening

### Goal

Prove tenant isolation, provider safety, share safety, ledger integrity, and mission budget rules.

### Required Tests

```text
tenant isolation
workspace RBAC
team package visibility
private package visibility
ledger spoofing
quota bypass
shortlink payload leakage
prompt-injection package scan
mission budget bypass
paid entitlement bypass
secret redaction
sync conflict overwrite
session persistence fail-closed
```

### Acceptance

- Security tests fail closed.
- Secrets are redacted from logs/audit/share.
- Cross-tenant reads/writes fail.
- Package installation respects trust/contract rules.

## 11. T072 - Final Release Candidate

### Goal

Close product-level e2e scenarios and produce the final RC evidence pack.

### Required Scenarios

```text
1. Register -> login -> account persists after restart.
2. Raw prompt -> Rewrite -> Spec -> TDD -> Review.
3. Create 24h mission -> checkpoint -> final verification.
4. Arena swarm -> dedupe signals -> review board -> VDI update.
5. Team invite -> shared workspace -> RBAC check.
6. File upload -> entity graph -> source link.
7. Sync push/pull -> conflict -> explicit resolution.
8. Share session -> public shortlink opens or fails with specific actionable reason.
9. Upstream v0.9.1 base still passes ROX custom flows.
10. Mac ARM build opens and smoke passes.
```

### RC Evidence Pack

```text
docs/release/final-rc-YYYY-MM-DD.md
docs/release/known-limitations-YYYY-MM-DD.md
docs/release/security-gate-results-YYYY-MM-DD.md
docs/release/e2e-results-YYYY-MM-DD.md
Mac ARM build artifact
test logs summary
manual smoke screenshots
```

## 12. Recommended Execution Order

Recommended path:

```text
1. Commit T065 and this documentation checkpoint.
2. T066 durable mission scheduler.
3. T067 provider gateway.
4. T068 Experience real-state binding.
5. T069 visual polish after state is real.
6. T070 private CI/CD.
7. T071 security hardening.
8. T072 final RC.
```

Why this order:

- T066 makes the long mission concept real.
- T067 prevents direct provider coupling.
- T068 makes the screens real-state-backed.
- T069 is more valuable after state/action feedback is real.
- T070/T071/T072 turn the branch into a release candidate instead of another demo branch.

## 13. Commands For The Next Ticket

Baseline before T066:

```bash
cd /Users/marklindgreen/Projects/craft/craft
git status --short --branch
bun run validate:docs
bun run typecheck:all
bun test
bun run electron:build
```

T066 targeted start:

```bash
cat > docs/tickets/T066-durable-mission-scheduler.md <<'EOF'
# T066 - Durable Mission Scheduler

Status: TODO

## Goal

Persist and recover long-running mission scheduling so 6h/24h/72h missions
survive restart and complete only through artifact/gate evidence.

## Acceptance Criteria

- [ ] Mission run persists before execution.
- [ ] Checkpoint jobs are recoverable after restart.
- [ ] Checkpoint execution is idempotent.
- [ ] Budget/capacity gates run before branch expansion.
- [ ] Human approval blocks expensive swarm expansion.
- [ ] Final mission completion requires artifact/gate evidence.
- [ ] Fake scheduler tests pass.
- [ ] Relevant full validation passes.
EOF
```

Core T066 prompt:

```text
Implement T066 - Durable Mission Scheduler.
Follow AGENTS.md.
Use tests first.
Use the T065 AgentWorkbenchPersistenceAdapter as the persistence boundary.
Do not call real external providers.
Do not complete a mission by elapsed time alone.
Add unit, integration, and security tests for restart recovery, checkpoint idempotency,
budget/capacity gates, approval gates, and evidence-backed final completion.
Run targeted tests, validate:docs, typecheck:all, bun test, and electron:build.
Update docs/worklog/T066-durable-mission-scheduler.md and commit scoped files only.
```

## 14. Go / No-Go Gate

Go to T066 only if:

```text
T065 scoped commit exists
validate:docs passes
typecheck:all passes
bun test passes
electron:build passes
dirty unrelated files are not staged
```

No-go if:

```text
T065 remains uncommitted
docs/tickets status count is ambiguous
public share/account regressions appear
full test suite is red
build is red
```
