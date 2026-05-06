# T067 - Real Provider Orchestration

Status: DONE

## Goal

Add provider gateway contracts for Workbench and Mission flows without coupling
UI screens directly to real LLM, research, storage, email, billing, viewer,
scheduler, or agent registry providers.

## Scope

- Define a `ProviderGateway` contract with typed request/result payloads.
- Add deterministic fake provider behavior for tests and local workflows.
- Add adapter seams for:
  - LLM
  - research/browser
  - object storage
  - email
  - billing/payment
  - shortlink/viewer
  - scheduler
  - agent registry
- Define artifact/evidence output contracts.
- Define provider error taxonomy and retry/user-state mapping.
- Reject invalid provider artifacts before they become mission evidence.
- Redact secrets from public/share artifacts.
- Prevent real provider adapters from running in tests unless explicitly enabled.

## Required Tests

- Fake provider returns deterministic artifacts.
- Provider error maps to user-visible state.
- Provider timeout does not corrupt mission state.
- Provider output must satisfy artifact schema.
- Secret fields are never included in public/share artifacts.
- Real adapter seams are not invoked in tests.

## Acceptance Criteria

- [x] Provider gateway targeted tests pass.
- [x] No direct UI to provider contract is introduced.
- [x] Fake providers are deterministic.
- [x] Real providers are blocked by default in tests.
- [x] Worklog is complete.
- [x] Scoped commit exists.

## Worklog

- `docs/worklog/T067-real-provider-orchestration.md`
