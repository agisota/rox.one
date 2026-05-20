# ROX.ONE V4 Execution Goals

This queue converts the v4 plan into PR-sized goals. Execute one goal at a time unless the touched files are disjoint.

## Current defaults

- Work from clean `origin/main` for runtime PRs when the current checkout is dirty.
- Keep docs/spec changes separate from runtime behavior changes.
- Upstream comparison is secondary context and should not block kernel work.
- Always-on voice/screen memory remains out of scope until trust, consent, retention, redaction, and audit are implemented.

## G-001: V4 native mapping pack

Goal: Create the docs that map v4 concepts to current ROX.ONE modules.

Allowed paths: `docs/architecture`, `docs/tickets`, `docs/worklog`.

Validation: `bun run validate:architecture-docs`, `bun run validate:agent-contract`, `bun run validate:docs`, `git diff --check`.

Acceptance: mapping, workflow, and execution goal docs exist and identify exact repo anchors.

## G-002: AnswerPackage shared schema

Goal: Add pure shared `AgentAnswerPackage` schemas and helpers.

Allowed paths: `packages/shared/src/workbench`, `packages/shared/src/workbench/__tests__`.

Out of scope: session JSONL, protocol channels, artifact RPC, UI.

Validation: `bun test packages/shared/src/workbench/__tests__/answer-package.test.ts`, `bun run typecheck:shared`, `git diff --check`.

## G-003: Event vocabulary ADR

Goal: Define the shared event vocabulary that maps audit events, automation events, session events, and mission events.

Allowed paths: `docs/architecture`, `docs/tickets`, `docs/worklog`.

Acceptance: ADR identifies canonical event fields, source refs, trust metadata, and migration path.

## G-004: Trust invariants test matrix

Goal: Add a docs/test matrix for redaction, RBAC, permission requests, retention, and audit hash-chain invariants.

Allowed paths: `docs/security`, `docs/architecture`, existing audit/RBAC test docs.

Acceptance: each invariant maps to existing or missing tests.

## G-005: AnswerPackage-to-artifact adapter spec

Goal: Specify how AnswerPackage references session artifacts without changing artifact storage.

Allowed paths: docs only unless G-002 is merged.

Acceptance: adapter shape defines `artifactId`, `sourceMessageId`, `sessionId`, version refs, and audit refs.

## G-006: Session prompt/answer capture contract

Goal: Document current message JSONL flow and define where prompt/answer package capture can be inserted.

Allowed paths: docs first; code later under shared/server-core after tests.

Acceptance: insertion points and non-goals are explicit.

## G-007: NoteDraft MVP

Goal: Represent answer-generated notes as drafts tied to session notes and future object memory.

Allowed paths: shared workbench schema after G-002.

Acceptance: no global notes DB; draft can export to markdown and preserve provenance.

## G-008: TaskDraft MVP

Goal: Represent answer-generated tasks with acceptance criteria, verification commands, risk, and suggested owner.

Allowed paths: shared workbench schema after G-002.

Acceptance: maps to existing TDD task generator and mission lifecycle.

## G-009: Kanban projection spec

Goal: Define kanban as a projection over TaskDraft/MissionRun/session status labels.

Allowed paths: docs first.

Acceptance: avoids new task engine; identifies `SessionList` and mission lifecycle integration path.

## G-010: Home/Inbox IA spec

Goal: Define Home and Inbox panels using existing AppShell, sidebar, statuses, labels, unread, pending approvals, source health, and mission state.

Allowed paths: docs first; UI later.

Acceptance: ASCII wireframes and route ownership.

## G-011: Sidebar panel extraction plan

Goal: Identify how to add new panels without expanding `AppShell.tsx` further.

Allowed paths: docs first.

Acceptance: names candidate extracted modules and component boundaries.

## G-012: Source adapter permissions matrix

Goal: Map provider/source types to auth method, permissions, dangerous actions, and health state.

Allowed paths: docs, then shared sources tests.

Acceptance: Gmail/Calendar/Drive/GitHub/Slack/Notion/Linear/Tailscale/Syncthing have explicit MVP stance.

## G-013: Skill runtime contract extension

Goal: Extend skill docs/model to include schemas, allowed tools, evals, safety constraints, version, run logs.

Allowed paths: shared skills docs/schema after current skill contract tests are inspected.

Acceptance: backward compatible with current `SKILL.md` loading.

## G-014: Object/link model spec

Goal: Define `ObjectKind`, `ObjectRef`, `Link`, provenance, visibility, retention, and audit refs.

Allowed paths: docs first.

Acceptance: maps each object kind to existing or future storage.

## G-015: RetrievalTrace schema

Goal: Add retrieval trace refs for used/excluded context and evidence.

Allowed paths: shared workbench after G-002.

Acceptance: does not require vector database.

## G-016: Redaction policy helper

Goal: Reuse audit redaction patterns for answer package/public share metadata.

Allowed paths: shared audit/workbench tests.

Acceptance: secrets in keys and strings are redacted before package summaries/public refs.

## G-017: File object and extracted text spec

Goal: Define file object lifecycle from upload to extract/index/artifact.

Allowed paths: docs first; later storage/object tests.

Acceptance: uses object storage and session artifacts as anchors.

## G-018: Vector memory MVP spec

Goal: Define vector collection, chunk, embedding job, retrieval preview, and failure states.

Allowed paths: docs only.

Acceptance: no Milvus dependency until trust/object model is stable.

## G-019: Graph lab MVP spec

Goal: Define internal graph lab as entity/edge/evidence projection.

Allowed paths: docs and future shared graph schema.

Acceptance: no OSINT marketplace.

## G-020: Feed digest MVP spec

Goal: Define feed source/item/digest/promote flow.

Allowed paths: docs only.

Acceptance: feed promotes to notes/tasks/context; it is not a full feed client.

## G-021: Voice v0 consent spec

Goal: Define audio upload and push-to-talk with consent/retention/audit.

Allowed paths: docs only.

Acceptance: no always-on capture.

## G-022: Markdown/Logseq mirror spec

Goal: Define export/mirror pages, journals, backlinks, block IDs, import limits.

Allowed paths: docs only.

Acceptance: mirror is not source of truth.

## G-023: Agent run review surface spec

Goal: Define review UI for pending approvals, artifacts, validation gates, and verifier notes.

Allowed paths: docs first; later workbench UI.

Acceptance: maps to mission lifecycle and artifacts.

## G-024: Validation coverage matrix

Goal: Create a matrix from v4 kernels to tests/commands.

Allowed paths: docs and scripts only if needed.

Acceptance: each future implementation goal has target checks.

## G-025: Upstream ambiguity snapshot

Goal: Record the practical comparison baseline against `craft-ai-agents/craft-agents-oss` without blocking v4 work.

Allowed paths: docs only.

Acceptance: separates fact, inference, unknown, and risk.

## Recommended first 7 days

| Day | Work |
| --- | --- |
| 1 | Land G-001 mapping pack |
| 2 | Land G-002 AnswerPackage schema |
| 3 | Land G-003/G-004 trust/event docs and validation matrix |
| 4 | Land G-007/G-008 note/task drafts |
| 5 | Land G-010/G-011 UX IA and sidebar extraction plan |
| 6 | Land G-012/G-017 source/file adapter specs |
| 7 | Land G-024/G-025 validation/upstream snapshots |
