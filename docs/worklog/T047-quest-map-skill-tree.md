# T047 - Quest Map and Skill Tree

## Task summary

Implement the Quest Map and Skill Tree screen from the Experience Layer PRD.

## Reformulated task

Create a deterministic renderer-side quest/progression surface for:

- campaign lanes
- quest state
- evidence-gated completion
- deterministic unlock rules
- Command/Game presentation over the same quest truth

## Assumptions and boundaries

- This ticket creates a screen/state contract, not a live campaign backend.
- Shared `QuestProgressSchema` owns completion evidence validation.
- Locked quests cannot be manually completed.
- Unlock rules are deterministic local rules based on completed quest ids.
- Command/Game labels change presentation only, not quest ids, progress, rewards, or unlock truth.

## ERD / schema view

```text
QuestMapState
  quests[]
  progressByQuestId
  unlockRules[]
    -> unlockedRewardIds[]
    -> visible lane projection
```

## Sequence diagram

```text
Quest Map opens
  -> quests and progress render by lane
User completes available quest
  -> evidence validated by shared schema
  -> completion updates progress
Unlock evaluation runs
  -> newly available quests and rewards are projected
Layer toggles Command/Game
  -> labels change
  -> quest truth stays fixed
```

## Component / screen map impact

- Adds `QuestMapSkillTree`.
- Adds `quest-map-state` helper.
- Does not yet add route/sidebar wiring or persistent campaign storage.

## Repo context discovered

- T041 shared models define `Quest`, `QuestProgress`, lanes, layers, and evidence validation.
- Existing Experience Layer screens use local deterministic state helpers.
- Workbench screen tests use `renderToStaticMarkup`.

## Files inspected

- `docs/product/experience-layer-system-prd.md`
- `packages/shared/src/workbench/experience-layer.ts`
- `apps/electron/src/renderer/components/workbench/ProgressionObservatory.tsx`
- `apps/electron/src/renderer/components/workbench/progression-observatory-state.ts`

## Tests added first

- `apps/electron/src/renderer/components/workbench/__tests__/quest-map-skill-tree.test.tsx`
  - verifies quest completion requires artifact or gate evidence
  - verifies locked quests cannot be manually completed
  - verifies unlock rules evaluate deterministically from completed requirements
  - verifies Command view renders roadmap language while Game view renders quest language

## Expected failing test output

Initial TDD run failed before implementation because the component did not exist:

```text
Cannot find module '../QuestMapSkillTree'
```

## Implementation changes

- Added deterministic quest/campaign state in `apps/electron/src/renderer/components/workbench/quest-map-state.ts`.
- Added `QuestMapSkillTree` with campaign lanes, progress status, unlocked rewards, and integrity rules.
- Reused shared `QuestProgressSchema` so completed quests require artifact or validation gate evidence.
- Added deterministic unlock rules that make `quest-specify` available and unlock `skill:spec-builder` after `quest-formulate` completes.
- Kept Command/Game/Arena presentation labels separate from quest truth.

## Validation commands run

- `bun test apps/electron/src/renderer/components/workbench/__tests__/quest-map-skill-tree.test.tsx apps/electron/src/renderer/components/workbench/__tests__/progression-observatory.test.tsx apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx` - passed.
- `bun x eslint src/renderer/components/workbench/QuestMapSkillTree.tsx src/renderer/components/workbench/quest-map-state.ts src/renderer/components/workbench/__tests__/quest-map-skill-tree.test.tsx` from `apps/electron` - passed.
- `bun run typecheck` from `apps/electron` - passed.
- `bun run validate:agent-contract` - passed.
- `bun run lint` from `apps/electron` - failed on unrelated existing `ProductModeToolbar.tsx` shadow class violations.

## Passing test output summary

```text
bun test apps/electron/src/renderer/components/workbench/__tests__/quest-map-skill-tree.test.tsx apps/electron/src/renderer/components/workbench/__tests__/progression-observatory.test.tsx apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx
22 pass
0 fail
84 expect() calls
```

```text
bun run validate:agent-contract
[agent-contract] ok: 11 skills, 42 tickets, 7 required docs
```

## Build output summary

No route/runtime/build surface was wired in T047. Electron typecheck passed. Full Electron lint is blocked by unrelated pre-existing violations:

```text
apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx
52:21 error Disallowed shadow class "shadow-sm"
64:23 error Disallowed shadow class "shadow-lg"
94:23 error Disallowed shadow class "shadow-sm"
```

## Remaining risks

- The screen is not yet reachable through app navigation; route/shell wiring remains later work.
- Quest state uses deterministic fixtures; persistent campaign state and backend unlock propagation remain later work.
- Full `apps/electron` lint remains blocked by unrelated existing `ProductModeToolbar.tsx` style violations.

## Acceptance criteria matrix

- [x] Quest requires artifact/gate evidence.
- [x] Locked quests cannot be manually completed.
- [x] Unlock rules evaluate deterministically.
- [x] Command view renders roadmap language.
- [x] Game view renders quest language.
- [x] Targeted UI/state tests pass.
- [x] Relevant broader validation passes where not blocked by unrelated pre-existing lint debt.
- [ ] Scoped commit exists.
