# Graphify and DeepWiki Agent Workflow

This document defines how agents should use the local Graphify artifacts, indexed DeepWiki results, direct source inspection, tickets/worklogs, and validation commands when working on ROX.ONE.

## Current Knowledge Surfaces

### Local Graphify Workspace

- Workspace: `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source`
- Source repo: `https://github.com/agisota/rox.one`
- Captured branch/commit: `main` at `80caa0f97db1db1fb6719a0a65e544927cc9b3a6`
- Full graph: `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/graphify-out/graph.json`
- Clustered report: `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/graphify-out/GRAPH_REPORT.md`
- Static UI: `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/artifacts/graphify-tree.html`
- Saved query captures: `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/artifacts/graphify-queries/`

Graphify is local structural evidence. Use it to answer where code lives, which files are related, which modules are highly connected, and which source files should be inspected first.

### Indexed DeepWiki Results

- Public wiki: `https://deepwiki.com/agisota/rox.one`
- Public MCP endpoint: `https://mcp.deepwiki.com/mcp`
- Local indexed results root: `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/artifacts/deepwiki-mcp/indexed-2026-05-20/`
- Structure: `deepwiki-structure.md`
- Full contents: `deepwiki-contents.md`
- Split pages: `pages/*.md`
- Saved agent Q&A: `questions/*.md`
- Raw MCP captures: `/home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source/artifacts/deepwiki-mcp/*indexed.sse.txt`

DeepWiki is now indexed for `agisota/rox.one`. Use it for broad orientation, generated documentation, topic navigation, and initial Q&A. Do not treat it as proof of current behavior; verify claims against source files and tests.

## DeepWiki Page Map

Start with these local split pages instead of rereading the full 700 KB dump:

| Area | Local DeepWiki pages |
| --- | --- |
| Overview and setup | `pages/01-rox-one-overview.md`, `pages/02-getting-started.md`, `pages/03-repository-structure.md` |
| Core architecture | `pages/04-core-architecture.md`, `pages/05-agent-backends.md`, `pages/06-workbench-mission-system.md`, `pages/07-rpc-ipc-protocol.md` |
| Sessions and storage | `pages/08-session-manager-persistence.md`, `pages/09-configuration-storage-scopes.md` |
| Electron UI | `pages/10-electron-desktop-application.md`, `pages/11-main-process-window-management.md`, `pages/12-app-shell-chat-ui.md`, `pages/13-workbench-ui-screens.md`, `pages/14-settings-account-ui.md` |
| Build/update | `pages/15-auto-update-build-pipeline.md`, `pages/26-ci-cd-release-pipeline.md`, `pages/27-github-actions-workflows.md`, `pages/28-artifact-validation-sbom.md`, `pages/29-release-feed-distribution.md`, `pages/30-e2e-smoke-rc-validation.md` |
| Server/backend | `pages/16-server-backend-services.md`, `pages/17-account-authentication.md`, `pages/20-llm-connections-provider-gateway.md`, `pages/21-automations-messaging-gateway.md`, `pages/22-workspace-sync.md` |
| Security | `pages/18-rbac-security.md`, `pages/19-audit-trail-observability.md`, `pages/31-security-credentials.md`, `pages/32-credential-management-tenant-key-derivation.md`, `pages/33-supply-chain-dependency-security.md` |
| Skills/tools | `pages/23-skills-workspaces-bundles.md`, `pages/24-workspace-bundles-skill-marketplace.md`, `pages/25-session-tools-core-transform-data.md`, `pages/47-agent-skills-swarm-configuration.md`, `pages/48-built-in-agent-skills.md` |
| Tests/validation | `pages/34-testing-infrastructure.md`, `pages/35-unit-component-tests.md`, `pages/36-audit-package-static-probes.md`, `pages/37-validation-scripts-agent-contract.md` |
| Rebrand/governance | `pages/38-rebrand-sweep-r-0-r-11.md`, `pages/39-r-11-history-rewrite.md`, `pages/40-rebrand-validation-gates.md`, `pages/49-swarm-roadmap-governance.md` |
| UI library/i18n/a11y | `pages/41-ui-component-library.md`, `pages/42-markdown-code-rendering.md`, `pages/43-overlays-rich-input.md`, `pages/44-internationalization-i18n.md`, `pages/45-locale-files-feature-map.md`, `pages/46-branding-localization-tests.md`, `pages/50-accessibility-a11y.md`, `pages/51-keyboard-navigation-specs.md`, `pages/52-accessibility-testing.md` |
| Terms | `pages/53-glossary.md` |

## Saved DeepWiki Questions

Use the saved question captures before asking DeepWiki the same broad questions again:

- `questions/agent-codebase-workflow.md`
- `questions/architecture-entrypoints.md`
- `questions/debugging-playbook.md`
- `questions/security-validation.md`
- `questions/graphify-deepwiki-source-contract.md`

These files are useful for prompt seeding, but they are not authoritative. Some generated answers may omit exact path text where DeepWiki had citations. Always confirm against source.

## Graphify UI and Deployment

Graphify does not need a running app server. It produces local files.

Open the current static UI:

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

Deploy it as static files by copying `artifacts/graphify-tree.html`, `graphify-out/graph.json`, and `graphify-out/GRAPH_REPORT.md` to an internal static host. Do not publish private graph contents unless the repository contents are intentionally public.

## How To Ask Codebase Questions

Classify the question before choosing a tool:

- **Location**: where is a feature or symbol implemented?
- **Relationship**: how does one subsystem connect to another?
- **Behavior**: what happens at runtime?
- **Impact**: what changes if a file or API moves?
- **Debugging**: why does a command, UI path, or test fail?
- **Refactor**: how can a high-degree file be split without behavior change?
- **Validation**: which checks prove the answer?

Use this order:

1. DeepWiki for broad orientation and page/topic map.
2. Graphify for structural relationships and likely source files.
3. Direct source inspection for exact implementation.
4. Tickets/worklogs/decision docs for intent and prior constraints.
5. Tests, typecheck, lint, build, or smoke checks for proof.

Do not answer non-trivial implementation questions from DeepWiki alone.

## Graphify Commands

Use `query` for discovery:

```bash
cd /home/dev/craft/rox-one-graphify-deepwiki-2026-05-20/source
graphify query "Where is session rename implemented and what server APIs does it touch?" --graph graphify-out/graph.json --budget 3000
graphify query "How does MCP source authentication flow through renderer, server-core, and shared agent runtime?" --graph graphify-out/graph.json --budget 4000
graphify query "Which files are relevant to skills marketplace install and send-to-workspace behavior?" --graph graphify-out/graph.json --budget 4000
```

Use `explain` for known labels:

```bash
graphify explain "SessionManager.ts" --graph graphify-out/graph.json
graphify explain "SessionList.tsx" --graph graphify-out/graph.json
graphify explain "SkillsListPanel.tsx" --graph graphify-out/graph.json
graphify explain "sources.ts" --graph graphify-out/graph.json
```

Use `path` for relationships:

```bash
graphify path "SessionList.tsx" "SessionManager.ts" --graph graphify-out/graph.json
graphify path "sources.ts" "base-agent.ts" --graph graphify-out/graph.json
graphify path "SkillsListPanel.tsx" "packages/shared/src/skills" --graph graphify-out/graph.json
```

## DeepWiki MCP Commands

Use MCP when the local dump is stale or when you need a fresh generated answer:

```bash
curl -sS https://mcp.deepwiki.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_wiki_structure","arguments":{"repoName":"agisota/rox.one"}}}'
```

```bash
curl -sS https://mcp.deepwiki.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"read_wiki_contents","arguments":{"repoName":"agisota/rox.one"}}}'
```

For questions:

```bash
curl -sS https://mcp.deepwiki.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"ask_question","arguments":{"repoName":"agisota/rox.one","question":"Which files should I inspect before changing session persistence?"}}}'
```

Save useful new answers under `artifacts/deepwiki-mcp/indexed-2026-05-20/questions/`.

## Source Verification Protocol

For every non-trivial answer:

1. State the claim.
2. List the evidence layer: DeepWiki page, Graphify command/output, source file, ticket/worklog, test.
3. Open the cited source files in the current working checkout.
4. Confirm whether the evidence proves behavior or only naming proximity.
5. Run the smallest check that proves the claim.
6. Record the command and result in the task worklog.

DeepWiki and Graphify are navigation tools. Current source and validation are the final proof.

## Debugging Protocol

1. Capture the exact failing command and error text.
2. Read the relevant DeepWiki page for subsystem orientation.
3. Use Graphify to find likely owning files and callers.
4. Use `rg` for exact symbols, error strings, test names, or config keys.
5. Read the directly involved source and tests.
6. Form a concrete hypothesis.
7. Run or add the smallest failing check.
8. Fix the narrow cause.
9. Rerun the failing check.
10. Run broader checks if the touched module is shared.
11. Refresh Graphify if code structure changed.

## Refactor Protocol

1. Read the DeepWiki page for the subsystem.
2. Run `graphify explain` on the target file.
3. Identify imports, callers, high-degree nodes, and test surfaces.
4. Add missing regression tests first.
5. Prefer compatibility facades over breaking import paths.
6. Split one responsibility at a time.
7. Run targeted tests after each extraction.
8. Run typecheck and broader validation when shared APIs moved.
9. Run `graphify update .` or a narrower path after structural changes.

For high-degree files such as `SessionManager.ts`, do not do broad rewrites. Extract collaborators behind stable exports.

## Search Escalation Ladder

Use the smallest search surface that can answer the question:

1. Local DeepWiki split page for the subsystem.
2. Saved DeepWiki `questions/*.md` captures.
3. Saved Graphify query outputs in `artifacts/graphify-queries/`.
4. `graphify explain` for known file/symbol labels.
5. `graphify query` for concept discovery.
6. `graphify path` for subsystem relationships.
7. `rg` in current source for exact strings and symbols.
8. Direct file reads around cited lines.
9. Fresh DeepWiki MCP `ask_question` only when the local dump is insufficient.
10. Web/docs only for external APIs or current service behavior.

## Validation Ladder

Choose validation by blast radius:

- Documentation/config only: JSON parse, path existence, grep anchor checks.
- UI component behavior: component/unit tests, renderer typecheck, targeted smoke when needed.
- Server-core behavior: focused tests in `packages/server-core`, then package typecheck.
- Shared agent/MCP behavior: shared tests, source-manager/pre-tool-use/prerequisite tests, integration checks where relevant.
- Build/release behavior: scripts under `scripts/validate-*`, bundle budget, packaged artifact checks, platform-specific gates.
- Security/RBAC/credentials: property tests, integrity/audit tests, RPC e2e tests, workflow-pin checks.
- Cross-cutting change: `bun run typecheck:all`, lint/static checks, relevant smoke/build.

Always report what was not run.

## Agent Output Contract

When answering codebase questions, use this shape:

```markdown
## Answer
[Direct answer.]

## Evidence
- DeepWiki: [local page or saved question]
- Graphify: [command or saved file]
- Source: [file:line]
- Tests/docs: [ticket/worklog/test]

## Confidence
[High/medium/low and why.]

## Next action
[Concrete command or file to inspect/change.]
```

When implementing, put the same evidence in the worklog.

## Freshness Rules

- DeepWiki indexed dump was saved on 2026-05-20.
- Graphify graph is tied to commit `80caa0f97db1db1fb6719a0a65e544927cc9b3a6`.
- If `origin/main` moves materially, refresh the clean graph workspace and rerun DeepWiki MCP captures.
- If local code changes, refresh Graphify on the changed path.
- If DeepWiki answers contradict current source, current source wins.
