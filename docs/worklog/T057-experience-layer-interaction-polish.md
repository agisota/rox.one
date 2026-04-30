# T057 - Experience Layer Interaction Polish

## 1. Task summary

Polish the shared Experience Layer UI primitives so Command/Game/Arena screens feel more deliberate and gamified while preserving the shared truth model and existing screen behavior.

## 2. Repo context discovered

- The correct shared ownership point is `apps/electron/src/renderer/components/workbench/experience-ui.tsx`.
- The Experience screens reuse this shared component set, so a single scoped patch improves Deep Missions, Arena Builder, Mission Control, Progression Observatory, Quest Map, and Agent Forge.
- Existing test coverage for this visual layer lives in `apps/electron/src/renderer/components/workbench/__tests__/experience-ui-polish.test.tsx`.
- The worktree has unrelated dirty files under `apps/electron/src/main`, `events.jsonl`, `.e2e-logs/`, and `.superpowers/`; these were intentionally not touched or staged.

## 3. Files inspected

- `apps/electron/src/renderer/components/workbench/experience-ui.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/experience-ui-polish.test.tsx`
- `apps/electron/src/renderer/components/workbench/DeepMissionsScreen.tsx`
- `apps/electron/src/renderer/components/workbench/ArenaBuilderScreen.tsx`
- `apps/electron/src/renderer/components/workbench/MissionControlRunDetail.tsx`
- `apps/electron/src/renderer/components/workbench/ProgressionObservatory.tsx`
- `apps/electron/src/renderer/components/workbench/QuestMapSkillTree.tsx`
- `apps/electron/src/renderer/components/workbench/AgentForgeTeamRegistry.tsx`

## 4. Tests added first

Added a failing component/static-render test that asserts:

- selected/disabled card state hooks;
- tone/status state hooks;
- polished hover and selected-surface classes;
- running status animation classes;
- accessible `progressbar` semantics;
- visible multi-tone progress fill;
- reduced-motion safety.

## 5. Expected failing test output

Initial red run:

```text
bun test apps/electron/src/renderer/components/workbench/__tests__/experience-ui-polish.test.tsx
2 pass
1 fail
Expected to contain: "data-selected=\"true\""
```

The failure was expected because the old shared primitives did not expose selected/disabled/status state attributes or accessible progress semantics.

## 6. Implementation changes

- Added `data-tone`, `data-selected`, `data-disabled`, and `data-status` hooks.
- Added motion-safe hover/focus/active layers for interactive Experience cards.
- Added stronger selected-card glow while preserving reduced-motion handling.
- Added running-state pulse affordance to `ExperienceStatusChip`.
- Added accessible `role="progressbar"` and ARIA values to `ExperienceProgressBar`.
- Added multi-tone progress fill and metric-card polish through existing shared primitives.
- Ran a deslop pass after validation and kept the long visual class groups in local constants instead of spreading decorative class strings through render bodies.

## 7. Validation commands run

- `bun test apps/electron/src/renderer/components/workbench/__tests__/experience-ui-polish.test.tsx`
- `bun test apps/electron/src/renderer/components/workbench`
- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run validate:agent-contract`
- `bun run electron:build`
- `bun run electron:smoke` (sandbox run reached Electron startup and aborted with `SIGABRT`; escalated GUI/runtime run passed)
- `lsp_diagnostics` for `experience-ui.tsx`
- `lsp_diagnostics` for `experience-ui-polish.test.tsx`

## 8. Passing test output summary

Targeted component test:

```text
bun test apps/electron/src/renderer/components/workbench/__tests__/experience-ui-polish.test.tsx
3 pass
0 fail
27 expect() calls
```

Workbench slice:

```text
bun test apps/electron/src/renderer/components/workbench
47 pass
0 fail
234 expect() calls
```

Static checks:

```text
bun run typecheck:electron
PASS

bun run lint:electron
PASS

bun run validate:agent-contract
[agent-contract] ok: 11 skills, 46 tickets, 7 required docs

lsp_diagnostics
0 errors for experience-ui.tsx and experience-ui-polish.test.tsx
```

## 9. Build output summary

```text
bun run electron:build
PASS
```

The build completed successfully. Vite reported existing non-blocking warnings for large chunks and deprecated `jotai/babel` plugins.

Runtime smoke:

```text
bun run electron:smoke
[smoke] Electron headless startup passed
```

The first sandbox smoke reached Electron startup but exited with `SIGABRT`; rerunning the same command outside sandbox passed and logged `App initialized successfully`.

Post-deslop re-verification:

```text
bun test apps/electron/src/renderer/components/workbench
47 pass
0 fail
234 expect() calls

bun run typecheck:electron
PASS

bun run lint:electron
PASS

bun run validate:agent-contract
[agent-contract] ok: 11 skills, 46 tickets, 7 required docs

bun run electron:smoke
[smoke] Electron headless startup passed
App initialized successfully
```

## 10. Remaining risks

- A live visual pass is still needed after the Electron app launches.
- This task intentionally does not fix account authentication or public shortlink upload failures.
- A background architect review was requested but did not return before timeout; local verification covered the changed UI primitive and test surfaces.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Tests before feature code | PASS | Red test failed before implementation |
| Shared Experience polish | PASS | `experience-ui.tsx` patch only |
| Accessible progress semantics | PASS | Component test asserts `role="progressbar"` and `aria-valuenow` |
| Running/selected/disabled states | PASS | Component test asserts `data-*` hooks and animation classes |
| Relevant validation passes | PASS | Workbench tests, typecheck, lint, agent contract, LSP diagnostics |
| Build/run evidence recorded | PASS | Electron build and escalated smoke startup passed |
