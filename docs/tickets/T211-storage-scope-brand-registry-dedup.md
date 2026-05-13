# T211 - Storage scope brand registry dedup

Status: DONE

## Context

Full-suite validation still fails in backend factory tests after C4 because
`DEFAULT_LOCAL_SCOPE` can be minted by one module instance while
`storage-internal.ts` checks branding through another. The object is an
official default scope, but the module-local WeakSet does not survive duplicate
module instances created by mixed import paths in the full test graph.

## Goal

Make official branded scopes accepted across duplicate module instances without
exporting the private brand symbol or brand applier.

## Required UI

None.

## Required Data/API

- Do not change the on-disk storage layout.
- Do not export the private brand symbol or `brand()` applier.
- Keep unbranded literals rejected.

## Required Automations

- Add a regression test that reproduces duplicate module identity and fails
  before the registry fix.

## Required Subagents

None. The failing stack trace points directly at the brand registry boundary.

## TDD Requirements

Write the duplicate-module regression first, confirm it fails with
`BrandedScopeBreachError`, then implement the minimal registry fix.

## Implementation Requirements

- Share only the internal WeakSet registry across module instances.
- Keep branded scope creation limited to `DEFAULT_LOCAL_SCOPE` and
  `deriveScopeFromAuth`.

## Validation Commands

- `bun test packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun test packages/shared/src/agent/backend/__tests__/factory.test.ts`
- Full final validation matrix.

## Acceptance Criteria

- [x] Duplicate-module official `DEFAULT_LOCAL_SCOPE` is accepted.
- [x] Unbranded scope literals remain rejected.
- [x] Backend factory test passes after the brand registry fix.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T211-storage-scope-brand-registry-dedup.md`.
