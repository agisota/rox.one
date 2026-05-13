# T210 - Transport banner i18n test determinism

Status: DONE

## Context

C4 final validation exposed a stable renderer test failure in
`transport-connection-banner.test.ts`. The test expects English copy but
`setupI18n()` defaults to Russian when no stored language is available.

## Goal

Make the transport banner copy test deterministic by explicitly selecting the
locale it asserts.

## Required UI

None. Preserve existing runtime copy and behavior.

## Required Data/API

No production data or API changes.

## Required Automations

Run the focused renderer component test.

## Required Subagents

None. The failure is isolated and reproducible.

## TDD Requirements

Use the existing red focused test as the red state, then make the smallest
test-harness fix.

## Implementation Requirements

- Do not change localized strings.
- Do not change `setupI18n()` runtime defaults.
- Keep assertions aligned with English copy by explicitly selecting `en`.

## Validation Commands

- `bun test apps/electron/src/renderer/components/app-shell/__tests__/transport-connection-banner.test.ts`
- Relevant final validation commands after all blockers are fixed.

## Acceptance Criteria

- [x] Focused transport banner test passes.
- [x] Runtime copy and i18n defaults are unchanged.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T210-transport-banner-i18n-test-determinism.md`.
