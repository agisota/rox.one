# T043 - Deep Missions Entry Screen

## Task summary

Implement the Deep Missions entry surface from the Experience Layer PRD.

## Reformulated task

Create a deterministic renderer-side screen and state helper for configuring long-running missions before launch:

- 6h / 24h / 72h presets
- mission type
- experience layer
- checkpoint cadence preview
- budget/token/storage caps
- agent count estimate
- VDI target
- launch disabled until required fields are valid

## Assumptions and boundaries

- This ticket creates the screen/component contract, not a live route or scheduler.
- No real mission launch happens in tests.
- Launch callback receives a parsed draft payload when valid.
- The screen consumes T041/T042 shared schemas but keeps UI state local.
- Build/runtime integration is for later navigation tickets.

## ERD / schema view

```text
DeepMissionEntryState
  rawInput + title + objective + preset + mode + layer + caps
    -> checkpointPreview[]
    -> validationErrors[]
    -> canLaunch
```

## Sequence diagram

```text
User opens Deep Missions
  -> default 24h mission draft appears
User changes preset/cadence/caps
  -> state recomputes checkpoint preview
  -> validation recomputes launch availability
User clicks Launch
  -> valid draft is emitted through callback
  -> no external provider or scheduler is called
```

## Component / screen map impact

- Adds `DeepMissionsScreen`.
- Adds `deep-missions-state` helper.
- Does not yet add sidebar or route wiring.

## Options and tradeoffs

1. Wire the route immediately.
   - Rejected for T043 because current existing workbench screens are already component-level and route wiring needs broader navigation changes.
2. Implement component/state first.
   - Chosen because it gives a tested screen contract for later route integration.

## Recommended path

Add `apps/electron/src/renderer/components/workbench/deep-missions-state.ts`, `DeepMissionsScreen.tsx`, and component tests.

## Repo context discovered

- Existing workbench screens live in `apps/electron/src/renderer/components/workbench`.
- Existing tests render React screens with `renderToStaticMarkup`.
- Existing renderer workbench state helpers are deterministic and provider-free.

## Files inspected

- `apps/electron/src/renderer/components/workbench/SpecBuilderScreen.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx`
- `apps/electron/package.json`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/experience-layer-registry.ts`

## Tests added first

- `apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx`
  - renders long-running run presets and mission controls
  - requires budget cap before launch even when mission text exists
  - generates deterministic checkpoint cadence previews for presets
  - enables launch only when required fields and caps are valid

## Expected failing test output

Initial TDD run failed before implementation because the component did not exist:

```text
Cannot find module '../DeepMissionsScreen'
```

## Implementation changes

- Added deterministic Deep Missions entry state in `apps/electron/src/renderer/components/workbench/deep-missions-state.ts`.
- Added `DeepMissionsScreen` with 6h/24h/72h presets, mission types, experience layer display, checkpoint cadence preview, budget/token/storage caps, VDI target, and launch readiness.
- Kept the launch path provider-free: valid state is emitted through `onLaunchMission`; no scheduler, LLM, browser, billing, storage, or marketplace provider is called.
- Kept route/sidebar wiring out of T043 to preserve the component contract and avoid widening the navigation surface before tests for that surface exist.

## Validation commands run

- `bun test apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx` - passed.
- `bun test apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx` - passed.
- `bun run typecheck` from `apps/electron` - passed.
- `bun x eslint src/renderer/components/workbench/DeepMissionsScreen.tsx src/renderer/components/workbench/deep-missions-state.ts src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx` from `apps/electron` - passed.
- `bun run validate:agent-contract` - passed.
- `bun run lint` from `apps/electron` - failed on unrelated existing `ProductModeToolbar.tsx` shadow class violations.

## Passing test output summary

```text
bun test apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx
4 pass
0 fail
17 expect() calls
```

```text
bun test apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx
9 pass
0 fail
54 expect() calls
```

```text
bun run validate:agent-contract
[agent-contract] ok: 11 skills, 42 tickets, 7 required docs
```

## Build output summary

No runtime/build surface was wired in T043. Electron typecheck passed. Full Electron lint is blocked by unrelated pre-existing violations:

```text
apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx
52:21 error Disallowed shadow class "shadow-sm"
64:23 error Disallowed shadow class "shadow-lg"
94:23 error Disallowed shadow class "shadow-sm"
```

## Remaining risks

- The screen is not yet reachable through navigation; that remains a later route/shell ticket.
- The scheduler adapter is intentionally not implemented in T043; T049 owns long-running mission scheduling.
- Full `apps/electron` lint remains blocked by unrelated existing `ProductModeToolbar.tsx` style violations.

## Acceptance criteria matrix

- [x] Deep Missions screen renders run presets.
- [x] Budget cap is required before launch.
- [x] Checkpoint cadence preview renders deterministically.
- [x] Launch is disabled until required fields are valid.
- [x] Targeted UI tests pass.
- [x] Relevant broader validation passes where not blocked by unrelated pre-existing lint debt.
- [ ] Scoped commit exists.
