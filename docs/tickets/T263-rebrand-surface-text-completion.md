# T263 - Rebrand surface text completion

Status: DONE

## Context

Phase R.1 finishes the remaining user-visible rebrand surface before deeper
identifier, asset, package, and env-var migrations begin.

## Goal

Replace active surface text and i18n keys that still encode legacy product
branding with canonical `ROX.ONE` naming while preserving locale parity.

## Required UI

- Electron top-bar menu aria label.
- Onboarding API setup provider label.
- Electron/WebUI HTML titles and application-name metadata.
- Playground messaging demo labels.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None for this bounded surface-text sweep.

## TDD Requirements

Before implementation:

1. Add a focused grep-style regression test for the R.1 surfaces.
2. Run it and confirm it fails on current stale keys/strings.

## Implementation Requirements

- Rename i18n key `menu.roxMenu` to `menu.appMenu` across locales and
  consumers.
- Rename i18n key `onboarding.apiSetup.roxAgentsBackend` to
  `onboarding.apiSetup.roxBackend` across locales and consumers.
- Replace in-scope `Rox Agents` / `Rox Agent` user-facing strings with
  `ROX.ONE` or `Agent Workbench Suite`.
- Replace `~/.rox-agent/logs/messaging-gateway.log` in automations docs with
  `~/.rox/logs/messaging-gateway.log`.
- Set Electron/WebUI HTML entrypoint titles and application-name meta to
  `ROX.ONE`.
- Replace playground messaging `Rox Agents` labels with `ROX.ONE`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-surface-text.test.ts`
- `bun test packages/shared/src/i18n/__tests__/locale-parity.test.ts`
- `bun run lint:i18n:parity`
- `bun run validate:rebrand` (expected to remain non-zero until later phases)
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `git diff --check`
- `bun test`
- `bun run build`
- `bun run electron:smoke` (environment-gated in this container)

## Acceptance Criteria

- [x] Surface-text regression test fails before implementation and passes after.
- [x] Locale key rename is complete across all locale files.
- [x] Locale consumers use the new keys.
- [x] README has no active body `Rox Agents` product prose.
- [x] Automations docs use `~/.rox/logs/messaging-gateway.log`.
- [x] HTML entrypoints use `ROX.ONE` title and application-name meta.
- [x] Playground messaging demos use `ROX.ONE`.
- [x] I18n parity passes.
- [x] Relevant validation passes or expected rebrand-gate findings are documented.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T263-rebrand-surface-text-completion.md`.
