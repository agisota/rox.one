# T343 - Renderer observability audit-event import boundary

Status: DONE

## Context

After rebasing onto current `origin/main`, `bun run build` passed the Electron
main, preload, and WhatsApp worker steps but failed during the renderer Vite
bundle. The renderer audit-log UI imported from the root
`@rox-one/shared/observability` barrel. That barrel re-exports producer APIs,
which evaluates Node-only modules that import `node:async_hooks` and
`node:crypto`.

## Goal

Keep the renderer audit-log UI on the serialisable audit-event taxonomy without
pulling Node-only observability producer modules into the browser bundle.

## Required UI

No visible UI changes.

## Required Data/API

Add a package subpath for the browser-safe audit-event taxonomy:

- `@rox-one/shared/observability/audit-event`

No event shape changes.

## Required Automations

The existing renderer build remains the contract:

- `bun run build`

## Required Subagents

None. The Vite failure identifies the import chain and affected modules.

## TDD Requirements

Use the existing full build as the red check:

- `bun run build`

## Implementation Requirements

- Route renderer audit-log imports through an audit-event-only subpath.
- Keep the `CorrelationId` type dependency browser-safe so importing the
  audit-event taxonomy does not resolve Node async-context modules.
- Keep the root observability barrel unchanged for server-side producer
  imports.
- Do not add dependencies.
- Do not change audit-event runtime shapes.

## Validation Commands

- `bun run build`
- `bun run typecheck`
- `bun run lint`
- `bun test apps/electron/src/renderer/components/settings/rbac/__tests__/audit-log-state.test.ts`
- `bun test`
- `git diff --check`

## Acceptance Criteria

- [x] Renderer no longer imports Node-only observability producer modules.
- [x] `bun run build` no longer fails on `node:async_hooks` or `node:crypto`
  in the renderer bundle.
- [x] Audit-log reducer tests continue to pass.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T343-renderer-observability-audit-event-import-boundary.md`.
