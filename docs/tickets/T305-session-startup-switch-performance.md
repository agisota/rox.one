# T305 - Session startup and switch performance

Status: DONE

## Context

ROX ONE Terminal currently stalls on startup/session selection and becomes heavy when switching across sessions. Live baseline from the active workstation shows `SKILLS_GET` loading ~10k global skills and taking multiple seconds when the active session working directory changes.

Measured baseline before this task:

- `listSessions()` over 1000 synthetic sessions: ~125ms.
- `loadAllSkills(workspaceRoot, projectRoot)` with 10,148 skills: first project ~4.2s, another project ~0.9s, same project cache ~0ms.
- Renderer `AppShell` reloads skills on `[activeWorkspaceId, activeSessionWorkingDirectory]`, so switching sessions with different working directories can trigger the expensive path.

## Goal

Reduce the expensive backend work caused by session startup/switching without changing skill precedence or user-visible behavior.

## Scope

- Keep skill priority exactly: global < workspace < project.
- Avoid reparsing global/workspace skills when only `projectRoot` changes.
- Preserve `invalidateSkillsCache()` as the safety invalidation surface.
- Do not mix unrelated `.agents/**` or `.omc/**` changes into this task.

## TDD Requirements

1. Add a regression test proving reusable lower-priority skill tiers are not reparsed on project-root changes.
2. Confirm the test fails before implementation.
3. Implement the smallest cache refactor needed to pass.
4. Re-run targeted tests and a local performance benchmark.

## Validation Commands

- `bun test packages/shared/src/skills/__tests__/storage.test.ts`
- `bun run typecheck:shared`
- Synthetic benchmark for `loadAllSkills()` across two project roots.

## Acceptance Criteria

- [x] Switching project roots reuses cached global/workspace skill tiers.
- [x] Skill precedence remains global < workspace < project.
- [x] `invalidateSkillsCache()` clears all relevant skill caches.
- [x] Targeted skill storage tests pass.
- [x] Shared typecheck passes.
- [x] Benchmark shows cross-project skill load no longer reparses ~10k global skills.
- [x] Worklog complete.
