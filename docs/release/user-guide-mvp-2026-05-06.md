# ROX ONE Agent Workbench Suite - MVP User Guide 2026-05-06

Audience: private RC operators and product reviewers.
Scope: local Electron app with deterministic fake providers.

## 1. What You Can Validate

You can validate the core ROX ONE product loop:

```text
raw prompt
  -> rewrite
  -> spec
  -> TDD plan
  -> review gate
  -> mission draft
  -> fake-provider mission launch
  -> checkpoint evidence
  -> VDI/Quality/Readiness update
  -> quest/progression update
  -> share/account state feedback
```

## 2. Main Screens

| Screen | Purpose |
|---|---|
| Composer | Start from raw intent and create workbench artifacts. |
| Prompt Lab | Rewrite and structure prompts. |
| Spec Builder | Compile intent into executable product/spec shape. |
| TDD Plan | Convert spec into test-first implementation plan. |
| Review Gate | Create findings, warnings, blockers, and validation gates. |
| Долгие миссии | Draft and launch long-running missions. |
| Центр миссий | Inspect active mission state, checkpoints, gates, artifacts, and audit feed. |
| Арена агентов | Select trusted agents and create swarm mission drafts. |
| Прогресс | Read app-wide Quality, Readiness, VDI, risk, XP, and progression. |
| Карта квестов | See completed and locked quests with evidence requirements. |
| Кузница агентов | Install/fork trusted agent packages. |
| ROX ID | Login/register/reset, inspect profile, logout, and refresh account state. |

## 3. Mission Flow

```text
Open "Долгие миссии"
  -> enter title, objective, raw input
  -> choose mode, layer, preset, duration, cadence
  -> set budget/token/storage/agent/VDI limits
  -> fix validation messages until ready
  -> launch
  -> open "Центр миссий"
  -> inspect checkpoint/gate/artifact state
```

Important: launch does not mean success. A mission completes only after final
artifact evidence and passing validation gate evidence exist.

## 4. Metrics

| Metric | Meaning |
|---|---|
| Quality Score | Evidence-backed quality signal from review/gate outcomes. |
| Execution Readiness | How ready the work is to execute based on spec/TDD/review state. |
| Verified Deliverable Index | Verified deliverables only; never paid capacity. |
| Open Risk Score | Unresolved warnings, blockers, failed gates, and unsafe signals. |
| Noise Score | Deduped provider/swarm signal quality. |
| Swarm Capacity | Capacity entitlement and selected agent coverage. |

## 5. Quest Flow

```text
Complete real action
  -> runtime event
  -> required evidence check
  -> quest completion
  -> reward/unlock
  -> HUD and Progress update
```

Locked quests cannot be completed manually. Paid plans can increase capacity,
but cannot complete evidence, VDI, quality, readiness, or leaderboard goals.

## 6. ROX ID

Use ROX ID for account-state validation:

```text
register
  -> pending verification
  -> no false authenticated success

login
  -> confirmed session required
  -> profile summary shown

logout
  -> local/session state cleared
```

If an error occurs, the UI shows a classified Russian state such as
`auth_required`, `invalid_credentials`, `email_unverified`, `network_error`,
`server_error`, or `session_expired`.

## 7. Share Flow

```text
Share
  -> prepare bundle
  -> redact sensitive payload
  -> upload through ShareProvider
  -> create shortlink through ShareProvider
  -> copied / retryable failure / permanent failure / revoked
```

The RC does not pretend a local fake URL is a public production URL.

## 8. RC Caveat

All external effects are fake-provider-safe unless a future operator explicitly
wires real provider credentials and hosted infrastructure.
