# T110 - Public Custom Endpoint SSRF Guard

Status: DONE

## Context

T104 records `axios` and provider SDK exposure as a public-production blocker
and calls for SSRF/proxy tests around public HTTP-fetching paths. T106-T109
added runtime guards and accepted-risk evidence. The LLM custom endpoint setup
path can still persist or test arbitrary base URLs before a public-untrusted
deployment policy check.

## Goal

Add a narrow public-untrusted guard for custom LLM endpoint base URLs. Public
deployments must reject loopback, private-network, and link-local base URLs
before testing or saving a custom endpoint that would cause the server to make a
network request.

## Required UI

No UI change.

## Required Data/API

- Preserve private/local custom endpoint behavior by default.
- Derive `public-untrusted` from `CRAFT_PUBLIC_APP_URL` when no explicit LLM
  endpoint risk mode is configured.
- Allow explicit override through `CRAFT_LLM_ENDPOINT_DEPENDENCY_RISK_MODE` or
  `CRAFT_PROVIDER_DEPENDENCY_RISK_MODE`.
- Treat `accepted-risk` and `isolated-worker` as explicit non-blocking modes.
- Reject loopback/private/link-local custom endpoint base URLs in
  `public-untrusted` mode before setup/test network calls.

## Required Automations

- Add focused pure unit tests for risk-mode resolution and custom endpoint URL
  classification.
- Keep adjacent connection setup tests green.

## Required Subagents

No subagent required: this is a bounded connection setup security slice.

## TDD Requirements

Before implementation:

1. Add public custom endpoint exposure guard tests.
2. Run the focused tests and confirm the expected red failure.

## Implementation Requirements

- Implement the guard in the shared server-core connection setup domain logic.
- Wire setup/test/save LLM connection handlers through the guard before
  persistence or backend connection tests.
- Do not change dependency versions, package manifests, or lockfiles.

## Validation Commands

- `bun test packages/server-core/src/domain/connection-setup-logic.test.ts`
- `cd packages/server-core && bun run typecheck`
- `bun run validate:docs`
- `git diff --check`
- `git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Guard tests fail before implementation and pass after | DONE |
| Public app default resolves to `public-untrusted` | DONE |
| Explicit accepted-risk mode overrides public default | DONE |
| Public-untrusted rejects loopback/private/link-local custom endpoint URLs | DONE |
| Public-untrusted allows public HTTPS custom endpoint URLs | DONE |
| Private-local and accepted-risk behavior remains unchanged | DONE |
| Setup/test/save handlers run the guard before network calls or persistence | DONE |
| Dependency manifests and lockfiles remain unchanged | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T110-public-custom-endpoint-ssrf-guard.md`.
