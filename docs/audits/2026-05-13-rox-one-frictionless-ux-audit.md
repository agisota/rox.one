# ROX ONE Frictionless UX Audit - Experience, Composer, Missions

Date: 2026-05-13
Scope: installed `/Applications/ROX ONE.app` version `0.9.1` and source surfaces in this repo.
Classification: REVIEW + EXECUTION.

## 1. Reformulated Task

The task is not to remove the `Experience` system, and not to keep it in its current always-on form.

The task is to preserve and increase functional power while reducing visual and cognitive noise:

- keep missions, quests, progress, agent arena, prompt improvement, TDD planning, spec building, review gates, and agent forge capabilities;
- stop exposing all of that as permanent chrome before the user has a reason to use it;
- make the prompt/composer the primary work surface;
- treat `Улучшить prompt`, `TDD Plan`, `Проверить`, `Разъебать`, `Собрать ТЗ`, and `Ревью` as quick commands applied to the user's current prompt/project context, not as separate permanent modes;
- open artifact panels only as results/previews after a command has meaningful input, not as empty screens after clicking a button;
- make Experience contextual: quiet when nothing is happening, precise when something is running, inspectable when the user wants detail;
- localize and reframe the product language so the app feels intentional rather than stitched from dev labels;
- replace ambient animation with event-bound motion.

In short: do not subtract capability. Subtract default exposure, repetition, false urgency, and mixed taxonomies.

## 2. Assumptions And Boundaries

Assumptions:

- Target user is a power user, but not every session starts as a mission-control session.
- Advanced functionality is valuable. The problem is packaging, hierarchy, state, and timing.
- Russian-first product language matters in this build.
- Gamification can be a differentiator only if it explains progress and unlocks; otherwise it becomes decoration.
- A quiet default state is not a weaker product. It is a stronger product with better disclosure.

Boundaries:

- This document is a deeper audit and redesign spec. It does not implement code changes yet.
- No destructive actions were taken.
- Live prompt sending was not verified because macOS accessibility automation is currently blocked for this Codex session. The app launch, process identity, user-provided screenshots, and source-code surfaces were verified.
- The audit combines live installed-app evidence with source inspection. Where a finding is based on source, it cites the relevant component path.
- Correction: an earlier screenshot interpretation incorrectly treated the app as having duplicated workbench columns. The user's corrected screenshots show one normal shell: sidebar, session list, and one chat/workbench. This audit supersedes that mistake and removes the duplicated-column conclusion.

Live evidence:

- App launched: `/Applications/ROX ONE.app`.
- Bundle identifier: `com.rox.one`.
- App version: `0.9.1`.
- Runtime data dir observed in process args: `/Users/marklindgreen/Library/Application Support/@rox-agent/electron`.
- Corrected visual evidence: user screenshots `Image #1` through `Image #6` in the current review thread.

## 3. Architecture Map

The current UI is not one problem. It is several overlapping surfaces that all try to be primary.

```text
Installed ROX ONE.app
        |
        v
Electron Renderer
        |
        v
AppShell
  |
  |-- Navigation / sidebar
  |     |
  |     |-- Sessions
  |     |-- Top-level "Опыт"
  |           |
  |           |-- Долгие миссии
  |           |-- Арена агентов
  |           |-- Центр миссий
  |           |-- Прогресс
  |           |-- Карта квестов
  |           |-- Кузница агентов
  |
  |-- Chat / workbench viewport
  |     |
  |     |-- ExperienceGlobalHud
  |     |     |
  |     |     |-- VDI / readiness / quality
  |     |     |-- active mission
  |     |     |-- next quest
  |     |     |-- blockers
  |     |     |-- XP / level
  |     |     |-- event feedback strip
  |     |
  |     |-- Messages / session content
  |     |
  |     |-- FreeFormInput
  |           |
  |           |-- ProductModeToolbar
  |           |     |
  |           |     |-- mode picker
  |           |     |-- quick actions
  |           |
  |           |-- ComposerArtifactPanel
  |           |     |
  |           |     |-- PromptLabScreen
  |           |     |-- TddPlanScreen
  |           |     |-- SpecBuilderScreen
  |           |     |-- ReviewGateScreen
  |           |
  |           |-- RichTextInput
  |           |-- bottom controls
  |
  |-- WorkbenchRoutePage
        |
        |-- ExperienceDemoConsole
        |-- DeepMissionsScreen
        |-- ArenaBuilderScreen
        |-- MissionControlRunDetail
        |-- ProgressionObservatory
        |-- QuestMapSkillTree
        |-- AgentForgeTeamRegistry
```

Ownership and blast radius:

| Area | Source ownership | User-visible boundary | Blast radius |
| --- | --- | --- | --- |
| Layout and shell hierarchy | `AppShell`, chat viewport wrappers, `FreeFormInput`, workbench route wrappers | Sidebar, session list, one chat/workbench | Medium |
| Global Experience HUD | `ExperienceGlobalHud.tsx`, `experience-ui.tsx` | Every chat/workbench screen | High |
| Composer command model | `ProductModeToolbar.tsx`, `product-mode-toolbar.ts`, `FreeFormInput.tsx`, `ComposerArtifactPanel.tsx` | Main prompt entry flow | High |
| Experience workbench tabs | `WorkbenchRoutePage.tsx`, six Experience screens | `Опыт` section | Medium |
| Demo scaffolding | `ExperienceDemoConsole.tsx`, demo session/runtime selectors | Workbench header and left demo panel | Medium |
| Localization | `packages/shared/src/i18n/locales/ru.json` plus hardcoded strings | App-wide copy | Medium |
| Motion/accessibility | `experience-ui.tsx`, global HUD feedback strip | All Experience visuals and assistive tech output | Medium |
| Dangerous/external actions | `AgentForgeTeamRegistry.tsx`, publish/install/fork flows | Package and agent registry actions | High if exposed too casually |

## 4. Critical Corrected Finding

The corrected screenshots show one normal app layout:

```text
Sidebar filters/tags
        |
        v
Session list
        |
        v
One chat/workbench with Experience HUD and composer
```

The critical issue is not duplicated workbench columns.

The critical issue is that quick commands are implemented and presented like separate artifact modes:

- `Улучшить prompt` opens a large `Prompt Lab` artifact even when the input is empty, then shows `empty prompt`;
- `TDD Plan` opens a static planning artifact with generic RED/GREEN/VERIFY/WORKLOG cards before it has a real user task;
- `Проверить` / `Ревью` opens `Review Gate` with `Verdict: pass` and `Prompt: No prompt provided`, which looks like a fake successful check;
- `Собрать ТЗ` opens `Spec Builder` with `No input yet` and many option cards/config panels;
- `Разъебать` is treated as a tab/action inside the review artifact rather than as a critique command applied to a target.

This is the real P0 UX mismatch.

The buttons are named like quick controls, but they behave like mode switches into empty workbench artifacts. The user expects them to apply a command prompt to the user's prompt and current project context.

Correct behavior:

```text
User prompt + project context + selected quick command
        |
        v
Command prompt wrapper
        |
        v
One generated result / transformed prompt / review / spec / test plan
        |
        v
Optional artifact preview, save, replace, send, or start mission
```

The artifact panel should be output or preview, not the first thing shown on empty input.

## 5. Product Principles

These principles should guide the redesign.

1. Capability is preserved, chrome is earned.

Advanced features stay available, but the default screen does not advertise every possible branch.

2. The prompt is the primary action.

The user came to write, inspect, launch, or ask. The input should not be visually below toolbars, metrics, and artifacts.

3. Telemetry is contextual.

VDI, readiness, quality, quest, XP, and blockers should appear when they explain the current work. Zero-values and inactive states should collapse.

4. Motion is event-bound.

Animation should mean "something changed" or "something is running". Static XP, VDI, and quest labels should not pulse.

5. Modes are posture; quick commands are prompt wrappers.

`Исследовать` is a posture. `Улучшить prompt`, `TDD Plan`, `Проверить`, `Разъебать`, `Собрать ТЗ`, and `Ревью` are command wrappers applied to the current prompt/project. They should not become new modes.

6. Demo scaffolding is not product chrome.

Demo presets, demo sessions, and "how to use" panels are useful internally, but they should not be the main production interface.

7. Game language must earn its place.

Quests, XP, forge, arena, levels, and unlocks can work if they explain progress and next capability. If they are always visible, they become noise.

8. Quiet does not mean hidden forever.

Progressive disclosure should have strong entry points: command palette, action drawer, active mission cockpit, and contextual suggestions.

## 6. Option Comparison

| Option | What changes | Pros | Cons | Recommendation |
| --- | --- | --- | --- | --- |
| A. Keep artifact-mode buttons | Keep current quick actions opening Prompt Lab/TDD/Review/Spec screens | Lowest implementation work | Keeps empty artifacts, fake pass states, and "mode switch" feeling | Reject |
| B. Collapse-only HUD | Keep current composer IA, add collapsed Experience HUD | Low risk, fast | Does not fix the main composer command mismatch | Not enough |
| C. Prompt-command model | Quick actions become prompt wrappers applied to user input/project; artifact panels become output previews | Matches user intent, preserves functions, reduces visual noise | Requires command model and tests | Recommended |
| D. Full app IA redesign | Rebuild sidebar, Experience section, composer, mission flows as one unified workflow | Best long-term coherence | Larger blast radius and slower | Later phase after C |
| E. Remove gamification from shell | Move all XP/quests/progress into Progress tab only | Very quiet | Loses product differentiation and user feedback loops | Too reductive |
| F. Keep current UI but localize labels | Cheap copy polish | Improves some roughness | Leaves structural overload intact | Only useful as part of C |

Recommended path: Option C first, plus the quiet HUD part of Option B, then selective parts of the full IA redesign.

## 7. Recommended Redesign Path

### Pass 1 - Fix Quick Command Semantics

Goal: make the visible quick buttons behave like quick commands, not empty artifact modes.

Changes:

- Convert six quick actions into command wrappers applied to the current prompt/project context.
- If the input/target is empty, do not open a large empty artifact. Show a small inline requirement: `Введите запрос` or `Выберите цель проверки`.
- `Улучшить prompt` should transform/improve the input inline or show a before/after preview.
- `TDD Plan` should generate a test plan from the prompt/project context.
- `Проверить` should verify a concrete target only.
- `Разъебать` should critique a concrete prompt/result/plan with chosen intensity.
- `Собрать ТЗ` should extract a spec from the prompt/context.
- `Ревью` should review a concrete diff/result/spec.
- Artifact panels should appear after a command result exists, as preview/edit/output surfaces.

Expected user result:

- A click applies a useful command to the user's work.
- Empty input does not produce fake artifacts or fake pass states.
- The buttons feel like quick control, not a second navigation system.

### Pass 2 - Quiet The Always-On Chrome

Goal: make the existing product feel stable and quiet without removing features.

Changes:

- Replace always-expanded `ExperienceGlobalHud` with a stateful compact strip.
- Remove false-positive/default event text like `Artifact accepted` when nothing happened.
- Stop pulsing static XP/VDI/quest indicators.
- Hide zero metrics in no-mission state.
- Remove visible internal interaction hints (`Наведение`, `Фокус`, `Активно`) from production UI.

Expected user result:

- The top of the screen stops shouting before work begins.
- Experience still exists and opens when useful.

### Pass 3 - Composer Becomes Input-First

Goal: preserve all composer power but stop showing it all by default.

Changes:

- Put the text input visually first.
- Keep one or two pinned quick commands if the user uses them often, but move the full set into a compact `Действия` menu / command palette.
- Show one contextual recommended action after text exists.
- Keep all existing actions:
  - prompt improvement;
  - TDD plan;
  - verify;
  - teardown/critique;
  - build spec;
  - review.
- Add user-configurable prompt improvement presets.
- Make prompt improvement a proper workflow:
  - raw input;
  - improved version;
  - diff;
  - style preset;
  - custom improvement instruction;
  - replace/insert/keep both;
  - save preset.

Expected user result:

- Less default chrome.
- More useful prompt improvement capability.
- Power-user functions are still one click or one slash command away.

### Pass 4 - Experience Becomes A Mission Workspace

Goal: move from "six gamified tabs" to a clearer workbench.

Changes:

- Reframe `Опыт` as `Миссии` or `Работа` depending on product direction.
- Group six tabs by job:
  - Run: Long Missions + Mission Control.
  - Build: Spec/TDD/Review gates.
  - Orchestrate: Agent Arena + Agent Forge.
  - Improve: Progress + Quest Map.
- Move demo console into a dev/sample drawer.
- Show active mission cockpit only when there is an active mission.
- Use Progress/Quest Map as after-action and roadmap surfaces, not ambient chrome.

Expected user result:

- The product feels like a professional AI workbench with an optional progression layer, not a dashboard of unrelated game panels.

## 8. Per-Module Audit And Point Fixes

### 8.1 App Shell And Layout

Observed issue:

- Corrected screenshots show the intended three-zone shell: left navigation, session list, and one chat/workbench.
- The shell itself is structurally understandable.
- The main layout issue is hierarchy: the Experience HUD and composer command surface compete with the empty chat state.
- The composer is visually boxed as a tool panel instead of feeling like the natural primary input.

Current risk:

- A new session starts with status telemetry and command buttons before the user has written anything.
- The user's eye lands on controls and HUD pills, not on "what do I want the agent to do?"
- Keyboard focus still has too many stops before the core writing/sending flow.

Point fix:

- Keep the three-zone layout.
- Lower the Experience HUD to a compact quiet strip in idle state.
- Make composer command buttons secondary to the input.
- Make artifact panels output-driven, not empty mode screens.
- Add screenshot tests that verify the idle hierarchy:
  - sidebar and session list are stable;
  - one chat/workbench is visible;
  - input is the primary bottom element;
  - no empty artifact panel is open by default.

Acceptance checks:

- At wide desktop, exactly one input composer is visible.
- Empty new chat does not show an artifact panel.
- First visual priority is the prompt input, not HUD metrics.
- At laptop width, composer remains reachable and not under bottom controls.

### 8.2 Sidebar And Navigation

Observed issue:

- `Опыт` has a badge-like `6` and exposes six sub-tabs as equal concepts:
  - `Долгие миссии`;
  - `Арена агентов`;
  - `Центр миссий`;
  - `Прогресс`;
  - `Карта квестов`;
  - `Кузница агентов`.

Why this is noisy:

- Six items are not six equally common user jobs.
- Some are operational (`Центр миссий`), some are gamified progress (`Карта квестов`), some are admin/registry-like (`Кузница агентов`).
- The sidebar makes the product taxonomy visible before the user has context.

Point fix:

- Keep one top-level entry, but rename/reframe it by actual user job:
  - Option 1: `Миссии`;
  - Option 2: `Работа`;
  - Option 3: `Experience` if brand wants English, but then be consistent.
- Inside the Experience workspace, group tabs:
  - `Запуск`: Долгие миссии, Центр миссий.
  - `Команда`: Арена агентов, Кузница агентов.
  - `Рост`: Прогресс, Карта квестов.
- Sidebar should show only:
  - active mission status if one exists;
  - last completed result;
  - a compact progress cue.

Do not:

- Do not remove the six modules.
- Do not show all six as permanent global navigation if most sessions start in chat/composer.

### 8.3 Session List / Chat Entry

Observed issue:

- The session list itself is recognizable, but many entries are still generic `Новый чат`.
- Session surface competes with Experience HUD and composer toolbar for attention.
- Filters/status buckets in the left sidebar are numerous and mix workflow state, labels, and project taxonomy.

Point fix:

- Session title should be minimal:
  - title;
  - optional active mission state;
  - optional last artifact.
- Hide raw progress/metagame tags until the user opens session details.
- If a session has no meaningful state, do not show placeholder telemetry.

Acceptance checks:

- Empty chat looks calm.
- Returning to a session shows what changed since last time.
- The user can find active mission state without seeing every metric.

### 8.4 Global Experience HUD

Source:

- `apps/electron/src/renderer/components/workbench/ExperienceGlobalHud.tsx`
- `apps/electron/src/renderer/components/workbench/experience-ui.tsx`

Observed issue:

- The HUD always renders many pills:
  - `ROX Experience`;
  - `VDI: 0`;
  - `Готовность: 0`;
  - `Качество: 0`;
  - `Миссия: Нет активной миссии / idle`;
  - `Следующий квест: Frame raw prompt`;
  - `Блокеры: нет блокеров`;
  - `Прогресс: 0 XP / уровень 1`;
  - `Событие: Нет новых событий`.
- The feedback strip can show `Artifact accepted` even when there is no real new artifact event.
- Zero metrics and no-op states are made visually important.

Why this is wrong:

- Empty state should not look like a monitoring dashboard.
- `VDI: 0`, `Готовность: 0`, `Качество: 0` communicate failure when there is simply no active evaluation.
- `Следующий квест: Frame raw prompt` looks like a dev/internal quest label.
- `Artifact accepted` without a real event reduces trust.

Point fix:

Replace current always-expanded HUD with three display states:

| State | Trigger | Visible UI | Hidden behind details |
| --- | --- | --- | --- |
| Quiet | no active mission, no fresh event | `Готово к работе` + optional subtle next suggestion | VDI, XP, quests, all metrics |
| Active mission | mission running, pending approval, or blocked | mission name, current checkpoint, blocker or next action | full metric detail, ledger, quest graph |
| Fresh event | new artifact/gate/quest result within short TTL | event toast/strip for 3-5 sec | older events in activity drawer |

Specific changes:

- Do not render zero metrics in quiet state.
- Do not render `Artifact accepted` unless an artifact was actually accepted.
- Replace `Следующий квест` pill with a subtle suggestion:
  - `Следующее: уточнить исходный запрос`
  - only when relevant.
- Make the full HUD a drawer opened by clicking the compact strip.
- Use stable labels:
  - `Миссия`;
  - `Проверка`;
  - `Прогресс`;
  - `Риски`;
  - `История`.

Acceptance checks:

- Empty chat does not show VDI/quality/readiness zeros.
- Active mission shows exactly one mission status summary.
- A blocker appears clearly and higher than progress/XP.
- No fake event text renders in default state.

### 8.5 Experience Motion And Visual Treatment

Source:

- `apps/electron/src/renderer/components/workbench/experience-ui.tsx`

Observed issue:

- UI primitives contain pulse/hover/glow behavior.
- Status chips and progress fill use motion classes.
- `ExperienceFeedbackStrip` can pulse event-like chips.
- `EXPERIENCE_INTERACTION_HINTS` exposes `Наведение`, `Фокус`, `Активно` in the UI.
- Many panels are nested card-inside-card with high visual treatment.

Why this is wrong:

- Persistent animation trains users to ignore the system.
- Motion should mean "running", "changed", or "needs attention".
- Internal interaction hints are QA/design-system language, not product language.
- Nested cards make every module feel equally important.

Point fix:

- Remove visible `Наведение`, `Фокус`, `Активно` from production.
- Make pulse opt-in and event-bound:
  - allowed for currently running mission checkpoint;
  - allowed for fresh event TTL;
  - not allowed for static XP, VDI, readiness, or labels.
- Respect reduced motion by default for ambient surfaces.
- Flatten nested card hierarchy:
  - page section as full-width/unframed layout;
  - cards only for repeated items or explicit tools;
  - no decorative card inside decorative card.
- Reduce visual vocabulary:
  - one accent for active;
  - one warning style for blockers;
  - one neutral style for metadata.

Acceptance checks:

- Nothing pulses on an idle screen.
- Running mission has one active motion target at most.
- Keyboard focus is visible without relying on animation.

### 8.6 Composer Toolbar

Source:

- `apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx`
- `apps/electron/src/renderer/components/app-shell/input/product-mode-toolbar.ts`
- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`

Observed issue:

- The toolbar sits above the input and is visually louder than the empty input.
- It exposes mode selection plus quick action buttons before the user writes.
- In corrected screenshots, clicking quick actions opens large artifact screens even when there is no prompt:
  - Prompt Lab with `empty prompt`;
  - TDD Plan with generic RED/GREEN/VERIFY/WORKLOG cards;
  - Review Gate with `Verdict: pass` and `Prompt: No prompt provided`;
  - Spec Builder with `No input yet`.
- Existing mode/action taxonomy overlaps:
  - modes: `rewrite`, `think`, `spec`, `plan`, `build`, `review`, `verify`, `board`, `tdd`, `research`;
  - actions: `improve-prompt`, `run-tdd-plan`, `verify`, `tear-down`, `build-spec`, `review`.
- Six quick actions are visible:
  - `Улучшить prompt`;
  - `TDD Plan`;
  - `Проверить`;
  - `Разъебать`;
  - `Собрать ТЗ`;
  - `Ревью`.

Why this is wrong:

- The app asks the user to classify work before they have entered work.
- Mode and action are mixed:
  - a mode changes how the assistant behaves;
  - a quick command should apply a prompt wrapper to the current prompt/project context.
- The current behavior makes quick actions feel like separate mini-apps or modes.
- Empty artifact screens are dead ends, not quick actions.
- The most frequent user action is typing. The UI currently makes tools visually primary.

Point fix:

Rebuild composer hierarchy around command semantics:

```text
Composer
  |
  |-- input field
  |
  |-- compact secondary row
        |
        |-- mode dropdown / segmented group
        |-- tools button
        |-- context selector
        |-- send
```

Command execution model:

```text
current composer text
  + selected project/source context
  + selected command wrapper
        |
        v
generated prompt / plan / check / spec / review
        |
        v
optional preview artifact
```

Modes should remain posture, not action:

| Visible group | Existing modes mapped inside |
| --- | --- |
| `Исследовать` | `research`, `think` |
| `Собрать` | `spec`, `plan`, `board` |
| `Сделать` | `build`, `tdd` |
| `Проверить` | `review`, `verify`, `rewrite` as transform |

Quick commands should either be:

- one or two pinned buttons selected by usage/frequency;
- a compact `Действия` menu;
- slash commands;
- keyboard command palette;
- contextual suggestions after text exists.

Each command should have an explicit wrapper:

| Quick command | What it should do |
| --- | --- |
| `Улучшить запрос` | Rewrite/improve the current input, optionally with a user preset |
| `TDD план` | Generate a test-first plan from the input and project context |
| `Проверить` | Verify the selected/current target against criteria |
| `Разъебать` | Critique the target with selected intensity |
| `Собрать ТЗ` | Extract requirements/spec from the input/context |
| `Ревью` | Review a diff, artifact, answer, or selected project surface |

Example contextual behavior:

- Empty input:
  - show no artifact panel;
  - commands are hidden, disabled, or explain the missing target inline;
  - show small placeholder and attach/context controls.
- User writes rough task:
  - suggest `Улучшить запрос`;
  - show `Собрать ТЗ` if text contains requirements;
  - show `Проверить` if there is an artifact/result.
- User selects code/task context:
  - suggest `TDD план`;
  - show `Ревью` when there is a diff or selected file.

Do not:

- Do not remove the actions.
- Do not keep all six as first-class permanent buttons.
- Do not open empty artifact screens as the default result of clicking a quick command.

### 8.7 Prompt Improvement / Prompt Lab

Source:

- `ComposerArtifactPanel.tsx`
- `PromptLabScreen.tsx`
- `PromptRewriteModal` in `FreeFormInput.tsx`

Observed issue:

- Prompt improvement exists, but it is exposed as a blunt button and/or artifact panel.
- It is visually loud compared with how often the user needs it.
- The current label `Улучшить prompt` mixes Russian and English casually.
- In the screenshot, clicking it with empty input opens a full `Prompt Lab` panel with `Original prompt: No prompt yet` and `Improved prompt: empty prompt`.

Why this is wrong:

- The action should operate on the user's prompt, not display a lab shell without material.
- Empty input should produce a tiny inline guard, not a full artifact.
- Prompt improvement is a command transform. The artifact panel is useful only when there is a before/after result.

What should be added:

- User-defined prompt improvement instructions.
- Presets:
  - `Мой стиль`;
  - `Коротко`;
  - `ТЗ`;
  - `Критик`;
  - `Evidence-first`;
  - `Для агента`;
  - `Без воды`.
- Ability to save a custom preset:
  - name;
  - instruction;
  - default target mode;
  - whether to keep original.
- Diff view:
  - original;
  - improved;
  - removed ambiguity;
  - added constraints;
  - assumptions introduced.
- Output choices:
  - replace input;
  - insert below;
  - open as artifact;
  - send improved prompt.

How to hide it cleanly:

- In composer, expose as:
  - small wand/spark icon with tooltip, or
  - first contextual suggestion when input is rough.
- Full Prompt Lab opens as drawer/panel only after invocation with a non-empty input or selected target.

UX copy:

- Prefer `Улучшить запрос` over `Улучшить prompt`.
- If `prompt` is a deliberate brand term, use `Prompt Lab` consistently and explain once in the panel title, not across every button.

Acceptance checks:

- User can improve a prompt without leaving composer.
- User can set a personal improvement instruction.
- Default screen does not show a large prompt-lab panel.
- Empty input does not open Prompt Lab.
- The original text is never lost without explicit replace/send.

### 8.8 TDD Plan

Source:

- `TddPlanScreen.tsx`
- `ComposerArtifactPanel.tsx`

Observed issue:

- `TDD Plan` appears as a global quick action even when the current user intent may not be coding.
- The label is English and implementation-heavy.
- In the screenshot, it opens a generic artifact with RED/GREEN/VERIFY/WORKLOG cards even before a real task exists.

Point fix:

- Treat `TDD Plan` as a command wrapper:
  - input: user's task/prompt plus selected project context;
  - wrapper: "turn this into a test-first plan";
  - output: generated test plan, validation gates, worklog checklist;
  - optional artifact: editable preview after generation.
- Rename visible label based on context:
  - `План проверок`;
  - `TDD план` only in developer mode;
  - `Тест-план` if product audience is mixed.
- Show as contextual suggestion when:
  - selected mode is `Сделать`;
  - user mentions code/change/fix/build;
  - selected context includes files/diff;
  - an artifact needs validation.
- Keep full artifact workflow:
  - acceptance criteria;
  - failing test shape;
  - implementation checkpoints;
  - validation commands;
  - worklog output.

Acceptance checks:

- Non-code chat does not show `TDD Plan` as a top-level button.
- Code/task prompt can still reach TDD planning in one click or command.
- Empty input does not open a generic TDD artifact.

### 8.9 Review / "Разъебать" Action

Source:

- `product-mode-toolbar.ts`
- `ReviewGateScreen.tsx`

Observed issue:

- `Разъебать` is powerful and aligned with the user's blunt power-user workflow, but it is too aggressive as permanent beginner-facing chrome.
- It appears next to neutral actions like `Проверить` and `Собрать ТЗ`, which makes the action taxonomy feel inconsistent.
- In the screenshots it appears both as a quick action and as a tab inside `Review Gate`, so it reads as navigation, not as a critique command.

Point fix:

- Keep the action, but make it a command wrapper under `Ревью` / `Критика`.
- Let the user pin it if they want it always visible.
- Provide intensity levels:
  - `мягко`;
  - `строго`;
  - `без церемоний`;
  - custom.
- For default Russian product copy, use `Критика` or `Жесткое ревью`; keep `Разъебать` as a power-user alias/command.

Acceptance checks:

- Existing action still works.
- Default composer is not dominated by an aggressive label.
- Power users can pin the action back.
- The command always has a target: prompt, plan, answer, diff, or artifact.

### 8.10 Spec Builder

Source:

- `SpecBuilderScreen.tsx`
- `ComposerArtifactPanel.tsx`

Observed issue:

- `Собрать ТЗ` is valuable and should remain.
- But as a permanent quick action it competes with prompt entry.
- In the screenshot, `Spec Builder` opens with `No input yet`, `source: manual`, and many option/config cards. That is configuration before value.

Point fix:

- Treat `Собрать ТЗ` as a command wrapper:
  - input: user prompt, selected files, or project context;
  - wrapper: "extract product/task requirements and acceptance criteria";
  - output: generated spec draft;
  - optional artifact: editable spec builder after the draft exists.
- Show `Собрать ТЗ` when the prompt contains:
  - requirements;
  - product idea;
  - design ask;
  - build request;
  - ambiguous implementation scope.
- The panel should show:
  - extracted goal;
  - assumptions;
  - missing decisions;
  - acceptance criteria;
  - risks;
  - proposed next action.
- Advanced options should be collapsible:
  - stakeholder style;
  - output format;
  - validation strictness;
  - repo-specific worklog.

Acceptance checks:

- User can convert rough text to spec in one step.
- Composer stays clean before text exists.
- Spec can be inserted, saved, or used to start a mission.
- Empty input does not open a configuration-heavy builder.

### 8.11 Verify / Review Gate

Source:

- `ReviewGateScreen.tsx`
- `ComposerArtifactPanel.tsx`

Observed issue:

- `Проверить` is useful, but it is unclear what it checks without context.
- It sits beside prompt improvement and TDD plan, which are different classes of action.
- In the screenshots, `Review Gate` can show `Verdict: pass. Findings: 0. Prompt: No prompt provided.` This is actively harmful because it creates a fake successful review.

Point fix:

- Treat `Проверить` as a target-bound command wrapper:
  - input: selected answer, plan, diff, spec, artifact, or project state;
  - wrapper: chosen verification criteria;
  - output: pass/fail with findings and evidence.
- Rename based on target:
  - `Проверить ответ`;
  - `Проверить план`;
  - `Проверить изменения`;
  - `Запустить проверки`.
- If no target exists, hide or disable with a clear reason.
- Never emit `pass` for a missing target.
- Review gate should show:
  - what is being checked;
  - against which criteria;
  - what passed/failed;
  - what can be fixed automatically.

Acceptance checks:

- Verify action is unavailable or contextual when there is nothing to verify.
- The result explains evidence, not just status.
- Missing target cannot produce a passing verdict.

### 8.12 Deep Missions

Source:

- `DeepMissionsScreen.tsx`

Observed issue:

- The module has real power: long mission form, presets, budgets, tokens, storage, agent selection, objective, raw input, launch/draft.
- It exposes too much configuration at once.
- Copy mixes Russian and English: `Deep Run`, `Deep Reasoning Lab`, `Agenda Carnage`, `Runtime launch`, `Token cap`.

Point fix:

Turn it into a 3-step flow:

1. `Что сделать`
   - objective;
   - source/context;
   - expected artifact.
2. `Как запускать`
   - quick presets:
     - `Быстро`;
     - `Глубоко`;
     - `Критично`;
     - `Ночь`;
   - advanced budget hidden.
3. `Проверка и запуск`
   - permissions;
   - risk;
   - expected checks;
   - launch/draft.

Advanced controls:

- token cap;
- storage;
- agent count;
- cost;
- timeout;
- approvals.

These should be inside `Расширенные настройки`, not default first screen.

Acceptance checks:

- A new user can start a long mission without reading every budget field.
- A power user can still configure token/storage/agent limits.
- Launch button is not enabled until objective and safety boundary are clear.

### 8.13 Mission Control

Source:

- `MissionControlRunDetail.tsx`

Observed issue:

- This is probably the strongest Experience module: checkpoint timeline, gates, approvals, artifacts, audit/billing, finalize.
- It should be the active cockpit, but it competes with demo copy and other Experience tabs.

Point fix:

- Make Mission Control appear when a mission is active.
- Surface one of four states:
  - `Выполняется`;
  - `Ждет решения`;
  - `Заблокировано`;
  - `Готово`.
- Put blockers and approvals above progress.
- Put billing/audit below operational state.
- Use artifact previews as the main output.
- Hide raw checkpoint IDs unless user expands technical details.

Acceptance checks:

- User knows what to do next in 3 seconds.
- If blocked, blocker is visually above XP/progress.
- Completed mission links to artifacts and verification evidence.

### 8.14 Agent Arena

Source:

- `ArenaBuilderScreen.tsx`

Observed issue:

- Agent arena has useful functions: choose agent packages, swarm slots, budgets, trust, draft run.
- It is visually card-heavy and gamified with rarity-like language.
- It may be perceived as a game screen rather than a serious orchestration tool.

Point fix:

- Keep the `arena` metaphor only where it clarifies comparison.
- Add a compact compare table:
  - role;
  - cost;
  - trust;
  - capability;
  - best use;
  - risk.
- Show cards only after the user selects/expands a package.
- Make budget/trust controls visible but quiet.
- Provide presets:
  - `один исполнитель`;
  - `исполнитель + ревьюер`;
  - `исследователь + исполнитель + верификатор`;
  - `полная команда`.

Acceptance checks:

- User can choose a team composition without reading every package card.
- Cost/trust/risk are visible before launch.
- No decorative rarity language is required to understand the choice.

### 8.15 Progression Observatory

Source:

- `ProgressionObservatory.tsx`

Observed issue:

- The module tracks VDI, quality, readiness, cost, risk, noise, ledger, leaderboard.
- The product already has a `noise` concept, but the current UI itself is noisy.

Point fix:

- Make this an after-action and analytics surface, not a global top strip.
- Explain each metric by user benefit:
  - VDI: "насколько результат подтвержден фактами";
  - readiness: "готово ли запускать/принимать";
  - quality: "качество артефакта";
  - noise: "сколько лишнего UI/сигналов было показано".
- Use trend and deltas, not permanent zeros.
- Show improvement recommendations:
  - "меньше ручных действий";
  - "нет acceptance criteria";
  - "много незакрытых блокеров";
  - "нужен ревью-гейт".

Acceptance checks:

- Empty state does not imply failure.
- Metrics explain why they matter.
- Progression feeds contextual suggestions but does not dominate the workbench.

### 8.16 Quest Map

Source:

- `QuestMapSkillTree.tsx`

Observed issue:

- Quest map has meaningful roadmap/unlock mechanics.
- But the current global HUD exposes `Следующий квест` in idle state as if it is always urgent.

Point fix:

- Keep Quest Map as a roadmap:
  - current unlocks;
  - next capability;
  - evidence required;
  - why locked/unlocked.
- In global HUD, show at most one quiet suggestion:
  - `Следующее: уточнить запрос`;
  - only if it helps current work.
- Replace internal labels like `Frame raw prompt` with localized user-facing text.

Acceptance checks:

- Quest Map is useful when opened.
- Idle chat is not dominated by quest language.
- Unlock reasons are understandable without reading code-like labels.

### 8.17 Agent Forge / Team Registry

Source:

- `AgentForgeTeamRegistry.tsx`

Observed issue:

- The module includes install/fork/publish package flows, contracts, review, tests, injection warnings.
- `Publish public` or similar registry actions are too consequential to be exposed casually.

Point fix:

- Split actions by risk:
  - safe: inspect, install, fork locally;
  - guarded: share inside workspace;
  - high risk: publish public.
- `Publish public` requires:
  - explicit confirmation;
  - visible package diff;
  - security review status;
  - license/source provenance;
  - rollback note.
- Default tab should emphasize "use existing agent" and "fork locally", not publish.

Acceptance checks:

- User cannot accidentally publish.
- Power-user registry functions remain accessible.
- Security/injection warnings are visible before execution, not after.

### 8.18 Demo Console

Source:

- `ExperienceDemoConsole.tsx`
- `WorkbenchRoutePage.tsx`

Observed issue:

- Workbench route includes demo session/runtime selectors and `Как пользоваться`.
- Header contains demo-style framing such as `Демо-сессия`.
- This is useful for QA and onboarding, but it makes production app feel unfinished.

Point fix:

- Hide demo console behind:
  - `Samples`;
  - `Шаблоны`;
  - dev flag;
  - onboarding mode.
- Production `Опыт` should start with:
  - active mission if any;
  - suggested next mission;
  - recent artifacts;
  - compact progress.
- "How to use" should be contextual, not a permanent panel.

Acceptance checks:

- Normal user does not see `Демо-сессия`.
- QA/dev can still access sample scenarios.
- Workbench opens into a real user state, not a demo harness.

### 8.19 Localization And Product Language

Source:

- `packages/shared/src/i18n/locales/ru.json`
- hardcoded strings in Experience components.

Observed issue:

The Russian UI still leaks English/dev language:

- `ROX Experience`;
- `Frame raw prompt`;
- `runtime truth`;
- `Artifact accepted`;
- `TDD Plan`;
- `Review Gate`;
- `Work in Folder`;
- `Deep Run`;
- `Runtime launch`;
- `Token cap`.

Some English terms may be acceptable if deliberate, but the current mix is accidental.

Point fix:

Create a product glossary:

| Concept | Recommended Russian-first label | Notes |
| --- | --- | --- |
| Experience | `Опыт ROX` or `Experience` | Pick one; do not mix randomly |
| prompt | `запрос` | Use `Prompt Lab` only as branded feature |
| TDD Plan | `План проверок` or `TDD план` | Context-dependent |
| Review Gate | `Ревью-гейт` or `Проверка` | Use technical term only in developer mode |
| runtime truth | `факты выполнения` | Avoid internal phrase |
| Artifact accepted | `Артефакт принят` | Only on real event |
| Work in Folder | `Работать в папке` | Localize hardcoded text |
| Frame raw prompt | `Уточнить исходный запрос` | User-facing quest copy |
| Forge | `Кузница` | Fine if metaphor is consistent |
| Arena | `Арена` or `Состав команды` | For professional mode, prefer explicit label |

Acceptance checks:

- Idle screen has no mixed English/Russian dev copy except intentional brand names.
- Internal labels do not leak into end-user quest text.
- Strings are centralized rather than hardcoded in components where possible.

### 8.20 Accessibility

Observed issue:

- Persistent feedback strips and animated indicators may create screen-reader and motion noise.
- Permanent quick actions increase tab-stop count before the input.
- Empty artifact panels add many focusable controls before there is a useful target.

Point fix:

- `aria-live` should announce only fresh events, not static metrics.
- Motion should respect reduced-motion and be off for idle/static values.
- Keyboard order should prioritize:
  - session/context;
  - input;
  - send;
  - tools;
  - details.
- Action menu/palette should preserve keyboard access to all hidden functions.
- Icon-only controls need accessible names and tooltips.
- Empty command states should use a small inline guard, not a full panel with tabs and action buttons.

Acceptance checks:

- Tab order reaches input quickly.
- Screen reader does not hear repeated HUD metrics on idle.
- Reduced-motion mode has no idle pulsing.
- Hidden tools are still reachable via keyboard.

## 9. Prioritized Point Fix Table

| Priority | Surface | Exact fix | Functionality preserved | Blast radius | Verification |
| --- | --- | --- | --- | --- | --- |
| P0 | Composer quick actions | Convert six quick actions from artifact-mode switches into prompt command wrappers | All six actions | High | Component tests for command payloads and dispatch |
| P0 | Empty command behavior | Do not open Prompt Lab/TDD/Review/Spec artifacts on empty input/target | All artifact modules | High | Empty input tests for each action |
| P0 | Review correctness | Never show `pass` when prompt/target is missing | Review/verify | Medium | Missing-target test cannot pass |
| P0 | HUD events | Stop rendering fake `Artifact accepted` / no-event messages | Feedback/event history | Medium | Unit test no event = no artifact accepted |
| P0 | HUD idle | Collapse zero metrics in no-mission state | VDI/readiness/quality details in drawer | Medium | Component test quiet state |
| P1 | Motion | Disable idle pulsing; keep motion only for running/fresh events | Event feedback | Medium | Reduced-motion and idle screenshot |
| P1 | Composer hierarchy | Make input visually primary; move full action set into menu/palette with optional pinned commands | All six actions | High | Component test actions reachable from menu/palette |
| P1 | Prompt Lab | Add personal prompt improvement presets and diff/replace flow | Prompt improvement | Medium | UI test preset create/apply/replace |
| P1 | Mode IA | Reduce visible modes into 4 groups; keep full mode map inside menu | Existing 10 modes | High | Mode mapping unit test |
| P1 | Localization | Replace accidental English/dev labels in visible UI | Same concepts | Medium | i18n snapshot/check |
| P2 | Experience tabs | Group six tabs by job; keep all modules | All six modules | Medium | Navigation smoke |
| P2 | Demo console | Move demo controls to samples/dev drawer | Demo scenarios | Medium | Normal route hides demo copy |
| P2 | Mission Control | Make active mission cockpit state-first | Checkpoints/gates/artifacts | Medium | Active/blocked/complete story tests |
| P2 | Agent Forge | Gate publish-public behind explicit review confirmation | Publish remains possible | High | Guard/confirmation test |
| P3 | Progression | Move metrics into after-action analytics and contextual suggestions | Progress tracking | Low | Empty state and post-run story tests |
| P3 | Quest Map | Localize quest labels and explain unlocks | Quest graph | Low | Quest copy snapshot |

## 10. Suggested Implementation Tickets

### T202 - Composer quick-command semantics

Goal:

- The six visible composer quick actions behave as prompt command wrappers, not artifact-mode switches.

Files likely touched:

- `ProductModeToolbar.tsx`;
- `product-mode-toolbar.ts`;
- `FreeFormInput.tsx` container styles;
- `ComposerArtifactPanel.tsx`;
- command dispatch/composer state tests.

Tests first:

- Empty input + `Улучшить prompt` does not open Prompt Lab; it shows a small missing-input guard.
- Non-empty input + `Улучшить prompt` dispatches a rewrite command payload and can preview a before/after result.
- Non-empty input + `TDD Plan` dispatches a test-plan command payload.
- `Проверить` with no target is unavailable or explains missing target.
- `Ревью`/`Разъебать` require a concrete target.
- `Собрать ТЗ` dispatches a spec command payload from input/context.

### T203 - Quiet Experience HUD state model

Goal:

- Preserve Experience details, but hide ambient zero/no-op telemetry.

Files likely touched:

- `ExperienceGlobalHud.tsx`;
- `experience-ui.tsx`;
- tests for HUD states.

Tests first:

- no active mission -> no VDI/readiness/quality zero pills;
- no event -> no `Artifact accepted`;
- active mission -> mission status visible;
- blocker -> blocker visible above progress.

### T204 - Composer action menu and contextual suggestions

Goal:

- Input-first composer with all current quick commands preserved in a quieter access model.

Files likely touched:

- `ProductModeToolbar.tsx`;
- `product-mode-toolbar.ts`;
- `FreeFormInput.tsx`;
- `ComposerArtifactPanel.tsx`.

Tests first:

- empty input hides large action row;
- actions are reachable via `Действия` menu, slash command, or palette;
- typed rough prompt suggests prompt improvement;
- selected code context suggests TDD/test plan;
- all six existing actions still dispatch.

### T205 - Prompt Lab presets and diff flow

Goal:

- Add actual prompt-improvement functionality without exposing it as permanent chrome.

Files likely touched:

- `PromptLabScreen.tsx`;
- composer state/model files;
- i18n strings;
- persistence surface if presets are stored locally.

Tests first:

- create preset;
- apply preset;
- show diff;
- replace input;
- original remains available until explicit replace.

### T206 - Experience workspace grouping

Goal:

- Keep six modules, but group them by user job and hide demo scaffolding from normal production view.

Files likely touched:

- `AppShell.tsx`;
- `WorkbenchRoutePage.tsx`;
- `ExperienceDemoConsole.tsx`;
- six Experience screens only if labels/headers need adjustment.

Tests first:

- all six modules reachable;
- normal route does not show `Демо-сессия`;
- sample/demo mode still available.

### T207 - Russian product glossary pass

Goal:

- Make visible labels intentional and consistent.

Files likely touched:

- `packages/shared/src/i18n/locales/ru.json`;
- hardcoded strings in Experience components;
- hardcoded `Work in Folder` in composer controls.

Tests first:

- i18n key snapshot or targeted render tests;
- no visible `Frame raw prompt`, `runtime truth`, `Artifact accepted` in idle state.

## 11. Validation Plan

Minimum validation for the first implementation pass:

```bash
git diff --check
```

Repo task discovery should be done before running final checks:

```bash
mise tasks
```

Expected targeted UI checks after implementation:

```bash
mise run test
mise run typecheck
mise run build
```

If those task names are unavailable, derive the equivalent from `mise.toml`, `package.json`, or existing repo test scripts before adding new commands.

Playwright evidence should include:

- wide desktop screenshot of normal chat/workbench;
- laptop-width screenshot;
- Experience workspace screenshot;
- composer quick-command flow screenshot;
- trace/video for action menu, command dispatch, and Prompt Lab preset flow.

Assertions worth adding:

- one visible composer in normal mode;
- one visible Experience HUD in normal mode;
- empty prompt does not open Prompt Lab/TDD/Review/Spec artifact panels;
- missing target cannot produce a passing Review Gate;
- no idle pulse indicators;
- no fake artifact event in idle state;
- all six composer actions remain reachable;
- all six Experience modules remain reachable;
- no `Демо-сессия` copy in normal production route.

## 12. Final Recommendation

Do not remove Experience. Re-scope it.

The right move is a contextual Experience layer:

- quiet compact strip by default;
- active mission cockpit when something is running;
- detail drawer for metrics, quests, XP, blockers, and events;
- Progress/Quest Map as explicit surfaces, not ambient permanent chrome.

Do not remove composer tools. Correct their semantics.

The right move is input-first composer plus command wrappers:

- mode dropdown for posture only;
- quick command menu/pinned commands;
- command palette/slash commands;
- contextual suggested action;
- Prompt Lab/TDD/Review/Spec artifacts only after there is input or a selected target.

Do not treat the current problem as visual polish only.

The corrected screenshots show one normal app shell. The first professional step is not layout duplication repair. It is fixing the quick-command model: buttons should apply command prompts to the user's prompt/project context, and only then produce preview artifacts. Then quiet the HUD. Then reorganize composer visibility. Then reframe the six Experience modules.

The resulting product should feel like:

- chat first;
- mission cockpit when needed;
- power tools one gesture away;
- progress visible after it means something;
- no idle screen shouting numbers, quests, and fake events at the user.
