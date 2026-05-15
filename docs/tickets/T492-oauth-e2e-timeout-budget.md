# T492 - OAuth E2E timeout budget

Status: DONE

## Context

PR #226 is documentation-only for R.11, but CI exposed an existing flaky E2E
test against the live GitHub MCP OAuth metadata endpoint. The test's default
5000 ms Bun timeout races the production discovery helper's own 5000 ms network
timeout, so a slow but tolerated endpoint can fail the test before the helper
returns `null`.

## Goal

Give CI's unit-test invocation an explicit Bun test timeout budget so the live
OAuth metadata E2E assertions can complete without touching package/runtime
paths that trigger the GitHub macOS ARM billing-gated workflow.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

- Confirm RED first with the existing test or CI failure:
  `E2E: OAuth Metadata Discovery > GitHub MCP (api.githubcopilot.com) >
  discovers OAuth metadata` timed out after 5000 ms.

## Implementation Requirements

- Change only CI/docs surfaces.
- Do not alter OAuth production discovery behavior.
- Keep the test network-tolerant: unavailable metadata may return `null`.

## Validation Commands

- `bun test packages/shared/src/auth/__tests__/oauth.e2e.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED evidence exists for the 5000 ms timeout.
- [x] OAuth production and package test code are unchanged.
- [x] CI unit-test invocations have an explicit timeout budget.
- [x] The targeted OAuth E2E test passes locally.
- [x] Documentation validators pass.

## Worklog

See `docs/worklog/T492-oauth-e2e-timeout-budget.md`.
