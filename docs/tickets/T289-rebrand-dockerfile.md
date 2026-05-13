# T289 - Rebrand Dockerfile and server packaging surfaces

Status: DONE

## Context

Phase R.7 of the ROX.ONE rebrand owns Docker and server-package build
surfaces that still expose legacy `rox-agent` / `roxagents` naming after
R.6 finished the env-var shim.

## Goal

Make the active server container and generated server package instructions use
ROX.ONE names:

- image tag examples use `rox-one-server`
- container user/group/home use `roxone` and `/home/roxone`
- runtime examples use `ROX_*` env vars
- stale package-copy references to removed `packages/rox-*` directories are
  removed

## Required UI

None.

## Required Data/API

No data schema changes.

## Required Automations

Update Docker smoke and server installer scripts so their operator output uses
the canonical ROX names.

## Required Subagents

None.

## TDD Requirements

Add a regression test covering `Dockerfile.server`, `.env.example`, and active
server packaging scripts before editing those files. Confirm it fails on the
current legacy strings.

## Implementation Requirements

Do not change the `org.opencontainers.image.source` label; it is legal-preserve
source attribution.

## Validation Commands

- `bun test scripts/__tests__/r7-docker-ci-build.test.ts`
- `bun run validate:rebrand` (expected red until later phases, but fewer findings)
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## Acceptance Criteria

- [x] Docker image examples use `rox-one-server`.
- [x] Docker runtime user/group/home use `roxone` and `/home/roxone`.
- [x] Docker smoke and install-server examples use `ROX_*`.
- [x] Removed Dockerfile references to nonexistent `packages/rox-*` dirs.
- [x] Legal-preserve source label remains unchanged.

## Worklog

Update `docs/worklog/T289-rebrand-dockerfile.md`.
