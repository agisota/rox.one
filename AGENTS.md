# Agent Workbench Fork - Codex Operating Contract

You are Codex CLI working on **ROX.ONE Agent Workbench Suite**, the white-label ROX.ONE fork descended from upstream Rox Agents OSS (Apache 2.0; attribution preserved in `LICENSE`, `NOTICE`, `TRADEMARK.md`, and the `Dockerfile.server` source label).

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

## Graphify and DeepWiki Knowledge Workflow

Use the local Graphify and indexed DeepWiki artifacts before broad source browsing when a task needs architecture discovery, dependency tracing, refactor planning, debugging, MCP/source integration work, session/shell behavior, skills marketplace work, artifact UX, UI surface mapping, validation planning, or release/security context.

Canonical references:

- Detailed agent playbook: `docs/architecture/graphify-deepwiki-agent-workflow.md`
- DeepWiki steering config: `.devin/wiki.json`
- Artifact workspace: `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source`
- Artifact index: `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/artifacts/README.md`
- Graphify graph: `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/graphify-out/graph.json`
- Graphify report: `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/graphify-out/GRAPH_REPORT.md`
- Graphify static UI: `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/artifacts/graphify-tree.html`
- DeepWiki indexed results: `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/artifacts/deepwiki-mcp/indexed-2026-05-20/`
- DeepWiki split pages: `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/artifacts/deepwiki-mcp/indexed-2026-05-20/pages/`
- DeepWiki saved Q&A: `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/artifacts/deepwiki-mcp/indexed-2026-05-20/questions/`
- Public DeepWiki: `https://deepwiki.com/agisota/rox.one`
- Public DeepWiki MCP endpoint: `https://mcp.deepwiki.com/mcp`

Before non-trivial codebase Q&A, debugging, refactor planning, or feature implementation, read `docs/architecture/graphify-deepwiki-agent-workflow.md` and follow its search, verification, debugging, refactor, and validation ladders.

Use DeepWiki for broad orientation:

1. Start with the local split page for the subsystem, not the full dump.
2. Use saved `questions/*.md` captures before asking the same broad MCP question again.
3. Use fresh `ask_question` only when local DeepWiki pages are insufficient or stale.
4. Treat DeepWiki as generated documentation, not proof. Verify all path-level and behavior claims against current source.

Use Graphify for local source relationships:

1. Use `graphify query` to identify likely files, symbols, and relationships.
2. Use `graphify explain` for known graph labels such as `SessionManager.ts`, `SessionList.tsx`, `SkillsListPanel.tsx`, or `sources.ts`.
3. Use `graphify path "A" "B"` when the task asks how two subsystems connect.
4. Use `GRAPH_REPORT.md` for broad architecture review only; prefer targeted query/explain/path commands first.
5. After code changes, refresh the graph with `graphify update .` or a narrower path such as `graphify update packages/server-core/src`.

Decision rule:

- DeepWiki answers “what is the documented architecture/topic map?”
- Graphify answers “which files and symbols are structurally connected?”
- Source inspection answers “what does the current code actually do?”
- Tests/build/static checks answer “is the claim or change proven?”

## Definition of Done

A task is DONE only when:

- tests or validation checks pass
- build passes when applicable
- acceptance matrix is green or blockers are explicit
- worklog is complete
- commit exists for the task
- unrelated runtime files are not mixed into the task commit
