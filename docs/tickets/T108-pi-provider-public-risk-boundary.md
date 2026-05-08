# T108 - PI Provider Public Risk Boundary

Status: DONE

## Context

T104 records provider dependency risk through `@mariozechner/pi-ai`,
`@mariozechner/pi-agent-core`, `@anthropic-ai/sdk`, and transitive
`protobufjs`. T106 and T107 added explicit public-untrusted boundaries for
document conversion and messaging. The PI provider subprocess needs the same
kind of runtime guard so a public headless server cannot silently start the
PI SDK path before dependency remediation, isolation, or accepted-risk approval.

## Goal

Add a narrow provider dependency-risk policy around the PI backend. In
`public-untrusted` mode, PI sessions must fail before subprocess path
resolution, credential lookup, or PI SDK startup.

## Required UI

No UI change.

## Required Data/API

- Preserve existing private/local PI behavior by default.
- Derive `public-untrusted` from `CRAFT_PUBLIC_APP_URL` when no explicit PI
  provider risk mode is configured.
- Allow explicit override through `CRAFT_PI_PROVIDER_DEPENDENCY_RISK_MODE` or
  generic `CRAFT_PROVIDER_DEPENDENCY_RISK_MODE`.
- Treat `accepted-risk` and `isolated-worker` as explicit non-blocking modes.
- Reject `public-untrusted` before PI subprocess path resolution or credential
  lookup.

## Required Automations

- Add focused unit coverage for risk-mode parsing.
- Add a PI agent regression proving `public-untrusted` fails before the existing
  missing-`piServerPath` error.
- Keep existing PI tests green.

## Required Subagents

No subagent required: this is a bounded provider startup guard.

## TDD Requirements

Before implementation:

1. Add PI provider risk-mode tests.
2. Run the focused tests and confirm the expected red failure.

## Implementation Requirements

- Add a small shared risk-mode helper instead of scattering env parsing.
- Wire `PiAgent` startup through the guard before subprocess/runtime/credential
  work.
- Do not change dependency versions, package manifests, or lockfiles.

## Validation Commands

- `bun test packages/shared/src/agent/__tests__/pi-agent-dependency-risk.test.ts`
- `bun test packages/shared/src/agent/__tests__/pi-agent-error-handling.test.ts packages/shared/src/agent/__tests__/pi-agent-bedrock-env.test.ts`
- `bun run typecheck:shared`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Public URL defaults PI provider risk mode to public-untrusted | DONE |
| Explicit PI-specific risk mode overrides generic mode | DONE |
| Public-untrusted PI startup rejects before missing piServerPath / credentials | DONE |
| Private/local or accepted-risk PI startup behavior remains unchanged | DONE |
| Dependency manifests and lockfiles remain unchanged | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T108-pi-provider-public-risk-boundary.md`.
