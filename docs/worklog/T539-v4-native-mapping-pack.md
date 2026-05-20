# T539 V4 Native Mapping Pack

## 1. Task summary

Create a documentation-only mapping pack that turns the v4 ROX.ONE product prompt into concrete repository entrypoints, implementation strategy, and agent instructions.

## 2. Repo context discovered

- Current branch has unrelated runtime work in progress around artifacts, protocol channels, Electron main, AppShell, navigation, and session artifact storage. This task must not touch runtime code.
- `AGENTS.md` already points agents to local DeepWiki and Graphify artifacts.
- Local DeepWiki split pages are available under `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/artifacts/deepwiki-mcp/indexed-2026-05-20/pages/`.
- Local Graphify graph is available at `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/graphify-out/graph.json`.
- Existing kernel-adjacent surfaces include shared audit/RBAC, automation events, session JSONL, mission lifecycle, skills, sources, object storage, session notes, and session artifacts.

## 3. Files inspected

- `AGENTS.md`
- `docs/architecture/graphify-deepwiki-agent-workflow.md`
- `docs/tickets/T538-deepwiki-indexed-knowledge-workflow.md`
- DeepWiki pages: `04-core-architecture.md`, `08-session-manager-persistence.md`, `12-app-shell-chat-ui.md`, `18-rbac-security.md`, `24-workspace-bundles-skill-marketplace.md`, `34-testing-infrastructure.md`, `37-validation-scripts-agent-contract.md`
- `packages/shared/src/audit/audit-event-store.ts`
- `packages/shared/src/audit/audit-event-writer.ts`
- `packages/shared/src/auth/policy-engine.ts`
- `packages/shared/src/automations/types.ts`
- `packages/shared/src/sessions/types.ts`
- `packages/shared/src/sessions/jsonl.ts`
- `packages/shared/src/sessions/artifacts.ts`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/experience-state.ts`
- `packages/shared/src/workbench/mission-lifecycle.ts`
- `packages/shared/src/workbench/tdd-task-generator.ts`
- `packages/shared/src/workbench/markdown-entity-graph.ts`
- `packages/shared/src/sources/types.ts`
- `packages/server-core/src/handlers/rpc/sessions.ts`
- `packages/server-core/src/handlers/rpc/skills.ts`
- `packages/server-core/src/handlers/rpc/artifacts.ts`
- `apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- `apps/electron/src/renderer/components/app-shell/SessionList.tsx`
- `apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx`
- `apps/electron/src/renderer/components/app-shell/SourcesListPanel.tsx`
- `apps/electron/src/renderer/components/app-shell/SkillsListPanel.tsx`

## 4. Tests added first

This task is documentation-only. The validation checks are architecture/docs validators and diff hygiene.

## 5. Expected failing test output

Not applicable for runtime tests. If documentation violates repository docs contracts, `bun run validate:architecture-docs` or `bun run validate:docs` should fail.

## 6. Implementation changes

- Added `docs/architecture/ROX_ONE_V4_NATIVE_MAPPING.md`.
- Added `docs/architecture/ROX_ONE_V4_AGENT_WORKFLOW.md`.
- Added `docs/architecture/ROX_ONE_V4_EXECUTION_GOALS.md`.
- Added `docs/tickets/T539-v4-native-mapping-pack.md`.
- Added `docs/tickets/T540-answer-package-schema.md` so the runtime schema slice can be tracked independently.
- Added `docs/worklog/T540-answer-package-schema.md`.
- Fixed `docs/tickets/T538-deepwiki-indexed-knowledge-workflow.md` to use the repository-required `Status: DONE` line so `validate:agent-contract` can pass.

## 7. Validation commands run

- `bun run validate:architecture-docs`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`

## 8. Passing test output summary

- `bun run validate:architecture-docs` -> `[architecture-docs] ok: 4 docs, 10 subsystem headings`
- `bun run validate:agent-contract` -> `[agent-contract] ok: 11 skills, 501 tickets, 7 required docs`
- `bun run validate:docs` -> agent contract, architecture docs, and sync-v2 design validation passed.
- `git diff --check` -> pass.

## 9. Build output summary

Not applicable unless documentation validation requires a build. No runtime code is in scope.

## 10. Remaining risks

- The current working tree is dirty with unrelated runtime changes; this task must remain docs-only.
- DeepWiki and Graphify are generated navigation aids and may drift from the current branch.
- Upstream comparison is intentionally secondary and does not settle all fork/rewrite history questions.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Native mapping doc exists | Passed | `docs/architecture/ROX_ONE_V4_NATIVE_MAPPING.md` |
| Agent workflow doc exists | Passed | `docs/architecture/ROX_ONE_V4_AGENT_WORKFLOW.md` |
| Execution goals doc exists | Passed | `docs/architecture/ROX_ONE_V4_EXECUTION_GOALS.md` |
| DeepWiki/Graphify proof boundary documented | Passed | Mapping/workflow docs |
| Always-on memory kill-list documented | Passed | Mapping/execution docs |
| Validation passes | Passed | Command output above |
