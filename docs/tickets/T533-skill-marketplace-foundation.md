# T533 - Bundled skill marketplace foundation

Status: DONE

## Context

The active goal asks for a built-in skill marketplace, more starter skills, and
ready-to-use agent/automation templates. New workspaces already receive a
default Agent Workbench bundle with 10 skills and MCP source presets, so the
next small slice is to expand the starter skill shelf and expose a shared
marketplace catalog that UI/API layers can consume later.

Prior install evidence also showed that some external ZED catalog slugs can be
account-limited with `Skill not found or unavailable to this account.`, so this
slice must expose installability honestly instead of promising every external
catalog entry can be installed locally.

## Goal

Expand the default workspace skill bundle to 20 starter templates and add a
shared skill marketplace catalog with install-state overlays for installed,
available, and account-limited entries.

## Required UI

- No new UI in this slice.
- Future UI can read shared catalog entries, status labels, and availability
  notes directly from the shared module.

## Required Data/API

- Default workspace bundle includes 20 curated starter skills.
- Shared marketplace catalog includes all bundled starter skills.
- Catalog entries include category, origin, source label, installability, and
  availability notes where applicable.
- Catalog overlays installed state from loaded workspace/global/project skills.
- Install helper writes bundled marketplace skills without overwriting existing
  user skills.

## Required Automations

- None in this slice.

## Required Subagents

No subagents required; this is a bounded shared-module implementation.

## TDD Requirements

Before implementation:

1. Update bundle tests to require 20 default starter skills.
2. Add marketplace tests for catalog coverage and installed-state overlay.
3. Add marketplace install-helper tests for non-overwrite behavior.
4. Run targeted tests and confirm expected failures.

## Implementation Requirements

Implement minimal shared code required to pass tests. Do not add UI, remote
marketplace fetching, or production dependencies.

## Validation Commands

- `bun test packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts`
- `bun test packages/shared/src/skills/__tests__/marketplace.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `git diff --check`

## Acceptance Criteria

- [ ] New workspaces seed 20 starter skills.
- [ ] Marketplace catalog includes all bundled starter skills.
- [ ] Marketplace catalog marks installed bundled skills after bundle install.
- [ ] Account-limited external catalog entries carry the exact availability
      diagnostic.
- [ ] Marketplace install helper does not overwrite user-edited skills.
- [ ] Tests pass.
- [ ] Build passes when applicable.
- [ ] Worklog complete.
- [ ] Commit created.

## Worklog

Update `docs/worklog/T533-skill-marketplace-foundation.md`.
