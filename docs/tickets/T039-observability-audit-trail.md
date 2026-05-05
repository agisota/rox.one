# T039-observability-audit-trail

Status: DONE

## Goal
Implement a shared account/team audit trail surface for Agent Workbench operations so account logs, team mission events, validation gates, billing traces, and security-relevant actions can be recorded with deterministic redaction and RBAC.

## Required Data/API
- Audit event schema with actor, action, target, timestamp, severity, source, details, and metadata.
- Account-scoped event listing remains user-isolated.
- Team-scoped audit listing is owner/admin only.
- Secrets are redacted by key and by common string patterns before storage and response serialization.

## Required Tests
- Unit coverage for schema defaults, redaction, defensive copies, and team event isolation.
- HTTP/RBAC coverage for team audit read access.
- Typecheck for server-core/server surfaces.

## Acceptance Criteria
- [x] Every event has actor/action/target audit fields.
- [x] Team audit events are listable by team without cross-team leakage.
- [x] Viewer and outsider roles cannot read team audit logs.
- [x] Secrets are redacted from keys and freeform strings.
- [x] Headless server wires a default event history when hosted accounts are enabled.
- [x] Worklog complete.
- [x] Relevant validation passes.
