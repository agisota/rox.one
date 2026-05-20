# ROX.ONE V4 Native Mapping

This document maps the v4 product thesis to the current ROX.ONE codebase. It is an implementation guide, not a product manifesto.

## Evidence model

Use evidence in this order:

1. Current source files in this checkout.
2. Local DeepWiki pages for broad architecture orientation.
3. Local Graphify output for structural relationships and high-degree files.
4. Tickets, worklogs, decision docs, and validation scripts.
5. Upstream comparison against `craft-ai-agents/craft-agents-oss` as secondary historical context.

DeepWiki and Graphify are navigation aids. They are not proof of runtime behavior. Source inspection and tests are proof.

## Core thesis

ROX.ONE should converge on this kernel order:

```text
Trust -> Event/Object -> Memory -> Vector/Graph -> Context -> Execution -> Experience
```

The implementation should not clone many separate apps. Notes, kanban, whiteboard, mindmap, feed, graph, voice, and drive should become projections over the same event/object/memory foundation.

## Current repo anchors

| Layer | Current anchors | Current state | Native next step |
| --- | --- | --- | --- |
| L0 Trust | `packages/shared/src/auth/*`, `packages/shared/src/audit/*`, `packages/server-core/src/handlers/rpc/roles.ts`, session permission handlers | RBAC, audit hash chain, redaction, permission modes, and role handlers exist | Extend these contracts; do not create a parallel security system |
| L1 Connectivity | `packages/shared/src/sources/types.ts`, `packages/server-core/src/handlers/rpc/sources.ts`, `SourcesListPanel.tsx`, MCP/source runtime | Source/provider taxonomy exists for MCP/API/local and known providers | Add adapters as source contracts with permissions, health, and credentials |
| L2 Storage | `packages/shared/src/sessions/*`, `packages/server-core/src/storage/*`, `packages/server-core/src/sync/*`, object storage tests | Session JSONL, notes.md, artifacts, object storage, and sync services exist | Define canonical object metadata before new DB/vector storage |
| L3 Event/Object | `packages/shared/src/automations/*`, `packages/shared/src/audit/*`, `experience-runtime-store.ts`, `mission-lifecycle.ts` | Events exist in multiple domains but are not yet one object kernel | Create vocabulary/spec that unifies audit, automation, session, and mission events |
| L4 Object Graph | `markdown-entity-graph.ts`, labels/statuses/views, mission artifacts | Markdown graph exists; general object graph does not | Treat graph as projection; add object/link model after AnswerPackage |
| L5 Intelligence | `prompt-rewrite-engine.ts`, `thinking-partner.ts`, `spec-compiler.ts`, `review-board.ts`, provider gateway | Workbench intelligence primitives exist | Route outputs into structured packages and evidence refs |
| L6 Workflows | `tdd-task-generator.ts`, `agent-pipeline-planner.ts`, `mission-lifecycle.ts`, `validation-gates.ts` | Agent workflow planning exists | Reuse for task/kanban and verifier flow instead of new task engine |
| L7 Experience | `AppShell.tsx`, `SessionList.tsx`, `ChatDisplay.tsx`, `MainContentPanel.tsx`, `SourcesListPanel.tsx`, `SkillsListPanel.tsx` | Multi-panel app shell and session/source/skill views exist | Add screens incrementally through panels/routes, not by expanding `AppShell` logic |

## Concept mapping

| v4 concept | Repo-native interpretation | Primary files | Do first | Do not do yet |
| --- | --- | --- | --- | --- |
| Trust Kernel | Existing RBAC + audit + permission modes + credentials policy | `packages/shared/src/auth/*`, `packages/shared/src/audit/*`, `packages/shared/src/agent/mode-types.ts`, `packages/server-core/src/handlers/rpc/roles.ts` | Document trust invariants and add typed events for package/audit refs | New auth stack or broad permission rewrite |
| Event | Typed record of user/system/agent/source action | `packages/shared/src/automations/types.ts`, `packages/shared/src/audit/audit-event-store.ts`, `packages/shared/src/sessions/jsonl.ts` | Define event vocabulary and source refs | Replace all events in one PR |
| Object | Durable thing with kind, provenance, links, and visibility | session metadata, artifacts, notes.md, mission artifacts | Start with typed refs inside AnswerPackage | New DB migration before object model is stable |
| Memory | Curated outputs and reusable facts, not raw chat only | session notes, artifacts, workbench review/spec outputs | `NoteDraft`, `ClaimDraft`, `DecisionDraft` inside AnswerPackage | Full knowledge base UI |
| Context | Selected objects and source refs passed to model/tool | sources, skills, session messages, attachments | `ContextRef` and `RetrievalTrace` types | Vector memory before redaction/audit contract |
| Execution | Agent run, mission run, task execution, tool calls | `mission-lifecycle.ts`, `experience-layer.ts`, automation handlers | Link TaskDraft and suggested AgentRunDraft to mission/workbench vocabulary | Parallel task engine |
| AnswerPackage | Structured answer object: message + memory + execution + retrieval + audit | new `workbench/answer-package.ts`, existing artifacts/session refs | Pure shared schema/tests | Provider/UI integration |
| Note | Curated memory object with markdown export | session `notes.md`, future object kernel | Draft model and conversion spec | Multi-user note DB |
| Task/Kanban | Work object/projection over mission/session/status labels | `tdd-task-generator.ts`, `mission-lifecycle.ts`, statuses/labels/views, `SessionList.tsx` | Spec and route mapping | Full kanban clone |
| Whiteboard/Mindmap | Projection over graph/object links with layout metadata | future graph projection, current markdown entity graph | Spec only | Store truth in canvas layout |
| Feed | Source ingestion projection | sources + automations + future digest objects | Spec source/item/digest model | Folo clone |
| Voice | Explicit capture source | voice input/provider abstraction later | Upload/push-to-talk spec after trust | Always-on capture |
| Drive/File | File object + extraction + artifact registry | object storage, file RPC, session artifacts | File object and extracted-text spec | Full drive clone |
| Vector/Graph | Memory geometry and retrieval trace | markdown graph, search, future vector jobs | Schema and retrieval trace | Milvus dependency before kernel |

## Existing UI mapping

| Screen or surface | Current component path | v4 role | Implementation guidance |
| --- | --- | --- | --- |
| Home/Inbox | `AppShell.tsx`, `LeftSidebar.tsx`, `SessionList.tsx` | Attention routing and session triage | Use existing statuses, labels, views, unread, pending prompts |
| Sessions | `SessionList.tsx`, `SessionItem.tsx`, `SessionMenu.tsx` | Bounded work contexts | Add task/note badges through metadata only after schema exists |
| Chat | `ChatDisplay.tsx`, `FreeFormInput.tsx` | Timeline projection over prompt/answer/events | Do not make chat source of truth for memory |
| Notes | session notes RPC in `sessions.ts`; right-sidebar surfaces | Curated memory projection | First wire answer-to-note draft, not global notes app |
| Tasks/Kanban | session monitor kanban grouping, mission lifecycle | Execution board | Reuse status/label/view infrastructure |
| Sources | `SourcesListPanel.tsx`, `SourceInfoPage.tsx` | Adapter setup and health | Add source permission/health details before new provider UI |
| Skills | `SkillsListPanel.tsx`, `SkillInfoPage.tsx`, shared skills storage | Runtime contracts | Show schema/evals/permissions once skill contract data exists |
| Artifacts | current dirty artifact panel branch | Generated outputs | Treat as target for AnswerPackage artifact refs |
| Graph | no full product UI yet | Investigation projection | Build from object/link/evidence after kernel |
| Settings/Trust | settings pages + RBAC permissions pages | Policy surface | Put consent/retention/redaction here |

## Integration mapping

| Integration | Native adapter path | MVP stance |
| --- | --- | --- |
| Tailscale | Network/service registry spec around server/headless status and settings | Display private connectivity and service health later; no MVP runtime dependency |
| Syncthing | Sync substrate around `server-core/src/sync/*` | File sync/mirror only, not canonical DB |
| Drive/files | Object storage + file/source adapters | File object, extracted text, provenance, permissions |
| Milvus/vector | Future vector job layer | Define `VectorChunk` and retrieval trace first |
| Voice/LiveKit/Groq | Explicit source/capture adapter | Upload audio and push-to-talk only after consent/retention |
| Feed/Folo-like | Source + digest + promotion flow | Ingest/dedupe/score/summarize/promote, not RSS clone |
| Graph/Maltego-like | Entity/edge/evidence projection | Internal graph lab first, no external OSINT marketplace |
| Logseq/Markdown mirror | Export/mirror over notes/blocks | Not primary storage |
| Calendar/email/reminders | Attention/context source adapters | Do not build full clients in MVP |

## Release ordering

1. R0: Trust + event vocabulary over existing RBAC/audit.
2. R1: Session prompt/answer capture and `AgentAnswerPackage`.
3. R2: Notes/task drafts and kanban projection.
4. R3: File/artifact object model and indexing.
5. R4: Vector/retrieval preview.
6. R5: Feed and graph lab.
7. R6: Skills and agent runs.
8. R7: Network and sync surfaces.
9. R8: Voice v0.
10. R9: Advanced memory only after mature trust.

## MVP kill list

Do not build these before R0-R4 are proven:

- always-on screen recording
- always-on voice
- full email client
- full calendar client
- full Folo clone
- full Maltego clone
- full Drive clone
- external OSINT transform marketplace
- enterprise multi-tenant RBAC beyond current RBAC roadmap

## First implementation target

The first runtime slice is `T540-answer-package-schema`: a pure shared schema under `packages/shared/src/workbench` with Bun tests. It must not touch dirty protocol/session/artifact files.
