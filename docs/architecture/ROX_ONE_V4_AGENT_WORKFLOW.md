# ROX.ONE V4 Agent Workflow

This is the operating guide for agents implementing the v4 ROX.ONE kernel and experience roadmap.

## Required sequence

For non-trivial ROX.ONE work:

1. Read the relevant ticket and worklog.
2. Read `docs/architecture/graphify-deepwiki-agent-workflow.md`.
3. Read one or more local DeepWiki split pages for subsystem orientation.
4. Run targeted Graphify commands against known files or symbols.
5. Inspect current source with `rg` and direct file reads.
6. Write tests or validation checks first.
7. Implement the narrow change.
8. Run targeted checks, then broader checks for shared surfaces.
9. Update the worklog with evidence and remaining risks.

## DeepWiki usage

DeepWiki answers broad questions:

- What is the documented architecture?
- Which subsystem likely owns this feature?
- Which pages should I read before touching this area?

Start with local pages:

```text
/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/artifacts/deepwiki-mcp/indexed-2026-05-20/pages/
```

Recommended pages for v4 work:

| Area | Pages |
| --- | --- |
| Core architecture | `04-core-architecture.md`, `07-rpc-ipc-protocol.md` |
| Sessions | `08-session-manager-persistence.md` |
| UI shell | `12-app-shell-chat-ui.md`, `13-workbench-ui-screens.md` |
| Security | `18-rbac-security.md`, `19-audit-trail-observability.md`, `31-security-credentials.md` |
| Skills/sources | `23-skills-workspaces-bundles.md`, `24-workspace-bundles-skill-marketplace.md`, `25-session-tools-core-transform-data.md` |
| Validation | `34-testing-infrastructure.md`, `37-validation-scripts-agent-contract.md` |

Use saved questions before asking DeepWiki again:

```text
/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/artifacts/deepwiki-mcp/indexed-2026-05-20/questions/
```

## Graphify usage

Graphify answers local source relationship questions:

- Which files are structurally connected?
- What imports or contains a given symbol?
- How does a UI surface connect to a server handler?
- Which files should be inspected before a refactor?

Use the saved graph:

```bash
GRAPH=/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/graphify-out/graph.json
```

Use concrete symbols:

```bash
graphify explain "SessionManager.ts" --graph "$GRAPH" --budget 3000
graphify explain "AppShell.tsx" --graph "$GRAPH" --budget 3000
graphify explain "mission-lifecycle.ts" --graph "$GRAPH" --budget 3000
graphify query "AuditEventRecord roles policy-engine RBAC" --graph "$GRAPH" --budget 4000
graphify query "AgentEvent AppEvent PermissionRequest automations event-bus" --graph "$GRAPH" --budget 4000
graphify query "KnownProvider SourceType Gmail Calendar Drive Slack Notion Linear source credential OAuth" --graph "$GRAPH" --budget 4000
```

Avoid broad abstract prompts such as `Trust Event Memory Context Execution`. Those can produce noisy graph traversals. Prefer known files and symbols, then inspect source directly.

## Static Graphify UI

The current Graphify output is a local static artifact, not a running product service.

Open it locally:

```bash
xdg-open /home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/artifacts/graphify-tree.html
```

Serve it locally:

```bash
cd /home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/artifacts/graphify-tree.html
```

Only deploy the static files to a private/internal host unless repo graph content is intended to be public.

## Source inspection checklist

Use `rg` first:

```bash
rg -n "AgentAnswerPackage|AuditEventRecord|PermissionRequest|GET_NOTES|artifacts|MissionRun" packages apps docs
```

Then read the owning files:

- Shared schema or pure model: `packages/shared/src/**`
- Server RPC/runtime: `packages/server-core/src/**`
- Electron UI: `apps/electron/src/renderer/**`
- Main/preload/IPC: `apps/electron/src/main/**`, `apps/electron/src/transport/**`, `apps/electron/src/shared/**`
- Tickets/worklogs: `docs/tickets/*.md`, `docs/worklog/*.md`

## Implementation rules for v4 work

- Add tests before feature code.
- Keep schema/helper work in shared modules when possible.
- Do not add a new storage engine until object semantics and retention policy are stable.
- Do not make chat, whiteboard, mindmap, kanban, or feed the source of truth.
- Treat them as projections over events, objects, links, files, permissions, and artifacts.
- Do not introduce always-on capture before explicit consent, redaction, retention, and audit.
- Avoid broad rewrites of high-degree files such as `SessionManager.ts` and `AppShell.tsx`.
- Prefer compatibility facades and small modules.
- After structural code changes, refresh Graphify with a narrow update when possible.

## Validation ladder

Use the smallest proof that covers the touched surface:

| Surface | Minimum validation |
| --- | --- |
| docs-only | `bun run validate:architecture-docs`, `bun run validate:docs`, `git diff --check` |
| shared pure schema | targeted `bun test`, `bun run typecheck:shared`, `git diff --check` |
| session storage/artifacts | targeted session/artifact tests, server-core RPC tests, shared typecheck |
| RPC/protocol channels | channel tests, routing tests, typecheck all |
| renderer UI | targeted RTL/Vitest, accessibility where relevant, renderer typecheck |
| security/RBAC/audit | unit tests, RBAC/property tests, relevant server-core tests |
| release-sensitive changes | `bun run validate:ci`, `bun run rc:preflight` only when scope warrants |

## Worklog evidence format

Every v4 implementation worklog must include:

- DeepWiki pages read.
- Graphify commands run and what they proved.
- Source files inspected.
- Tests added first.
- Expected failure before implementation.
- Implementation summary.
- Validation commands and pass/fail output.
- Remaining risks and explicit non-goals.

## First agent prompt template

```text
Implement <ticket-id> in ROX.ONE.

Constraints:
- Follow AGENTS.md.
- Read docs/architecture/ROX_ONE_V4_NATIVE_MAPPING.md and docs/architecture/ROX_ONE_V4_AGENT_WORKFLOW.md first.
- Use local DeepWiki and Graphify for orientation, but prove behavior from source and tests.
- Do not touch unrelated dirty files.
- Write or update docs/worklog/<ticket-id>.md with all 11 required sections.
- Add tests before implementation when runtime code changes.
- Run the validation commands named in the ticket.
```
