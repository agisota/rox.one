# T112 - Provider SDK Public Risk Boundary

Status: DONE

## Context

T108 blocks PI session startup in `public-untrusted` mode and T110 blocks risky
custom endpoint URLs before setup/test/save. `llm-connections.ts` still exposes
provider SDK surfaces for PI provider model discovery and GitHub Copilot OAuth
without a dedicated public-untrusted guard before importing the PI SDK modules.

## Goal

Add a narrow provider SDK public-risk guard so public deployments do not import
or invoke PI SDK provider-discovery/OAuth surfaces before remediation,
isolation, or accepted-risk approval.

## Required UI

No UI change.

## Required Data/API

- Preserve private/local provider SDK behavior by default.
- Derive `public-untrusted` from `CRAFT_PUBLIC_APP_URL` when no explicit
  provider risk mode is configured.
- Allow explicit override through `CRAFT_LLM_PROVIDER_DEPENDENCY_RISK_MODE` or
  `CRAFT_PROVIDER_DEPENDENCY_RISK_MODE`.
- Treat `accepted-risk` and `isolated-worker` as explicit non-blocking modes.
- Reject PI provider model discovery and GitHub Copilot OAuth in
  `public-untrusted` mode before SDK imports or network calls.
- Do not change dependency versions, package manifests, or lockfiles.

## Required Automations

- Add focused pure unit tests for provider SDK risk-mode resolution and access
  classification.
- Keep adjacent connection setup tests green.

## Required Subagents

No subagent required: this is a bounded server-core guard slice.

## TDD Requirements

Before implementation:

1. Add provider SDK public exposure guard tests.
2. Run the focused tests and confirm the expected red failure.

## Implementation Requirements

- Implement the guard in shared server-core connection setup domain logic.
- Wire PI provider model discovery and GitHub Copilot OAuth handlers through
  the guard before importing `@mariozechner/pi-ai` modules.
- Preserve current private/local behavior.

## Validation Commands

- `bun test packages/server-core/src/domain/connection-setup-logic.test.ts`
- `cd packages/server-core && bun run typecheck`
- `bun run validate:docs`
- `git diff --check`
- `git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Provider SDK guard tests fail before implementation and pass after | DONE |
| Public app default resolves provider SDK mode to `public-untrusted` | DONE |
| Explicit accepted-risk provider mode overrides public default | DONE |
| Public-untrusted rejects provider SDK discovery/OAuth surfaces | DONE |
| Accepted-risk and isolated-worker provider SDK behavior remains unchanged | DONE |
| Provider model discovery and Copilot OAuth handlers run the guard before SDK imports | DONE |
| Dependency manifests and lockfiles remain unchanged | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T112-provider-sdk-public-risk-boundary.md`.
