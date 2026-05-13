# T219 - Audit event writer

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench
Suite.

Relevant product goals:

- managed web/cloud app
- user/team workspaces
- multi-tenant storage isolation
- validation gates
- queryable audit trail

T218 added the append-only audit schema. T219 wires existing structured audit
emitters into a configured audit backend while keeping existing logger output.

## Goal

Add audit writer fanout for C4 scope and credential audit events.

## Required UI

None.

## Required Data/API

- Shared audit storage exports live under `@rox-agent/shared/audit` so shared
  scope emitters do not depend on server-core.
- `@rox-agent/server-core/audit` continues to expose the same schema by
  re-exporting shared audit contracts.
- `appendStructuredAuditEvent(level, event, payload)` maps existing audit
  payloads to `AuditEventInput`.
- `ROX_AUDIT_BACKEND=memory` enables an in-process queryable backend.
- `ROX_AUDIT_BACKEND=file` enables JSONL persistence under
  `<configDir>/audit/events.jsonl`.

## Required Automations

Existing C4 audit emitters fan out to the configured audit backend:

- `scope.factory.downgraded`
- `scope.factory.forgery_rejected`
- `scope.runtime.workspace_downgraded`
- `scope.brand.cast_breach`
- `credential.scope.read`
- `credential.scope.write`
- `credential.scope.delete`
- `credential.scope.list`

## Required Subagents

Read-only explorer mapped the shared/server-core audit boundary before
implementation.

## TDD Requirements

Before implementation:

1. Add `packages/shared/src/audit/__tests__/audit-event-writer.test.ts`.
2. Prove a `scope.factory.downgraded` event still logs through debug output and
   also appends to the memory audit backend.
3. Prove persistent audit append does not require `ROX_DEBUG`.
4. Prove file backend writes redacted JSONL records under the config dir.
5. Run the targeted test and confirm it fails for the missing shared audit
   writer.

## Implementation Requirements

- Do not add production dependencies.
- Do not introduce a shared -> server-core dependency.
- Preserve existing logger behavior.
- Keep unsupported future backends explicit rather than silently pretending to
  write.

## Validation Commands

- `bun test packages/shared/src/audit/__tests__/audit-event-writer.test.ts`
- `bun test packages/server-core/src/audit/__tests__/audit-event-store.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts`
- `cd packages/server-core && bunx tsc --noEmit`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun test`
- `bun run build`

## Acceptance Criteria

- [x] Shared audit writer exists with no shared -> server-core dependency.
- [x] Existing scope logger output still emits.
- [x] `scope.*` events append to configured memory backend.
- [x] Persistent append works without `ROX_DEBUG`.
- [x] File backend writes redacted JSONL records under `<configDir>/audit`.
- [x] Credential scope events use the same writer.
- [x] Targeted writer tests pass.
- [x] Full relevant validation passes or precise blockers are documented.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T219-audit-event-writer.md`.
