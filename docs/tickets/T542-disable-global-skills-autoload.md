# T542 - Disable global skills autoload for active sessions

Status: DONE

## Context

Operator machines can have thousands of globally installed skills under
`~/.agents/skills`. v1.0.3 session startup and skill UI paths still build an
active catalog with `loadAllSkills()`, which scans global, workspace, and
project skills. That makes a lightweight app session pay the cost of the full
global catalog even when the user did not ask to use those skills.

## Goal

Keep global skills available for explicit `[skill:...]` use, but do not
autoload or list them in the active session catalog.

## Required UI

- Session skill lists should show workspace/project active skills only.
- Explicit skill mentions should still resolve to their `SKILL.md` path.

## Required Data/API

- Add an active-catalog loader that excludes `~/.agents/skills`.
- Preserve `loadAllSkills()` for workflows that intentionally need the full
  three-tier inventory.
- Keep `loadSkillBySlug()` priority order: project, workspace, global.

## Required Automations

- Regression coverage for active catalog exclusion of global skills.
- Regression coverage for mention extraction without loading the full catalog.
- Regression coverage that explicitly mentioned skills still prepend a
  `SKILL.md` read directive.

## Validation Commands

- `bun test packages/shared/src/skills/__tests__/storage.test.ts`
- `bun test packages/shared/src/mentions/__tests__/resolve-skill-source-mentions.test.ts`
- `bun test packages/shared/src/agent/__tests__/base-agent.test.ts`
- `bun test packages/server-core/src/sessions/__tests__/skill-catalog-defer.test.ts`
- `bun run typecheck:all`

## Acceptance Criteria

- [x] Active session skill catalog excludes global skills.
- [x] Explicit skill mentions resolve via targeted slug lookup.
- [x] Tool badge metadata for Skill invocations avoids full global scans.
- [x] Targeted tests pass.
- [x] Rebuilt installed app passes packaged and UI smoke on this Mac.

## Worklog

Update `docs/worklog/T542-disable-global-skills-autoload.md`.
