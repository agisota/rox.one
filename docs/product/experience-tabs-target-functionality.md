# Experience Tabs Target Functionality

Status: target operating spec for the Electron `Опыт` section  
Owner: ROX ONE Agent Workbench  
Last updated: 2026-05-09  
Related implementation: `WorkbenchRoutePage`, `ExperienceDemoConsole`, `demo-experience-sessions`

## Reformulated Task

The `Опыт` section must stop feeling like six decorative panels. Each tab must
explain what it does, expose working controls, show realistic sanitized demo
content, and make the same underlying truth state visible through a different
operational lens.

The target UX is:

1. choose one of five demo/session examples for the current tab;
2. inspect objective, readiness, VDI, risk, MCP presets, and expected result;
3. use clear buttons that update visible state or intentionally block with a
   reason;
4. continue into the tab body, where the same `ExperienceTruthState` powers the
   operational screen;
5. carry evidence forward into mission control, progression, quests, and agent
   packages without leaking raw private transcripts or secrets.

## Assumptions And Boundaries

Assumptions:

- `ExperienceTruthState` is the canonical product state for all six tabs.
- Demo content is sanitized and can use realistic operator themes without raw
  prompts, credentials, local absolute paths, cookies, or transcript bodies.
- Game/Arena presentation can change copy and motivation, but cannot bypass
  quality gates, budget limits, trust checks, or evidence requirements.
- Button clicks should always produce one of three outcomes: visible local state
  change, disabled state with visible reason, or runtime action with evidence.

Boundaries:

- This document defines target behavior and current implementation status. It
  does not authorize production side effects from demo buttons.
- Real external provider execution, billing, public marketplace publication, and
  full raw transcript import remain separate gated features.
- MCP presets in demos mean configured source presets and expectations, not
  proof that every external API credential is present.

## Data-Flow Diagram

```text
Sources
  - sanitized demo specs
  - imported Rox/agent session index
  - default MCP/source presets
  - runtime mission events
  - validation gates and artifact refs
        |
        v
Transforms
  - redact secrets and private paths
  - infer mission/checkpoints/gates/metrics
  - validate with ExperienceTruthState schema
  - project tab-specific view state
        |
        v
Storage
  - demo session catalog in renderer fixtures
  - workspace session.jsonl stubs for imported sessions
  - runtime/persistence adapters for mission events
  - source preset folders for MCP configs
        |
        v
Consumers
  - Demo Console
  - Deep Missions
  - Arena Builder
  - Mission Control
  - Progression
  - Quest Map
  - Agent Forge
        |
        v
Checkpoints
  - renderable tab with 5 demos
  - button produces feedback or block reason
  - truth projection passes tests
  - evidence refs remain sanitized
  - build/smoke validates app startup
```

## Options And Tradeoffs

| Option | Shape | Pros | Cons |
|---|---|---|---|
| Minimal guide text | Static docs only | Cheap, no UI risk | Does not prove controls work |
| Per-tab bespoke demo logic | Every tab owns its own demo model | Maximum local control | Easy to drift and duplicate |
| Shared demo console plus tab projections | One demo selector/action layer feeds the six screens | Consistent UX, testable, one truth state | Requires strict schema discipline |

Recommended path: shared demo console plus tab projections. It keeps the first
screen understandable and still lets each tab keep its own operational controls.

## Shared Demo Console

Appears at the top of every `Опыт` tab.

### Buttons

| Button | Target function | Data flow | UX requirement |
|---|---|---|---|
| `Настроить` | Show selected agent package, VDI target, package type, risk posture, and MCP presets for the demo. | `DemoExperienceSession` -> action result panel. | Immediate visible feedback, no external side effect. |
| `Запустить демо` | Simulate the scenario entering its modeled status (`draft`, `queued`, `running`, etc.). | Demo action metadata -> action result panel. | User understands this is a safe local demo, not a production job. |
| `Ожидания` | Explain what successful completion should produce. | `reward`, metrics, risk -> action result panel. | Names expected VDI/reward/blocking reason shape. |
| `Evidence` | Show the artifact/gate/ledger/quest refs that would prove the scenario. | `truthState.metricSnapshots`, gate refs, quest progress -> action result panel. | Evidence is inspectable and sanitized. |
| `Сбросить` | Return the demo feedback area to the initial session context. | Active session id -> default action result. | No selected session loss, no page reload. |
| Session selector pills | Switch between five sanitized examples for the active tab. | selected demo id -> `ExperienceTruthState` -> tab screen props. | The entire tab body updates coherently. |

### Target User Flow

1. User opens any `Опыт` tab.
2. User sees five examples and chooses one.
3. User presses `Настроить` to understand required package/MCP context.
4. User presses `Запустить демо` to see the scenario status and expected state.
5. User presses `Evidence` before trusting progress/quest/package changes.
6. User continues into the tab-specific panel below.

### Target UX

- No empty panel.
- No silent button.
- No hidden fixture that only tests can see.
- Every action explains what happened, what is blocked, or what evidence is
  required next.

## 1. Долгие миссии

Purpose: convert a raw high-stakes operator request into a bounded autonomous
mission with duration, checkpoints, budget, selected agents, and VDI target.

### Buttons And Controls

| Control | Target function | Data flow | UX target |
|---|---|---|---|
| `Сохранить черновик` | Persist or simulate persistence for the current mission draft. | form state -> draft persistence adapter -> visible draft status. | Confirms title and duration; never silently no-ops. |
| `Запустить миссию` | Create launch plan, checkpoint plan, and runtime mission record. | form state -> scheduler adapter -> runtime store -> launch status. | Disabled until `canLaunch`; failures appear in launch status. |
| Preset cards | Apply 6/24/72-hour mission defaults and recommended agent count. | preset id -> `DeepMissionEntryState`. | User sees changed duration/cadence/scale immediately. |
| Form inputs | Edit mission title, mode, layer, objective, raw input, budget, tokens, storage, agent count, VDI. | input -> draft state -> validation errors/checkpoint preview. | State updates locally without losing demo context. |

### User Flow

1. Select a demo such as ROX production RC.
2. Review objective and risk in the demo console.
3. Choose mission preset.
4. Edit mission brief and limits.
5. Save draft.
6. Launch only when validation says ready.
7. Move into `Центр миссий` for live checkpoint operations.

### Available Functions

- mission draft composition;
- preset selection;
- budget/token/storage guardrails;
- checkpoint preview;
- readiness validation;
- fake scheduler/runtime launch path for safe local proof.

## 2. Арена агентов

Purpose: compare agents or skill packs on the same mission before committing to
a run.

### Buttons And Controls

| Control | Target function | Data flow | UX target |
|---|---|---|---|
| `Создать прогон` | Freeze selected agent packages into a swarm draft. | selected package ids -> run estimate -> `ArenaDraftRun`. | Disabled when slots/trust/unlock rules fail. |
| Agent cards | Toggle unlocked agents into or out of the draft team. | package id -> selection state -> budget estimate/warnings. | Selected cards are visually distinct; locked cards explain unlock criteria. |

### User Flow

1. Pick an arena demo.
2. Inspect MCP presets and expected comparison goal.
3. Select agents from the roster.
4. Watch slots, trust floor, and budget estimate update.
5. Create a draft run.
6. Send the chosen team into mission execution.

### Available Functions

- unlocked/locked agent roster;
- trust score and mastery display;
- swarm slot enforcement;
- draft run creation;
- selection warnings for blocked choices.

## 3. Центр миссий

Purpose: operate an active mission: checkpoints, approvals, artifacts, gates,
audit, billing, and finalization.

### Buttons And Controls

| Control | Target function | Data flow | UX target |
|---|---|---|---|
| `Финализировать миссию` | Complete the mission only when gates and evidence allow it. | mission state -> finalization action -> runtime/panel status. | Disabled or blocked until `canFinalize`; block reason visible. |
| `Одобрить ветку` | Approve expensive/risky branch before further spend. | approval id -> approval state -> blocking reasons. | Visible confirmation: approval granted locally. |
| `Отметить готовым` | Mark checkpoint complete locally or through runtime store. | checkpoint id -> checkpoint transition -> last action/status. | Checkpoint status changes and records action text. |

### User Flow

1. Open a live/completed mission demo.
2. Review validation gates and blockers.
3. Approve expensive branches only when justified.
4. Mark checkpoints complete as evidence arrives.
5. Inspect artifacts, audit, and billing trace.
6. Finalize once no blocking gate remains.

### Available Functions

- checkpoint transition;
- runtime-backed checkpoint completion when a store exists;
- approval handling;
- finalization guard;
- audit/billing visibility;
- swarm feed review.

## 4. Прогресс

Purpose: translate verified work into VDI, XP, readiness, cost efficiency, risk
burn-down, and leaderboard/progression context.

### Buttons And Controls

| Control | Target function | Data flow | UX target |
|---|---|---|---|
| `Записать XP evidence` | Append an evidence-backed XP ledger event. | UI action -> ledger event -> progression state/ledger panel. | User sees the new XP entry without trusting vanity points. |

### User Flow

1. Select a progress demo.
2. Inspect current VDI and evidence refs.
3. Review quality/readiness/cost/risk/noise metrics.
4. Add an evidence XP event.
5. Confirm the ledger records reason, amount, currency, and artifact source.

### Available Functions

- VDI and submetric dashboard;
- evidence-backed ledger;
- privacy-aware leaderboard projection;
- capacity display as entitlement, not quality boost;
- fairness rules.

## 5. Карта квестов

Purpose: show the long capability roadmap and unlock rules as evidence-gated
quests.

### Buttons And Controls

| Control | Target function | Data flow | UX target |
|---|---|---|---|
| `Завершить с evidence` | Complete an available quest and evaluate unlock rules. | quest id -> evidence ref -> quest progress -> unlocked rewards. | Disabled for locked/completed quests; success writes visible runtime action. |
| `Квест закрыт` | Completed-state label for already completed quests. | quest progress status -> disabled control. | Clear status, no repeated completion. |

### User Flow

1. Select a quest demo.
2. Inspect active lane and current progress.
3. Complete only available quests.
4. Watch progress/reward unlocks update.
5. Use unlocked capability in future missions or packages.

### Available Functions

- lane grouping: formulation, specification, execution, verification,
  marketplace, team, arena;
- locked/available/active/completed status;
- evidence-gated completion;
- unlock rule evaluation;
- mode-specific copy without truth divergence.

## 6. Кузница агентов

Purpose: convert repeated workflows, skills, and session patterns into managed
private/team/public agent packages with trust and permission gates.

### Buttons And Controls

| Control | Target function | Data flow | UX target |
|---|---|---|---|
| `Установить` | Install a package only when a contract permits it. | package id -> contract lookup -> installed package ids. | Disabled after install; blocked errors appear in action panel. |
| `Установлен` | Show already installed state. | installed ids -> disabled button label. | Prevent duplicate install confusion. |
| `Форкнуть` | Create a team-owned fork preserving contract/review/test metadata. | source package -> copied package + team visibility. | New fork appears in visible package list. |
| `Publish public` | Attempt public publication through trust, review, test, and warning gates. | package id -> publish guard -> visibility/public or block reason. | Must block unsafe packages with explicit reason. |

### User Flow

1. Select an agent forge demo.
2. Review package visibility, trust score, risk, warnings, and contract status.
3. Install safe package.
4. Fork into team registry when customization is needed.
5. Publish publicly only after contract, reviews, tests, and prompt-injection
   checks pass.

### Available Functions

- visible package filtering by team/private/public scope;
- contract presence gate;
- install/fork/publish actions;
- trust score projection;
- prompt-injection warning display;
- team registry preparation before public marketplace.

## Cross-Tab Target Flow

```text
Долгие миссии
  -> creates bounded mission draft
Арена агентов
  -> selects best trusted agents/skills
Центр миссий
  -> operates checkpoints, approvals, evidence, finalization
Прогресс
  -> converts verified evidence into VDI/XP/readiness
Карта квестов
  -> unlocks next capabilities from evidence
Кузница агентов
  -> packages the repeated pattern for reuse
  -> feeds packages back into missions and arena
```

## Acceptance Criteria

- Every tab has exactly five visible sanitized demo examples.
- Every demo exposes source label, objective, usage/setup/expected outcomes,
  MCP presets, VDI, readiness, risk, and evidence references.
- Every clickable button either mutates visible local state, calls a runtime
  adapter, or shows a blocked/disabled reason.
- No tab can fabricate VDI, XP, quest completion, package trust, or mission
  finalization without evidence.
- Imported external sessions remain sanitized stubs until a separate raw
  transcript importer passes redaction and dry-run review.
- Build, typecheck, route tests, and Electron smoke must pass before claiming
  the section works.

## Implementation Checkpoints

Current implemented checkpoint:

- shared demo console exists on all six tabs;
- five demo examples per tab are rendered;
- tab body receives the selected demo `ExperienceTruthState`;
- Deep Missions save/launch, Mission Control checkpoint/approval/finalize,
  Progression XP, Quest Map completion, Agent Forge install/fork/publish, and
  Arena draft creation expose visible local feedback or disabled/block states.

Next hardening checkpoints:

- add browser/Electron click evidence once macOS accessibility or Playwright
  Electron attachment is stable in the local environment;
- persist demo action state only if product wants demos to survive page switch;
- add a raw transcript importer only behind redaction, schema validation, and
  dry-run diff.
