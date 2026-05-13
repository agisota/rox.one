# T344 - RC Scenario S06: File Upload → Entity Graph → Source Link

Status: Todo

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.
Phase 20 of the master roadmap runs the ten release-candidate scenarios end-to-end
on a clean Electron build and captures pass/fail evidence.

This ticket covers **RC Scenario 6** from `plan.md §16`:

> File upload → entity graph → source link.

The scenario exercises the File Manager (T026), the Markdown Entity Graph
renderer (T028), and the source-link back-reference that connects an entity in
the graph to the originating file passage. A user uploads a document, the entity
graph is generated from its content, and clicking an entity node navigates to the
source passage in the file viewer.

## Goal

Verify that a file uploaded through the File Manager is processed into an entity
graph and that each entity carries a working source link. The source link must
open the file viewer at the correct passage — not just at the top of the file.

## Required UI

- File upload drop-zone or browse dialog in the File Manager (T026)
- Entity graph visualization panel (T028)
- File viewer with passage-level scroll-target (T027/T028)
- Source-link affordance on entity nodes (clickable)

## Required Data/API

- File upload RPC or IPC (`/rpc/files.upload` or Electron `dialog.showOpenDialog`)
- Entity extraction pipeline (markdown parsing → entity detection)
- Entity graph store with `sourceRef: { fileId, passageOffset }` per node
- File viewer passage scroll-to API

## Required Automations

- Upload triggers entity extraction automatically
- Entity graph renders within one view-transition of upload completion
- Source-link click opens the file viewer at the correct passage

## Required Subagents

None for this validation ticket.

## TDD Requirements

1. Integration test: upload a fixture markdown document → assert at least one
   entity node is present in the graph store.
2. Integration test: each entity node has a `sourceRef` with a non-null
   `passageOffset`.
3. Integration test: navigate from entity to source → assert file viewer
   scrolls to the passage matching `passageOffset` (not top-of-file).
4. UI test: entity node click triggers navigation (not a no-op).

## Implementation Requirements

No new implementation. This is an RC validation scenario.
Any regressions found should be filed as blocking tickets before Phase 20 can
close.

## Validation Commands

```bash
# Smoke run via E2E harness
bun run e2e:smoke -- --scenario s06-file-upload-entity-graph

# File manager + entity graph tests
bun test apps/electron/src/renderer/components/workbench/**/__tests__/file*.test.*
bun test packages/shared/src/**/__tests__/entity-graph*.test.ts

# Agent contract gate
bun run validate:agent-contract
```

## Acceptance Criteria

- [ ] User can upload a file through the File Manager without errors
- [ ] Entity graph is generated and displayed after upload completes
- [ ] At least one entity node is present in the graph
- [ ] Each entity node displays a source-link affordance
- [ ] Clicking a source link opens the file viewer at the correct passage
- [ ] Passage-level scroll target is correct (not top-of-file)
- [ ] Screenshot evidence captured and referenced in
      `docs/release/2026-05-14-rc-evidence.md`
- [ ] Pass/fail status updated in the RC evidence table (row S06)

## Worklog

Update `docs/worklog/T344-rc-s06-file-upload-entity-graph.md` with run log,
screenshots, and any blocker ticket references.
