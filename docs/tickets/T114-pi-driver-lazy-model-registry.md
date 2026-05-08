# T114 - PI Driver Lazy Model Registry

Status: DONE

## Context

T113 removed PI SDK model discovery from the broad shared config barrel. The
internal PI backend driver still imports `models-pi.ts` at module scope, which
keeps the SDK-backed model registry attached to backend driver registration
rather than to explicit PI model discovery/test paths.

## Goal

Lazy-load the PI SDK-backed model registry inside PI driver execution paths so
importing the backend driver registry does not immediately evaluate
`models-pi.ts`.

## Required UI

No UI change.

## Required Data/API

- Preserve PI model fetching behavior for private/local and accepted-risk use.
- Preserve PI lightweight test-connection behavior for private/local and
  accepted-risk use.
- Remove module-scope `models-pi.ts` imports from the PI driver.
- Keep package manifests and lockfiles unchanged.

## Required Automations

- Extend the PI SDK import-boundary contract to fail while the PI driver has a
  module-scope `models-pi.ts` import.
- Keep adjacent PI driver and PI dependency-risk tests green.

## Required Subagents

No subagent required: this is a bounded import-boundary slice.

## TDD Requirements

Before implementation:

1. Add the PI driver lazy-registry assertion.
2. Run the focused contract test and confirm the expected red failure.

## Implementation Requirements

- Replace module-scope PI model registry imports with local dynamic imports.
- Keep existing fetch-model fallback behavior unchanged.
- Keep existing test-connection endpoint resolution behavior unchanged.

## Validation Commands

- `bun test scripts/__tests__/pi-sdk-import-boundary-contract.test.ts`
- `cd packages/shared && bun run test src/agent/backend/internal/drivers/pi.test.ts src/agent/__tests__/pi-agent-dependency-risk.test.ts`
- `bun run typecheck:shared`
- `bun test scripts/__tests__/dependency-risk-register-contract.test.ts`
- `bun run validate:docs`
- `git diff --check`
- `git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Lazy-driver contract fails before implementation and passes after | DONE |
| PI driver no longer imports `models-pi.ts` at module scope | DONE |
| PI driver still resolves static fallback models through lazy import | DONE |
| PI driver test-connection base URL resolution remains available | DONE |
| Dependency risk evidence references T114 | DONE |
| Package manifests and lockfiles remain unchanged | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T114-pi-driver-lazy-model-registry.md`.
