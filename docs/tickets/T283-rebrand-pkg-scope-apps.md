# T283 - Rebrand app package scopes

Status: DONE

## Context

Phase R.5.11 is the final package-scope app group after all shared/runtime
workspace packages have moved from `@craft-agent/*` to `@rox-one/*`.
The remaining app package names are `@craft-agent/cli`,
`@craft-agent/electron`, `@craft-agent/viewer`, and `@craft-agent/webui`.

## Goal

Rename the active app package identities to `@rox-one/cli`,
`@rox-one/electron`, `@rox-one/viewer`, and `@rox-one/webui`, including
package metadata, app package references, and `bun.lock`.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None required. Use direct repository search because this is a bounded package
metadata and lockfile rename.

## TDD Requirements

Extend the R.5 package-scope regression test before implementation and confirm
it fails on the current legacy app package names.

## Implementation Requirements

- Rename app `package.json` `name` fields:
  - `apps/cli/package.json` to `@rox-one/cli`.
  - `apps/electron/package.json` to `@rox-one/electron`.
  - `apps/viewer/package.json` to `@rox-one/viewer`.
  - `apps/webui/package.json` to `@rox-one/webui`.
- Rename active exact app package references in `bun.lock` and active source or
  script text.
- Refresh `bun.lock` with `bun install`.
- Do not rename generic bare `craft-agent` ESLint plugin identifiers, CLI
  command names, env vars, config dirs, or historical docs in this ticket;
  later rebrand phases own those tokens.

## Validation Commands

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun install`
- `bun install --frozen-lockfile`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun run validate:rebrand` (expected red until later rebrand phases)

## Acceptance Criteria

- [x] Ticket exists before code changes.
- [x] Red test proves the app package-scope gap.
- [x] App package metadata uses `@rox-one/<app>`.
- [x] Active exact app package references use `@rox-one/<app>`.
- [x] Lockfile is refreshed.
- [x] Full suite passes after commit.
- [x] Build passes.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete after post-commit evidence is recorded.
- [x] Commit created.

## Worklog

Update `docs/worklog/T283-rebrand-pkg-scope-apps.md`.
