# T124 - Bundle Policy Gate

Status: DONE

## Context

T119 added a fresh bundle artifact report for Electron renderer, WebUI, and
Viewer. The release docs still classify the current large chunks as
observational only: the clean baselines are measured, but no release gate fails
when bundle totals or oversized chunk counts grow.

## Goal

Turn the fresh Electron/WebUI/Viewer bundle baseline into an explicit release
policy gate that prevents bundle growth regressions while keeping the current
large chunks accepted as the T124 baseline.

## Required UI

No UI change.

## Required Data/API

No data or API change.

## Required Automations

- Add a `validate:bundle-policy` package script.
- The validator refreshes Electron renderer, WebUI, and Viewer bundle outputs
  through the existing fresh report path before enforcing policy ceilings.
- `validate:release` includes the new bundle policy gate.
- The private release workflow runs the bundle policy gate after Electron build.
- The private release pipeline contract validates the new gate.

## Required Subagents

No subagent required: this is a bounded build-policy automation ticket.

## TDD Requirements

Red command before implementation:

```bash
bun run validate:bundle-policy
```

Expected failure before implementation:

```text
error: Script not found "validate:bundle-policy"
```

## Implementation Requirements

- Use existing dependencies only.
- Preserve the current fresh bundle report as the measurement source.
- Do not rechunk bundles or change Vite production config in this ticket.
- Do not change runtime UI behavior.
- Keep package/lock dependency files stable except intended script entries.

## Validation Commands

- `bun run validate:bundle-policy`
- `bun run validate:private-release-pipeline`
- `bun test scripts/__tests__/release-current-handoff-contract.test.ts`
- `bun run validate:docs`
- `bun run validate:release`
- `git diff --check`
- `git status --short -- package.json bun.lock apps/electron/package.json`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Red missing-script failure is recorded | DONE |
| Bundle policy validator refreshes build outputs before checking budgets | DONE |
| Policy gates Electron renderer, WebUI, and Viewer bundle growth | DONE |
| `validate:release` includes the bundle policy gate | DONE |
| Private release workflow includes the bundle policy gate | DONE |
| Private release pipeline contract validates the new gate | DONE |
| Release docs record T124 and remove the old observational-only bundle risk | DONE |
| Focused and full validation pass | DONE |
| Package/lock dependency files remain unchanged except intended script entries | DONE |
| Worklog is complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T124-bundle-policy-gate.md`.
