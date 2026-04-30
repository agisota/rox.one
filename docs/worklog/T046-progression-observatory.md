# T046 - Progression Observatory

## Task summary

Implement the Progression Observatory screen from the Experience Layer PRD.

## Reformulated task

Create a deterministic renderer-side observatory for:

- VDI and submetric dashboard
- XP/economy ledger evidence requirements
- leaderboard privacy policy
- paid capacity display without quality-score mutation

## Assumptions and boundaries

- This ticket creates a screen/state contract, not real billing or multiplayer ranking.
- Ledger validation uses the shared `ProgressLedgerSchema`.
- Leaderboards are deterministic local fixtures and respect privacy policy.
- Paid entitlements expose capacity only and do not change VDI, quality score, or execution readiness.
- No real billing, payment, marketplace, LLM, S3, browser, or email provider is called.

## ERD / schema view

```text
ProgressionState
  latestSnapshot
  ledger[]
  leaderboardRows[]
  leaderboardPolicy
  entitlement
    -> capacity
    -> visibleLeaderboardRows
```

## Sequence diagram

```text
Observatory opens
  -> latest metric snapshot renders
  -> ledger and capacity render
  -> leaderboard projection respects privacy policy
XP event appended
  -> shared schema validates evidence
Paid capacity changes
  -> capacity display updates
  -> quality and VDI remain unchanged
```

## Component / screen map impact

- Adds `ProgressionObservatory`.
- Adds `progression-observatory-state` helper.
- Does not yet add route/sidebar wiring or live ledger persistence.

## Repo context discovered

- T041 shared models define `MetricSnapshot`, `ProgressLedger`, and entitlement contracts.
- Existing Experience Layer screens use provider-free renderer state helpers.
- Workbench screen tests use `renderToStaticMarkup`.

## Files inspected

- `docs/product/experience-layer-system-prd.md`
- `packages/shared/src/workbench/experience-layer.ts`
- `apps/electron/src/renderer/components/workbench/MissionControlRunDetail.tsx`
- `apps/electron/src/renderer/components/workbench/mission-control-state.ts`

## Tests added first

- `apps/electron/src/renderer/components/workbench/__tests__/progression-observatory.test.tsx`
  - renders VDI and submetrics from metric snapshots
  - verifies XP ledger events require artifact or validation gate evidence
  - verifies leaderboard privacy policy is enforced
  - verifies paid capacity does not change quality score or VDI

## Expected failing test output

Initial TDD run failed before implementation because the component did not exist:

```text
Cannot find module '../ProgressionObservatory'
```

## Implementation changes

- Added deterministic progression state in `apps/electron/src/renderer/components/workbench/progression-observatory-state.ts`.
- Added `ProgressionObservatory` with VDI/submetric cards, economy ledger, leaderboard projection, capacity display, and integrity rules.
- Reused shared `ProgressLedgerSchema` so XP and unlock ledger events require artifact or validation gate evidence.
- Enforced leaderboard privacy by hiding rows when policy disables leaderboards and filtering team-private rows by viewer team.
- Kept paid entitlements limited to displayed capacity; metric snapshots remain unchanged.

## Validation commands run

- `bun test apps/electron/src/renderer/components/workbench/__tests__/progression-observatory.test.tsx apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx` - passed.
- `bun x eslint src/renderer/components/workbench/ProgressionObservatory.tsx src/renderer/components/workbench/progression-observatory-state.ts src/renderer/components/workbench/__tests__/progression-observatory.test.tsx` from `apps/electron` - passed.
- `bun run typecheck` from `apps/electron` - passed.
- `bun run validate:agent-contract` - passed.
- `bun run lint` from `apps/electron` - failed on unrelated existing `ProductModeToolbar.tsx` shadow class violations.

## Passing test output summary

```text
bun test apps/electron/src/renderer/components/workbench/__tests__/progression-observatory.test.tsx apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx
18 pass
0 fail
74 expect() calls
```

```text
bun run validate:agent-contract
[agent-contract] ok: 11 skills, 42 tickets, 7 required docs
```

## Build output summary

No route/runtime/build surface was wired in T046. Electron typecheck passed. Full Electron lint is blocked by unrelated pre-existing violations:

```text
apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx
52:21 error Disallowed shadow class "shadow-sm"
64:23 error Disallowed shadow class "shadow-lg"
94:23 error Disallowed shadow class "shadow-sm"
```

## Remaining risks

- The screen is not yet reachable through app navigation; route/shell wiring remains later work.
- Ledger and leaderboard data are deterministic local fixtures; persistent ledger and privacy policy integration remain later backend/team work.
- Full `apps/electron` lint remains blocked by unrelated existing `ProductModeToolbar.tsx` style violations.

## Acceptance criteria matrix

- [x] Metrics render from snapshots.
- [x] XP ledger requires evidence.
- [x] Leaderboard privacy policy is enforced.
- [x] Paid capacity does not change quality score or VDI.
- [x] Targeted UI/state tests pass.
- [x] Relevant broader validation passes where not blocked by unrelated pre-existing lint debt.
- [ ] Scoped commit exists.
