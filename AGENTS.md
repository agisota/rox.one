# Agent Workbench Fork - Codex Operating Contract

You are Codex CLI working on **ROX.ONE Agent Workbench Suite**, the white-label ROX.ONE fork descended from upstream Craft Agents OSS (Apache 2.0; attribution preserved in `LICENSE`, `NOTICE`, `TRADEMARK.md`, and the `Dockerfile.server` source label).

## Absolute Rules

1. Work task-by-task from `docs/tickets/*.md`.
2. Never implement feature code before writing the relevant tests or validation checks.
3. Before tests, inspect the relevant repo area and summarize context in `docs/worklog/<TASK>.md`.
4. Use explorer subagents when the task touches unknown repo areas and parallel discovery materially improves correctness.
5. Every feature must include the relevant coverage shape: unit tests, integration tests, UI/component tests, E2E/smoke tests, and security/RBAC/quota tests where applicable.
6. A task is not complete until relevant checks pass or a precise blocker is documented in the worklog.
7. Do not silently skip tests. If a test cannot be written, explain why in the worklog and add a manual verification checklist.
8. Prefer small, composable modules over large god-components.
9. Preserve existing ROX.ONE Agent Workbench Suite behavior unless the task explicitly changes it.
10. Avoid adding production dependencies unless the task justifies license, security risk, runtime impact, and test plan.

## Required Worklog Format

For every task create/update `docs/worklog/<TASK>.md` with:

1. Task summary
2. Repo context discovered
3. Files inspected
4. Tests added first
5. Expected failing test output
6. Implementation changes
7. Validation commands run
8. Passing test output summary
9. Build output summary
10. Remaining risks
11. Acceptance criteria matrix

## TDD Loop

1. Inspect repo context.
2. Write tests or validation checks.
3. Run tests and confirm failure for the expected reason.
4. Implement the minimal change.
5. Run targeted tests.
6. Run full relevant validation for the changed surface.
7. Run build when source/runtime behavior changed.
8. Update worklog.
9. Commit with the repository Lore commit protocol.

## Subagent Usage

When task touches uncertain code paths, explicitly spawn read-only explorer subagents only when it improves throughput or correctness:

- UI explorer
- backend/server explorer
- config/workspace explorer
- skill/automation explorer
- data/storage explorer
- test harness explorer
- security/RBAC explorer

Explorer output must include relevant files, existing patterns, risks, recommended tests, and integration points.

## Definition of Done

A task is DONE only when:

- tests or validation checks pass
- build passes when applicable
- acceptance matrix is green or blockers are explicit
- worklog is complete
- commit exists for the task
- unrelated runtime files are not mixed into the task commit
