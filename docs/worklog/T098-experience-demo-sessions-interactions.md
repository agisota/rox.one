# T098 - Experience Demo Sessions and Interactive State Proof Worklog

## 1. Task summary

Continue the production-ready Craft/ROX backlog one ticket at a time by
finishing the current Experience workbench slice: sanitized demo sessions,
truth-state routing, and focused interactive state proof.

Inherited dirty-tree note: before this continuation, the working tree already
contained candidate tests and implementation files for this slice. I am treating
those as the active T098 layer, verifying them from evidence, and keeping
unrelated branding/package/runtime-artifact files out of the task commit.

## 2. Repo context discovered

- Root `AGENTS.md` requires `docs/tickets/*.md`, `docs/worklog/<TASK>.md`,
  tests before implementation, relevant validations, and a Lore commit.
- `bd ready` failed with `no beads database found`; this checkout's active task
  surface is the repo-native `docs/tickets` plus `docs/worklog`.
- Current branch is `mac/rox-production-ready-rc`.
- Safe remote layout is intact: `origin` points at
  `https://github.com/agisota/rox-one-terminal.git`; `craft-origin` remains the
  original upstream fork handle and must not be the default push target.
- Last committed ticket is T097: `Normalize desktop app identity to ROX.ONE`.
- Current uncommitted T098-shaped files include:
  - `apps/electron/src/renderer/components/workbench/WorkbenchRoutePage.tsx`
  - `apps/electron/src/renderer/components/workbench/demo-experience-sessions.ts`
  - `apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx`
  - `apps/electron/src/renderer/components/workbench/__tests__/workbench-interactions.test.ts`
  - `apps/electron/src/renderer/components/workbench/*Screen.tsx`
  - `apps/electron/src/renderer/components/workbench/*state.ts`
  - `docs/experience-tabs-sessions-skills.md`

## 3. Files inspected

- `AGENTS.md`
- `docs/tickets/TEMPLATE.md`
- `docs/tickets/T097-desktop-app-dot-branding.md`
- `docs/worklog/T097-desktop-app-dot-branding.md`
- `package.json`
- `apps/electron/src/renderer/components/workbench/WorkbenchRoutePage.tsx`
- `apps/electron/src/renderer/components/workbench/demo-experience-sessions.ts`
- `apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/workbench-interactions.test.ts`
- `apps/electron/src/renderer/components/workbench/mission-control-state.ts`
- `apps/electron/src/renderer/components/workbench/quest-map-state.ts`
- `apps/electron/src/renderer/components/workbench/progression-observatory-state.ts`
- `apps/electron/src/renderer/components/workbench/agent-forge-state.ts`

## 4. Tests added first

Already present in the inherited dirty tree:

- Route test asserts every Workbench screen renders, shows the demo-session
  banner, and ships exactly five sanitized demo sessions per tab.
- Interaction test covers:
  - deep mission launch through runtime store and fake scheduler;
  - mission checkpoint transition and approval mutation;
  - mission finalization through runtime evidence;
  - arena agent selection and draft creation;
  - forge install and publish gates;
  - quest completion plus unlock evaluation;
  - progression ledger event append.

## 5. Expected failing test output

Initial inherited focused run was already green:

```bash
bun test apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx apps/electron/src/renderer/components/workbench/__tests__/workbench-interactions.test.ts
```

Result: 15 pass, 0 fail.

I then added the missing strict-TDD blocked-finalization assertion before fixing
implementation:

```bash
bun test apps/electron/src/renderer/components/workbench/__tests__/workbench-interactions.test.ts
```

Expected red result:

- 8 pass, 1 fail.
- Failure: `mission control does not dispatch finalization while evidence gates
  are missing` expected no runtime finalization error notification, but received
  one because the control helper dispatched `mission.finalized` even when
  `state.canFinalize` was false.

## 6. Implementation changes

- Added `T098` ticket and worklog so the active dirty-tree slice is tracked
  task-by-task.
- Added a dedicated `demo-experience-sessions.ts` module with 30 sanitized
  `ExperienceTruthState` demo sessions: exactly five per Experience tab.
- Added a Workbench route demo-session selector and injected selected truth
  state into all six tabs.
- Added focused route coverage for screen renderability and the five-session
  contract.
- Added focused interaction coverage for mission launch, mission control
  checkpoint/finalize, arena draft creation, progression ledger append, quest
  completion/unlocks, and forge install/publish gates.
- Added minimal UI controls/status surfaces for draft, runtime, quest,
  progression, and forge actions.
- Tightened mission finalization so blocked states do not dispatch
  `mission.finalized` into the runtime store before final artifact/gate evidence
  is present.
- Added `docs/experience-tabs-sessions-skills.md` to document tab roles,
  safe demo/import policy, and backend/model visibility boundaries.

## 7. Validation commands run

| Command | Result | Evidence |
|---|---|---|
| `bun test apps/electron/src/renderer/components/workbench/__tests__/workbench-interactions.test.ts` | RED, expected | 8 pass, 1 fail on blocked finalization dispatch |
| `bun test apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx apps/electron/src/renderer/components/workbench/__tests__/workbench-interactions.test.ts` | PASS | 16 pass, 0 fail, 191 expects |
| `bun run typecheck:electron` | PASS | `tsc --noEmit` exited 0 |
| `bun run lint:electron` | PASS | `eslint src/` exited 0 |
| `bun run electron:build` | PASS | main/preload/renderer/resources/assets build completed; Vite chunk-size warning only |
| `bun run validate:docs` | PASS | `[agent-contract] ok: 11 skills, 99 tickets, 7 required docs`; architecture/sync docs valid |
| `git diff --check` | PASS | no whitespace errors |
| `bun .ouroboros/scripts/render-workbench-evidence.tsx` | PASS | generated six HTML evidence pages and `SUMMARY.json` |
| `playwright screenshot --viewport-size=1440,1000 file://...` | PASS | generated PNG screenshots for all six workbench tabs under `.ouroboros/evidence/workbench-tabs-2026-05-08/` |
| `bun run electron:smoke` | NON-BLOCKING FAIL | readiness markers appeared (`ROX server listening`, `App initialized successfully`, smoke exit requested), but wrapper timed out after 30s and SIGKILL grace; not part of T098 acceptance, tracked as residual runtime-smoke risk |

## 8. Passing test output summary

- Focused route + interaction suite: 16 pass, 0 fail, 191 expects across 2
  files.
- New blocked-finalization regression is covered and green.
- Electron typecheck and lint passed.
- Docs validation counted 99 tickets after adding T098.

## 9. Build output summary

- `bun run electron:build` rebuilt main, preload, renderer, resources, and
  copied assets successfully.
- Vite emitted the existing large chunk warning; no build failure.
- UI evidence artifacts:
  - `.ouroboros/evidence/workbench-tabs-2026-05-08/SUMMARY.json`
  - `.ouroboros/evidence/workbench-tabs-2026-05-08/deep-missions.png`
  - `.ouroboros/evidence/workbench-tabs-2026-05-08/arena-builder.png`
  - `.ouroboros/evidence/workbench-tabs-2026-05-08/mission-control.png`
  - `.ouroboros/evidence/workbench-tabs-2026-05-08/progression.png`
  - `.ouroboros/evidence/workbench-tabs-2026-05-08/quest-map.png`
  - `.ouroboros/evidence/workbench-tabs-2026-05-08/agent-forge.png`

## 10. Remaining risks

- Unrelated dirty-tree files exist outside T098 scope and must not be staged into
  the task commit unless separately justified.
- Real raw session import is intentionally out of scope; this ticket only ships
  sanitized deterministic demo data and importer policy.
- `bun run electron:smoke` reached readiness markers but failed on shutdown
  timeout. The failure is outside the T098 route/state acceptance criteria and
  should be handled as a separate runtime-smoke stabilization ticket if it
  persists.

## 11. Acceptance criteria matrix

| Criteria | Evidence | Status |
|---|---|---|
| Five sanitized demo sessions exist for every Experience tab | Focused route test: 30 sessions, five per `WORKBENCH_SCREENS` entry | DONE |
| Route layer injects selected `ExperienceTruthState` into each tab | `WorkbenchRoutePage` route test + `bun run typecheck:electron` | DONE |
| Interaction tests cover launch/draft/finalize/progression/quest/forge actions | Focused interaction suite, including blocked-finalization red/green | DONE |
| Product note documents sessions, skills, backend/model visibility, and import policy | `docs/experience-tabs-sessions-skills.md` | DONE |
| Focused tests pass | 16 pass, 0 fail | DONE |
| Electron typecheck/lint/build pass or blockers are documented | typecheck, lint, build passed; smoke timeout documented separately | DONE |
| Worklog complete | This file | DONE |
| Scoped Lore commit exists without unrelated runtime artifacts | Staged T098-only task commit | DONE |
