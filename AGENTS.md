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
- Public DeepWiki: `https://deepwiki.com/agisota/rox.one`
- Public DeepWiki MCP endpoint: `https://mcp.deepwiki.com/mcp`

**Local graphify artifacts** (per-contributor — set `$ROX_GRAPHIFY_ROOT` to your local checkout root, default unset):

- Artifact workspace: `$ROX_GRAPHIFY_ROOT/source`
- Artifact index: `$ROX_GRAPHIFY_ROOT/source/artifacts/README.md`
- Graphify graph: `$ROX_GRAPHIFY_ROOT/source/graphify-out/graph.json`
- Graphify report: `$ROX_GRAPHIFY_ROOT/source/graphify-out/GRAPH_REPORT.md`
- Graphify static UI: `$ROX_GRAPHIFY_ROOT/source/artifacts/graphify-tree.html`
- DeepWiki indexed results: `$ROX_GRAPHIFY_ROOT/source/artifacts/deepwiki-mcp/indexed-<DATE>/`
- DeepWiki split pages: `$ROX_GRAPHIFY_ROOT/source/artifacts/deepwiki-mcp/indexed-<DATE>/pages/`
- DeepWiki saved Q&A: `$ROX_GRAPHIFY_ROOT/source/artifacts/deepwiki-mcp/indexed-<DATE>/questions/`

Set `ROX_GRAPHIFY_ROOT=/path/to/your/local/graphify-checkout` in your shell environment if you maintain a local graphify mirror. If unset, fall back to the public DeepWiki link above. New contributors do not need to set this — it's an optional local cache.

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
5. After code changes, refresh the graph with the narrowest changed source path, such as `graphify update packages/server-core/src` or `graphify update packages/shared/src/workbench --no-cluster`. Do not run full-root `graphify update .` unless the task explicitly requires a repo-wide refresh and generated/runtime folders have been excluded. If a refresh starts scanning hundreds of thousands of files, stop it, remove partial cache-only output, and record the scoped-refresh blocker instead of committing incomplete `graphify-out` artifacts.

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

## Parallel Worktree Harness (v2 cycle, 2026-05-21)

ROX.ONE v2 ships through a 40-worktree parallel harness. Each WT owns a strict
file allowlist (`wt-meta/wt-XX.yaml › files_allowed`) and a forbid-list. Shared
scaffolds (root `package.json`, `tsconfig.json`, `AGENTS.md`, CI workflows,
cross-cutting registries) are owned by a single WT — usually WT-00 for repo
config and WT-09 for server core. Siblings request changes via the
`scaffold_requests:` block in their own yaml; the owner batches them in.

Authoritative references:

- Master spec: `docs/superpowers/specs/2026-05-21-rox-one-parallel-worktree-harness-master.md`
- Ownership map: `wt-meta/scaffold-ownership.yaml`
- Release cuts: `wt-meta/release-cuts.yaml`
- Snapshot validator: `scripts/orchestrator/snapshot-verify.ts`
- CODEOWNERS: `.github/CODEOWNERS`

Before opening a PR from a WT branch:

1. Confirm every changed file is in `files_allowed` (or owned by you).
2. Run `bun run scripts/orchestrator/snapshot-verify.ts --json` and attach
   the report to the PR description.
3. List unresolved scaffold-extension requests in the PR body so the owner WT
   can batch them.
