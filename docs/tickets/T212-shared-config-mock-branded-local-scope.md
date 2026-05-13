# T212 - Shared config mock branded local scope

Status: DONE

## Context

Full-suite validation still fails in `packages/shared/src/agent/backend/__tests__/factory.test.ts`
after the C4 brand-registry fix. The targeted C4 and backend tests pass, but
the full Bun test graph can run files with active `@craft-agent/shared/config`
mocks in parallel. One Electron handler test mocks `DEFAULT_LOCAL_SCOPE` as a
plain frozen literal, which can leak an unbranded local scope into storage code.

## Goal

Keep shared-config test mocks compatible with the C4 branded storage-scope
contract so parallel full-suite execution cannot pass a literal local scope to
storage internals.

## Required UI

None.

## Required Data/API

- Do not change production runtime behavior.
- Do not weaken storage scope brand enforcement.
- Do not export the private storage brand symbol or `brand()` applier.

## Required Automations

Use the existing failing full-suite validation as the red check, then rerun the
targeted mock/backend order and full validation.

## Required Subagents

Explorer was used for read-only import/mock mapping because the failure only
reproduced in the full test graph.

## TDD Requirements

Confirm the existing full `bun test --bail` failure before changing mocks.

## Implementation Requirements

- Replace mocked `DEFAULT_LOCAL_SCOPE` literals with the real branded singleton.
- Keep the tests isolated from disk I/O and unrelated runtime modules.

## Validation Commands

- `bun test --bail`
- `bun test apps/electron/src/main/handlers/__tests__/settings-default-thinking.test.ts packages/shared/src/agent/backend/__tests__/factory.test.ts`
- `bun test apps/electron/src/main/__tests__/session-branch-rollback.isolated.ts`
- Full final validation matrix.

## Acceptance Criteria

- [x] Full `bun test --bail` no longer fails with `BrandedScopeBreachError` in backend factory.
- [x] Targeted settings handler + backend factory ordering passes.
- [x] Isolated session branch rollback test still passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T212-shared-config-mock-branded-local-scope.md`.
