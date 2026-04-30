# T048 - Agent Forge and Team Registry

## Task summary

Implement the Agent Forge and Team Registry screen from the Experience Layer PRD.

## Reformulated task

Create a deterministic private/team registry surface for:

- package contracts
- install/fork actions
- forge gauntlet checks
- trust score calculation
- prompt-injection publish blocking
- team-private package visibility

## Assumptions and boundaries

- This ticket does not implement a public marketplace.
- Team/private registry and trust checks come first.
- Packages cannot install without a `SkillContract`.
- Public publish is blocked when prompt-injection warnings exist.
- Team-private packages are hidden cross-tenant.
- No real package registry, billing, email, browser, storage, or marketplace provider is called.

## ERD / schema view

```text
AgentForgeState
  packages[]
  contractsByPackageId
  reviewsByPackageId
  testsByPackageId
  promptInjectionWarningsByPackageId
    -> visiblePackages
    -> install decision
    -> publish decision
```

## Sequence diagram

```text
Forge opens
  -> private/team packages render
Install selected
  -> contract required
  -> trust checks visible
Publish requested
  -> prompt-injection warnings block public publish
Viewer switches tenant
  -> team-private visibility filters by team
```

## Component / screen map impact

- Adds `AgentForgeTeamRegistry`.
- Adds `agent-forge-state` helper.
- Does not yet add route/sidebar wiring or external registry calls.

## Repo context discovered

- T041 shared models define `AgentPackage` and `SkillContract`.
- T044 uses deterministic agent package fixtures for Arena selection.
- Workbench screen tests use `renderToStaticMarkup`.

## Files inspected

- `docs/product/experience-layer-system-prd.md`
- `packages/shared/src/workbench/experience-layer.ts`
- `apps/electron/src/renderer/components/workbench/arena-builder-state.ts`
- `apps/electron/src/renderer/components/workbench/ArenaBuilderScreen.tsx`

## Tests added first

- `apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx`
  - verifies package without contract cannot install
  - verifies trust score requires reviews and tests
  - verifies prompt injection warning blocks public publish
  - verifies team-private package is not visible cross-tenant
  - verifies Agent Forge screen renders private/team registry, contracts, install/fork labels, and forge gauntlet

## Expected failing test output

Initial TDD run failed before implementation because the component did not exist:

```text
Cannot find module '../AgentForgeTeamRegistry'
```

## Implementation changes

- Added deterministic forge/registry state in `apps/electron/src/renderer/components/workbench/agent-forge-state.ts`.
- Added `AgentForgeTeamRegistry` with package list, contract status, trust score, install/fork labels, forge gauntlet, and guardrails.
- Added install guard requiring a `SkillContract`.
- Added trust score calculation requiring reviews and passing tests.
- Added public publish guard that blocks packages with prompt-injection warnings.
- Added team-private visibility filtering by viewer team id.

## Validation commands run

- `bun test apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx apps/electron/src/renderer/components/workbench/__tests__/quest-map-skill-tree.test.tsx apps/electron/src/renderer/components/workbench/__tests__/progression-observatory.test.tsx apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx` - passed.
- `bun x eslint src/renderer/components/workbench/AgentForgeTeamRegistry.tsx src/renderer/components/workbench/agent-forge-state.ts src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx` from `apps/electron` - passed.
- `bun run typecheck` from `apps/electron` - passed.
- `bun run validate:agent-contract` - passed.
- `bun run lint` from `apps/electron` - failed on unrelated existing `ProductModeToolbar.tsx` shadow class violations.

## Passing test output summary

```text
bun test apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx apps/electron/src/renderer/components/workbench/__tests__/quest-map-skill-tree.test.tsx apps/electron/src/renderer/components/workbench/__tests__/progression-observatory.test.tsx apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx
27 pass
0 fail
97 expect() calls
```

```text
bun run validate:agent-contract
[agent-contract] ok: 11 skills, 42 tickets, 7 required docs
```

## Build output summary

No route/runtime/build surface was wired in T048. Electron typecheck passed. Full Electron lint is blocked by unrelated pre-existing violations:

```text
apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx
52:21 error Disallowed shadow class "shadow-sm"
64:23 error Disallowed shadow class "shadow-lg"
94:23 error Disallowed shadow class "shadow-sm"
```

## Remaining risks

- The screen is not yet reachable through app navigation; route/shell wiring remains later work.
- Registry/package data are deterministic local fixtures; persistent team registry and package install records remain later backend/team work.
- Full `apps/electron` lint remains blocked by unrelated existing `ProductModeToolbar.tsx` style violations.

## Acceptance criteria matrix

- [x] Package without contract cannot install.
- [x] Trust score requires reviews/tests.
- [x] Prompt injection warning blocks public publish.
- [x] Team-private package is not visible cross-tenant.
- [x] Agent Forge screen renders registry and gauntlet.
- [x] Targeted UI/state tests pass.
- [x] Relevant broader validation passes where not blocked by unrelated pre-existing lint debt.
- [ ] Scoped commit exists.
