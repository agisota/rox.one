# T055 — Experience Layer visual polish

## 1. Task Summary
Polish the reachable Experience Layer screens so they read as a serious command center with optional game/arena affordances: RU-first copy, better typography, stronger hierarchy, reusable visual components, state chips, hovers, focus states, and motion.

## 2. Repo Context Discovered
- Screens live in `apps/electron/src/renderer/components/workbench/*`.
- Route entry is `WorkbenchRoutePage`.
- Existing screens use repeated `rounded-2xl border border-border bg-background` blocks and many English strings.
- Tests are Bun + React `renderToStaticMarkup`.
- Shared truth/state logic is already separated into `*-state.ts` files and must not be weakened by visual polish.

## 3. Files Inspected
- `apps/electron/src/renderer/components/workbench/DeepMissionsScreen.tsx`
- `apps/electron/src/renderer/components/workbench/ArenaBuilderScreen.tsx`
- `apps/electron/src/renderer/components/workbench/MissionControlRunDetail.tsx`
- `apps/electron/src/renderer/components/workbench/ProgressionObservatory.tsx`
- `apps/electron/src/renderer/components/workbench/QuestMapSkillTree.tsx`
- `apps/electron/src/renderer/components/workbench/AgentForgeTeamRegistry.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/*.test.tsx`
- `apps/electron/src/renderer/index.css`

## 4. Tests Added First
- `apps/electron/src/renderer/components/workbench/__tests__/experience-ui-polish.test.tsx`
  - locks reusable Experience visual primitives, motion-safe interaction classes, focus states, progress bars, and status chip labels.
- `apps/electron/src/renderer/components/workbench/__tests__/experience-screens-localization.test.tsx`
  - locks RU-first labels for the Experience screens and guards against stale visible English scaffold strings.
- Existing screen tests were updated after implementation to reflect the new RU-first copy and shared visual components.

## 5. Expected Failing Test Output
- `Cannot find module '../experience-ui'` before the shared Experience visual system existed.
- Deep Missions localization test failed because the screen still rendered `Deep Missions` instead of `Долгие миссии`.
- Stale visible copy checks failed for English-only labels such as `Launch Mission`, `Progression Observatory`, `Team Registry`, and `Skill Tree`.

## 6. Implementation Changes
- Added `experience-ui.tsx` with `ExperienceShell`, `ExperiencePanel`, `ExperienceCard`, `ExperienceMetricCard`, `ExperienceMetricRow`, `ExperienceStatusChip`, and `ExperienceProgressBar`.
- Applied the shared shell/cards/chips/metrics to Deep Missions, Arena Builder, Mission Control, Progression Observatory, Quest Map, and Agent Forge.
- Localized primary Experience navigation and screen copy to Russian while preserving technical/product nouns where they are intentional: `swarm`, `VDI`, `trust`, `credits`, `prompt`, `gate`, and fake-provider labels.
- Added visible gamification states: layer toggles, rarity chips, unlock/locked state, XP/credits ledger, VDI/submetric cards, checkpoint progress, validation gate status, capacity-only swarm slots, and artifact/gate evidence.
- Added hover, focus, active, transition, and reduced-motion-safe classes through reusable components.
- Preserved the shared truth layer: paid capacity still affects slots/duration only and does not mutate VDI, quality, quest completion, or validation truth.
- Kept shadows inside the repo-approved Tailwind tokens (`shadow-thin`, `hover:shadow-tinted`) after lint rejected arbitrary shadow classes.

## 7. Validation Commands Run
- `bun test apps/electron/src/renderer/components/workbench/__tests__/experience-ui-polish.test.tsx apps/electron/src/renderer/components/workbench/__tests__/experience-screens-localization.test.tsx apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx apps/electron/src/renderer/components/workbench/__tests__/progression-observatory.test.tsx apps/electron/src/renderer/components/workbench/__tests__/quest-map-skill-tree.test.tsx apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx`
- `bun test apps/electron/src/renderer/components/workbench`
- `bun run validate:agent-contract`
- `bun run typecheck:electron`
- `bun run lint:electron`
- `git diff --check`
- `bun run electron:build`
- `bun run electron:smoke`
- `bun run electron:start`

## 8. Passing Test Output Summary
- Targeted Experience tests: 36 pass, 0 fail, 143 expect calls across 9 files.
- Full workbench component suite: 45 pass, 0 fail, 197 expect calls across 11 files.
- Agent contract validation: `[agent-contract] ok: 11 skills, 44 tickets, 7 required docs`.
- Typecheck: `tsc --noEmit` completed with exit code 0.
- Lint: completed with exit code 0 after replacing arbitrary shadow classes with approved tokens.
- Diff whitespace check: exit code 0.
- Electron smoke: sandboxed run aborted with `SIGABRT`; escalated GUI run passed with `App initialized successfully` and `[smoke] Electron headless startup passed`.
- Electron start: app initialized successfully, ROX server listening on `ws://127.0.0.1:49793`, window revealed at `1400x900`.

## 9. Build Output Summary
- `bun run electron:build` completed with exit code 0.
- Main, preload, renderer, resources, and assets built successfully.
- Known non-blocking warnings remain: Vite outDir warning, Jotai babel deprecation, and large renderer chunk warnings.

## 10. Remaining Risks
- No pixel-diff visual-verdict artifact was produced because the current Codex App surface did not expose a runnable `visual-verdict` command.
- Some domain terms intentionally remain English because they are product or technical nouns: `swarm`, `VDI`, `trust`, `credits`, `prompt`, `gate`, and fake-provider labels.
- This task did not call real LLM, S3, payment, browser, email, or marketplace providers.
- Runtime `events.jsonl` and unrelated dirty files remain unstaged.

## 11. Acceptance Criteria Matrix
| Criterion | Status | Evidence |
|---|---:|---|
| Shared visual shell/cards/chips/metrics | Done | `experience-ui.tsx`; targeted tests pass |
| RU-first UI copy | Done | `experience-screens-localization.test.tsx`; screen tests pass |
| Gamification states visible | Done | Arena rarity/unlocks, quest progress, VDI, XP/credits, gates, checkpoint progress |
| Hover/focus/active/motion states | Done | `experience-ui-polish.test.tsx`; lint pass |
| Capacity does not alter quality/VDI truth | Done | Progression/Arena tests assert capacity-only and evidence-backed quality |
| Tests/typecheck/lint/build/run evidence | Done | Workbench tests, contract, typecheck, lint, build, smoke, and live app start pass |
