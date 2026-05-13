# T202 - ZED.MD default provider for ROX.ONE

Status: DONE

## Context

The ROX.ONE onboarding API screen currently treats `https://api.zed.md/v1` as a generic custom endpoint. Connection validation can fall through to the generic Pi subprocess path and surface `spawn ENOEXEC` instead of validating the OpenAI-compatible endpoint directly.

## Goal

Make ROX.ONE default to the ZED.MD API provider with the operator-approved model list, persist it as the local default connection, and validate the endpoint without spawning a generic subprocess.

## Required UI

- API configuration screen defaults to a ZED.MD preset.
- Endpoint is `https://api.zed.md/v1`.
- Model field is prefilled with the approved comma-separated model list.
- Submitting the ZED.MD preset routes as OpenAI-compatible custom endpoint.

## Required Data/API

- Saved connection uses `providerType='pi_compat'`.
- Saved connection uses `authType='api_key_with_endpoint'`.
- Saved connection has `customEndpoint.api='openai-completions'`.
- Saved connection has `piAuthProvider='openai'`.

## Required Automations

- Direct setup-time HTTP validation against `/v1/chat/completions`.
- No generic subprocess fallback for explicit OpenAI-compatible custom endpoints.

## Required Subagents

Not required; the bug surface is bounded to onboarding submit state, backend connection test routing, and local config wiring.

## TDD Requirements

Before implementation:

1. Add renderer helper tests for preset-driven custom endpoint routing.
2. Add Pi driver tests for OpenAI-compatible direct HTTP validation.
3. Run targeted tests and capture expected failing output.

## Implementation Requirements

Implement minimal code required to pass tests. Do not add unrelated provider changes.

## Validation Commands

- `bun test apps/electron/src/renderer/components/apisetup/__tests__/ApiKeyInput.test.ts packages/shared/src/agent/backend/internal/drivers/pi.test.ts`
- `bun run electron:build`
- Packaged app smoke where feasible.

## Acceptance Criteria

- [ ] ZED.MD is the default provider preset.
- [ ] Exact approved model list is prefilled.
- [ ] ZED.MD submit produces OpenAI-compatible custom endpoint metadata.
- [ ] Pi driver validates OpenAI-compatible custom endpoints directly.
- [ ] Local `~/.rox` default connection points to ZED.MD.
- [ ] Tests pass.
- [ ] Build passes when applicable.
- [ ] Worklog complete.
- [ ] Commit created.

## Worklog

Update `docs/worklog/T202-zed-md-default-provider.md`.
