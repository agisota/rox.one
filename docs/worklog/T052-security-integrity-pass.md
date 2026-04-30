# T052 - Security and Integrity Pass

## Task summary

Add a dedicated security/integrity pass across Experience Layer missions, packages, entitlements, ledgers, and team registry. The pass must provide reusable deny-by-default guards for tenant isolation, package visibility, ledger spoofing, entitlement bypass, and package permission escalation.

## Repo context discovered

- T041 shared models define mission, package, contract, entitlement, and ledger schemas in `packages/shared/src/workbench/experience-layer.ts`.
- T048 UI state already filters team-private packages in `apps/electron/src/renderer/components/workbench/agent-forge-state.ts`, but T052 needs shared guard functions so security is not only presentational.
- T041 explicitly keeps paid entitlements unable to satisfy validation gates through `paidEntitlementCanSatisfyValidationGate`.
- Existing shared tests use `bun:test` and colocated `packages/shared/src/workbench/__tests__/*.test.ts`.

## Files inspected

- `docs/product/experience-layer-system-prd.md`
- `packages/shared/src/workbench/experience-layer.ts`
- `apps/electron/src/renderer/components/workbench/agent-forge-state.ts`
- `apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx`
- `docs/worklog/T048-agent-forge-team-registry.md`
- `docs/worklog/T046-progression-observatory.md`

## Tests added first

- `packages/shared/src/workbench/__tests__/experience-layer-security.test.ts`

## Expected failing test output

- `bun test packages/shared/src/workbench/__tests__/experience-layer-security.test.ts`
- Failed as expected because `../experience-layer-security` did not exist:
  - `error: Cannot find module '../experience-layer-security'`

## Implementation changes

- Added `packages/shared/src/workbench/experience-layer-security.ts`.
- Exported the new security guards from `packages/shared/src/workbench/index.ts`.
- Implemented shared deny-by-default guards for:
  - mission tenant access;
  - private/team package visibility;
  - ledger actor/user/team boundaries;
  - paid entitlement validation-gate bypass attempts;
  - package permission profile escalation;
  - prompt-injection warning baseline before public package publish.

## Validation commands run

- `bun test packages/shared/src/workbench/__tests__/experience-layer-security.test.ts packages/shared/src/workbench/__tests__/experience-layer-e2e-scenario.test.ts packages/shared/src/workbench/__tests__/experience-layer.test.ts`
- `bun run typecheck:shared`
- `bun run lint:shared`
- `bun run validate:agent-contract`

## Passing test output summary

- Targeted shared security/integrity suite: 17 pass, 0 fail.
- Shared typecheck: passed.
- Shared lint: passed.
- Agent contract validation: passed.

## Build output summary

- No runtime build was required because T052 only adds shared pure security guard logic and tests.
- Shared TypeScript validation passed via `bun run typecheck:shared`.
- Build surface is unchanged.

## Remaining risks

- This pass validates shared guard semantics. Live API middleware and persistence adapters still need to call these guards when cloud endpoints are added.

## Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Cross-team mission denied | Pass | `assertMissionAccess` test denies actor from another team. |
| Cross-team package denied | Pass | `assertPackageVisibilityAccess` test denies cross-team package access. |
| Ledger spoofing denied | Pass | `assertLedgerEntryActor` tests deny other-user and other-team ledger writes. |
| Entitlement bypass denied | Pass | `assertEntitlementCannotSatisfyGate` test denies paid gate satisfaction. |
| Package permission escalation denied | Pass | `assertPackagePermissionProfile` test denies `browser.write` outside allowed profile. |
| Prompt injection baseline enforced for public publish | Pass | `assertPublicPackagePublishable` test blocks unresolved warning. |
| Tests pass | Pass | Targeted shared security/integrity suite: 17 pass, 0 fail. |
| Validation commands pass | Pass | `typecheck:shared`, `lint:shared`, and `validate:agent-contract` passed. |
| Scoped commit exists | Pending |  |
