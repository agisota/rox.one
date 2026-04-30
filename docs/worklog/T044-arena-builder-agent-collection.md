# T044 - Arena Builder and Agent Collection

## Task summary

Implement the Arena Builder and Agent Collection screen from the Experience Layer PRD.

## Reformulated task

Create a deterministic renderer-side collection/builder surface for selecting trusted agent packages into a swarm mission draft:

- agent roster
- locked/unlocked status
- selected agents
- entitlement-limited swarm slots
- budget estimate
- selected agent persistence into draft run payload

## Assumptions and boundaries

- This ticket creates a screen/state contract, not a public marketplace.
- Agent roster data is deterministic fixture data for UI and tests.
- Paid entitlements increase capacity only. They do not change validation gates, trust checks, VDI, or quality semantics.
- Locked agents cannot be selected through initial state or user actions.
- No real package registry, billing, LLM, scheduler, storage, browser, or email provider is called.

## ERD / schema view

```text
ArenaAgentCollectionItem
  -> AgentPackage
  -> level/mastery/unlockCriteria/baseCost

ArenaBuilderState
  roster + selectedAgentPackageIds + entitlement
    -> runEstimate
    -> draftRun
```

## Sequence diagram

```text
User opens Arena Builder
  -> deterministic roster loads
User selects/unselects agents
  -> locked agents ignored
  -> max slots enforced from entitlement
  -> budget estimate recomputes
User creates draft run
  -> selectedAgentPackageIds persist in draft payload
  -> validation gates remain fixed
```

## Component / screen map impact

- Adds `ArenaBuilderScreen`.
- Adds `arena-builder-state` helper.
- Does not yet add sidebar or route wiring.

## Repo context discovered

- Existing workbench screens live in `apps/electron/src/renderer/components/workbench`.
- Existing screen tests render React components with `renderToStaticMarkup`.
- T041 already defines shared `AgentPackage`, `MissionMode`, `ExperienceLayer`, and validation gate contracts.
- T042 already defines Game/Arena visibility policy, but T044 keeps local component state deterministic.

## Files inspected

- `docs/product/experience-layer-system-prd.md`
- `apps/electron/src/renderer/components/workbench/DeepMissionsScreen.tsx`
- `apps/electron/src/renderer/components/workbench/deep-missions-state.ts`
- `apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx`
- `packages/shared/src/workbench/experience-layer.ts`

## Tests added first

- `apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx`
  - renders agent roster, selected agents, swarm slots, and run estimate
  - verifies locked agents cannot be selected from initial state or toggle actions
  - verifies swarm count respects entitlement capacity without changing validation truth
  - verifies budget estimate updates from selected agents
  - verifies selected agents persist into draft run payload

## Expected failing test output

Initial TDD run failed before implementation because the component did not exist:

```text
Cannot find module '../ArenaBuilderScreen'
```

## Implementation changes

- Added deterministic arena roster/state helper in `apps/electron/src/renderer/components/workbench/arena-builder-state.ts`.
- Added `ArenaBuilderScreen` with Agent Collection cards, lock/unlock state, selected agents, swarm slot usage, budget estimate, required gates, and selection warnings.
- Enforced entitlement slots as capacity only. The required validation gates remain fixed at `schema`, `logic_check`, `fact_check`, and `security_check`.
- Added `createArenaDraftRun` so selected agent package ids persist into a provider-free draft run payload.
- Kept public marketplace, registry fetch, billing, scheduler, and route/sidebar wiring out of T044.

## Validation commands run

- `bun test apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx` - passed.
- `bun test apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx` - passed.
- `bun x eslint src/renderer/components/workbench/ArenaBuilderScreen.tsx src/renderer/components/workbench/arena-builder-state.ts src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx` from `apps/electron` - passed.
- `bun run typecheck` from `apps/electron` - passed.
- `bun run validate:agent-contract` - passed.
- `bun run lint` from `apps/electron` - failed on unrelated existing `ProductModeToolbar.tsx` shadow class violations.

## Passing test output summary

```text
bun test apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx
5 pass
0 fail
24 expect() calls
```

```text
bun test apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx
9 pass
0 fail
41 expect() calls
```

```text
bun run validate:agent-contract
[agent-contract] ok: 11 skills, 42 tickets, 7 required docs
```

## Build output summary

No route/runtime/build surface was wired in T044. Electron typecheck passed. Full Electron lint is blocked by unrelated pre-existing violations:

```text
apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx
52:21 error Disallowed shadow class "shadow-sm"
64:23 error Disallowed shadow class "shadow-lg"
94:23 error Disallowed shadow class "shadow-sm"
```

## Remaining risks

- The screen is not yet reachable through app navigation; that remains a later route/shell ticket.
- Arena roster is deterministic fixture data; private/team registry integration belongs to later Agent Forge/registry tickets.
- Full `apps/electron` lint remains blocked by unrelated existing `ProductModeToolbar.tsx` style violations.

## Acceptance criteria matrix

- [x] Agent roster renders.
- [x] Locked agents cannot be selected.
- [x] Swarm count respects entitlement capacity.
- [x] Budget estimate updates when selected agents change.
- [x] Selected agents persist in draft run payload.
- [x] Targeted UI/state tests pass.
- [x] Relevant broader validation passes where not blocked by unrelated pre-existing lint debt.
- [ ] Scoped commit exists.
