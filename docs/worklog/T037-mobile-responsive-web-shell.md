# T037-mobile-responsive-web-shell

## 1. Task summary

Add a shared mobile responsive shell contract for the Experience Layer screens
so the main content and side context stack safely on mobile while preserving the
desktop mission-control layout at wider breakpoints.

## 2. Repo context discovered

- Experience screens share `ExperienceShell` in
  `apps/electron/src/renderer/components/workbench/experience-ui.tsx`.
- First-class workbench routing is centralized in
  `apps/electron/src/renderer/components/workbench/WorkbenchRoutePage.tsx`.
- Existing UI tests rely on `bun:test` plus `renderToStaticMarkup` for stable
  markup contracts, localization, data attributes, states, and Tailwind class
  hooks.
- The right implementation surface is the shared shell, not individual screen
  files, because `DeepMissionsScreen`, `ArenaBuilderScreen`,
  `MissionControlRunDetail`, `ProgressionObservatory`, `QuestMapSkillTree`, and
  `AgentForgeTeamRegistry` all compose through that primitive.

## 3. Files inspected

- `docs/tickets/T037-mobile-responsive-web-shell.md`
- `package.json`
- `apps/electron/src/renderer/components/workbench/experience-ui.tsx`
- `apps/electron/src/renderer/components/workbench/WorkbenchRoutePage.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/experience-ui-polish.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/experience-screens-localization.test.tsx`
- `apps/electron/src/renderer/index.css`

## 4. Tests added first

- `apps/electron/src/renderer/components/workbench/__tests__/mobile-responsive-web-shell.test.tsx`
  - asserts the shared `ExperienceShell` exposes a mobile shell marker;
  - asserts no-horizontal-overflow and one-column mobile layout class contract;
  - asserts action rows can compress to full width on mobile;
  - asserts side context is ordered after main content until desktop;
  - asserts all six first-class Experience screens inherit the same contract.

## 5. Expected failing test output

First red run:

```text
Expected to contain: "data-mobile-shell=\"true\""
0 pass
7 fail
13 expect() calls
```

The failure matched the missing shared mobile shell contract.

## 6. Implementation changes

- Updated `ExperienceShell` with `data-mobile-shell="true"`.
- Added `min-w-0`, `max-w-full`, and `overflow-x-hidden` to the shell root.
- Changed header padding to `px-4 py-4 sm:px-6 sm:py-5`.
- Made actions `w-full sm:w-auto` so compact toolbars can stack on phones.
- Changed the body grid to `grid-cols-1` by default and preserved the existing
  two-column mission-control layout at `xl`.
- Added mobile-safe overflow behavior for the body, main section, and aside.
- Ordered the aside after primary content on mobile via `order-last xl:order-none`.

## 7. Validation commands run

- `bun test apps/electron/src/renderer/components/workbench/__tests__/mobile-responsive-web-shell.test.tsx`
- `bun test apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx apps/electron/src/renderer/components/workbench/__tests__/experience-ui-polish.test.tsx apps/electron/src/renderer/components/workbench/__tests__/experience-screens-localization.test.tsx apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx apps/electron/src/renderer/components/workbench/__tests__/progression-observatory.test.tsx apps/electron/src/renderer/components/workbench/__tests__/quest-map-skill-tree.test.tsx apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx apps/electron/src/renderer/components/workbench/__tests__/mobile-responsive-web-shell.test.tsx`
- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run validate:agent-contract`
- `bun run electron:smoke`

## 8. Passing test output summary

- New mobile responsive shell test: `7 pass`, `0 fail`, `34 expect() calls`.
- Targeted Workbench UI suite: `45 pass`, `0 fail`, `214 expect() calls`.
- Electron TypeScript check passed with `tsc --noEmit`.
- Electron ESLint passed.
- Agent contract validation passed: `ok: 11 skills, 48 tickets, 7 required docs`.

## 9. Build output summary

`bun run electron:smoke` rebuilt main, preload, renderer, resources, and assets,
then launched Electron with `Exit-on-ready` and completed:

```text
App initialized successfully
[smoke] Exit-on-ready requested; shutting down after successful startup
[smoke] Electron headless startup passed
```

Existing build warnings remain non-blocking: Vite `outDir` warning, Jotai Babel
plugin deprecation warnings, and large chunk warnings.

## 10. Remaining risks

- Static markup tests prove the responsive contract and shared class hooks, but
  do not replace screenshot verification on a physical mobile viewport.
- The broader app shell outside Experience routes may still need its own mobile
  navigation pass in a later ticket.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---:|---|
| Experience shell prevents horizontal overflow | DONE | `mobile-responsive-web-shell.test.tsx` |
| Primary/aside layout stacks on mobile | DONE | `mobile-responsive-web-shell.test.tsx` |
| Desktop split layout preserved | DONE | `xl:grid-cols[...]` assertion |
| Action row supports compact mobile width | DONE | `w-full sm:w-auto` assertion |
| All Experience screens inherit shell contract | DONE | six route assertions |
| Existing Experience polish/localization tests pass | DONE | targeted 45-test suite |
| Electron typecheck/lint pass | DONE | `bun run typecheck:electron`, `bun run lint:electron` |
| Electron runtime smoke passes | DONE | `bun run electron:smoke` |
| Worklog complete | DONE | This file |
