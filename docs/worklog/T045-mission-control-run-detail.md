# T045 - Mission Control Run Detail

## Task summary

Implement the Mission Control active run detail screen from the Experience Layer PRD.

## Reformulated task

Create a deterministic renderer-side run detail surface for a long-running mission:

- checkpoint timeline
- validation gates
- human approvals
- swarm feed
- interim artifacts by checkpoint
- audit and billing trace
- finalization blocked by pending approvals or critical gate failures

## Assumptions and boundaries

- This ticket creates a screen/state contract, not a live scheduler.
- Checkpoint transitions are deterministic local state transforms.
- Human approval is represented by a fake local approval record.
- Critical gate failures block final pass even when paid capacity exists.
- No real scheduler, billing, LLM, storage, browser, email, or external audit provider is called.

## ERD / schema view

```text
MissionControlState
  mission
  checkpoints[]
  gateResults[]
  approvals[]
  feedItems[]
  artifacts[]
  auditEvents[]
  billingTrace[]
    -> blockingReasons[]
    -> canRunExpensiveBranch
    -> canFinalize
```

## Sequence diagram

```text
Mission run opens
  -> timeline/checkpoints render
  -> gates and approval state derive blockers
Checkpoint transitions
  -> checkpoint state changes
  -> audit event appended
Approval granted
  -> expensive branch unblocked
Critical gate fails
  -> final pass remains blocked
```

## Component / screen map impact

- Adds `MissionControlRunDetail`.
- Adds `mission-control-state` helper.
- Does not yet add route/sidebar wiring or live scheduler events.

## Repo context discovered

- T041 shared models define mission runs, checkpoints, and gate results.
- Existing workbench screen tests render static markup.
- T043/T044 establish provider-free screen/state contracts for Experience Layer screens.

## Files inspected

- `docs/product/experience-layer-system-prd.md`
- `packages/shared/src/workbench/experience-layer.ts`
- `apps/electron/src/renderer/components/workbench/DeepMissionsScreen.tsx`
- `apps/electron/src/renderer/components/workbench/ArenaBuilderScreen.tsx`

## Tests added first

- `apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx`
  - renders active run timeline, feed, gates, approvals, artifacts, audit, and billing trace
  - verifies checkpoint state transitions are deterministic
  - verifies pending approval blocks expensive branch until approved
  - verifies critical gate failure blocks final pass even after approval
  - verifies interim artifacts render by checkpoint

## Expected failing test output

Initial TDD run failed before implementation because the component did not exist:

```text
Cannot find module '../MissionControlRunDetail'
```

## Implementation changes

- Added deterministic mission control state in `apps/electron/src/renderer/components/workbench/mission-control-state.ts`.
- Added `MissionControlRunDetail` with active run timeline, validation gates, human approvals, swarm feed, interim artifacts, audit, billing trace, and blocking reasons.
- Added local checkpoint transition helper that appends audit events.
- Added local approval helper that unblocks expensive branch execution but does not bypass critical validation gates.
- Kept scheduler, real billing, provider calls, route/sidebar wiring, and persistent run storage out of T045.

## Validation commands run

- `bun test apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx` - passed.
- `bun x eslint src/renderer/components/workbench/MissionControlRunDetail.tsx src/renderer/components/workbench/mission-control-state.ts src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx` from `apps/electron` - passed.
- `bun run typecheck` from `apps/electron` - passed.
- `bun run validate:agent-contract` - passed.
- `bun run lint` from `apps/electron` - failed on unrelated existing `ProductModeToolbar.tsx` shadow class violations.

## Passing test output summary

```text
bun test apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx
14 pass
0 fail
61 expect() calls
```

```text
bun run validate:agent-contract
[agent-contract] ok: 11 skills, 42 tickets, 7 required docs
```

## Build output summary

No route/runtime/build surface was wired in T045. Electron typecheck passed. Full Electron lint is blocked by unrelated pre-existing violations:

```text
apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx
52:21 error Disallowed shadow class "shadow-sm"
64:23 error Disallowed shadow class "shadow-lg"
94:23 error Disallowed shadow class "shadow-sm"
```

## Remaining risks

- The screen is not yet reachable through app navigation; route/shell wiring remains later work.
- Mission data is deterministic fixture state; T049 owns fake scheduler adapter and checkpoint executor integration.
- Full `apps/electron` lint remains blocked by unrelated existing `ProductModeToolbar.tsx` style violations.

## Acceptance criteria matrix

- [x] Active run timeline renders.
- [x] Checkpoint state transitions are deterministic.
- [x] Pending approval blocks expensive branch.
- [x] Critical gate fail blocks final pass.
- [x] Interim artifacts render by checkpoint.
- [x] Targeted UI/state tests pass.
- [x] Relevant broader validation passes where not blocked by unrelated pre-existing lint debt.
- [ ] Scoped commit exists.
