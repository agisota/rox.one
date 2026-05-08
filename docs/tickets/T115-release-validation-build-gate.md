# T115 - Release Validation Build Gate

Status: DONE

## Context

The app build is blocked before Electron packaging because `bun run validate:release`
fails in the test stage. The failures are release-gate contract drift:

- The PI provider factory dispatch test inherits the repository `.env` public URL
  and trips the dependency-risk guard even though the test only proves
  private/local provider dispatch.
- The Agent Forge registry SSR test still forbids install/fork buttons that the
  production UI now renders as explicit package actions.

## Goal

Repair the release-gate tests narrowly, rerun release validation, build the
macOS arm64 app, and smoke the packaged artifact.

## Required UI

No product UI changes. Preserve existing Agent Forge install/fork controls.

## Required Data/API

- Preserve PI provider dependency-risk behavior.
- Keep public-untrusted PI runtime blocked unless risk is explicitly accepted.
- Keep package manifests and lockfiles unchanged.

## Required Automations

- `fetchBackendModels` PI dispatch test must set an explicit private/local risk
  mode and restore the process environment after the assertion.
- Agent Forge registry SSR test must assert the current install/fork controls
  and trust-boundary status copy.

## Required Subagents

No subagent required: this is a bounded release-gate repair.

## TDD Requirements

Before implementation:

1. Record the failing `bun run validate:release` evidence.
2. Run the focused failing Agent Forge test and record the red failure.

## Validation Commands

- `bun test apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx`
- `cd packages/shared && bun test src/agent/backend/__tests__/factory.test.ts`
- `bun run validate:release`
- `bun run electron:smoke`
- `bun run electron:dist:dev:mac:arm64`
- `bun run electron:smoke:packaged:mac`
- `bun run validate:packaged-artifacts`
- `git diff --check`
- `git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Focused Agent Forge registry test passes | DONE |
| Focused PI provider factory dispatch test passes | DONE |
| `validate:release` passes | DONE |
| Non-packaged Electron smoke passes | DONE |
| macOS arm64 Electron artifact is produced | DONE |
| Packaged Electron smoke passes | DONE |
| Packaged artifacts validator passes | DONE |
| Package manifests and lockfiles remain unchanged | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T115-release-validation-build-gate.md`.
