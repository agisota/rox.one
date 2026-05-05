# Dispatch Packet: W3 Files, Knowledge, Research

Phase: `EXECUTE`

Tickets: `T026`-`T030`

## Objective

Close file/knowledge/research acceptance gaps by wiring existing core modules into UI/runtime flows and adding the missing interaction tests.

## Current Evidence

- `T026`: file scope engine and tests exist, but denied access is not surfaced through a dedicated UX acceptance path.
- `T027`: PDF viewer state tests exist, but DOM interaction tests for overlay controls are missing.
- `T028`: markdown entity graph parser exists, but parser edge cases and UI graph surfacing are incomplete.
- `T029`: Office adapter injection contract exists, but handler-level fake-provider integration needs stronger proof.
- `T030`: browser research policy exists, but runtime tool-construction wiring is missing.

## Dependency Order

1. `T026` first because file scope behavior protects file access.
2. `T029` next because it shares `packages/server-core/src/handlers/rpc/files.ts`.
3. `T027` can run in parallel with server-core work if it stays inside `packages/ui`.
4. `T028` can close parser edge cases independently.
5. `T030` should run after policy contract is stable and wire into runtime tool activation.

## Write Scope

- `packages/server-core/src/handlers/**`
- `packages/server-core/src/services/**`
- `packages/ui/src/components/overlay/**`
- `packages/shared/src/workbench/**`
- `packages/shared/src/agent/**` only for browser research policy wiring
- matching tests and worklogs/tickets for `T026`-`T030`

## Forbidden Scope

- No real browser automation calls in tests.
- No real Office/markitdown conversion dependency in tests; use injected converter fakes.
- No broad filesystem permission expansion.
- No parser dependency addition without license/runtime justification.

## Required TDD

- `T026`: red test for denied browse/search surfaced as a stable UI or RPC error contract.
- `T027`: red component test for page next/prev, zoom in/out, empty/error states.
- `T028`: red regression tests for markdown edge cases chosen for MVP scope.
- `T029`: red handler-level test proving fake converter injection and fallback behavior.
- `T030`: red runtime wiring test proving browser research policy controls tool activation.

## Validation Commands

- `bun test packages/server-core/src/handlers/__tests__/file-manager-scopes.test.ts packages/server-core/src/handlers/__tests__/validate-file-path.test.ts`
- `bun test packages/server-core/src/services/office-document-adapter.test.ts`
- `bun test packages/ui/src/components/overlay/__tests__/pdf-viewer-state.test.ts`
- `bun test packages/shared/src/workbench/__tests__/markdown-entity-graph.test.ts packages/shared/src/workbench/__tests__/browser-research-integration.test.ts`
- `bun run typecheck:shared`
- `cd packages/server-core && bun run typecheck`
- `bun run validate:agent-contract`
- `git diff --check`

## Acceptance

- File Manager denies unsafe scopes and exposes understandable errors.
- PDF viewer has tested controls, loading, empty, and error states.
- Markdown graph parser has stable MVP edge-case rules.
- Office adapter remains fake-provider testable and safely handles failed conversion.
- Browser research policy is actually used before enabling tools.
