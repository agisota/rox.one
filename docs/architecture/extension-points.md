# T001 Extension Points

This document states where Agent Workbench Suite should attach to the existing Craft codebase without rewriting working subsystems.

## UI

Extension point:
- Add new app sections through the existing renderer shell and settings/navigation registries.
- Add composer mode controls near existing chat composer/session controls.
- Add account, logs, team, sync, files, spec, review, and automation screens as isolated panels first.

Recommended approach:
- Keep product controls as typed intent events before wiring execution.
- Preserve existing chat submit behavior with regression tests.

## Server

Extension point:
- Add service abstractions under server-core for cloud account, team, storage, sync, and audit behavior.
- Expose APIs through existing RPC/HTTP handler patterns only after auth/session context exists.

Recommended approach:
- Start with interfaces and fake providers in tests.
- Do not present fake auth as production-ready auth.

## Workspaces

Extension point:
- Use workspace storage initialization for default bundle installation.
- Store Agent Workbench labels/statuses/skills as workspace assets.
- Add sync snapshots as explicit artifacts rather than transparent mutation.

Recommended approach:
- Installer must be idempotent.
- User-authored workspace skills take precedence unless a versioned migration explicitly says otherwise.

## Skills

Extension point:
- Add product skill packs as workspace seed data.
- Resolve skills through existing skill/mention mechanisms.
- Keep Codex workflow skills separate from product runtime skills.

Recommended approach:
- Product modes reference skills by stable id.
- Tests verify missing/duplicate skill ids and preserve-user-skill behavior.

## Automations

Extension point:
- Add bundled presets for prompt submit, label add, session status changes, subagent stop, and scheduled summaries.
- Use fake action runners in tests.

Recommended approach:
- Automations should suggest mode/review/validation actions, not silently mutate completed artifacts.
- Validation-trigger automations must write history/audit events.

## Permissions

Extension point:
- Product modes map to allowed permission modes and required tool capabilities.
- Cloud/team permissions add RBAC above local tool permission rules.

Recommended approach:
- Keep permission/autonomy modes distinct from product/cognitive modes.
- Deny-by-default when a cloud/team resource is missing an explicit allow rule.

## Labels

Extension point:
- Use labels for `mode::*`, `artifact::*`, `validation::*`, `scope::*`, and `priority::*` classification.
- Use existing label queries for logs, history, views, and automation triggers.

Recommended approach:
- Avoid a second tagging system.
- Record auto-applied labels in history/audit so users can understand classification.

## Remote Server

Extension point:
- Treat current remote server as session/runtime infrastructure.
- Add managed cloud workspace model around it: tenant, owner, team, lifecycle, quotas, and audit.

Recommended approach:
- MVP should be shared multi-tenant with strict namespace/auth boundaries or per-team isolation for paid plans.
- Per-user instances should remain enterprise/security tier until operationally justified.

## Tests

Extension point:
- Add tests beside existing subsystem tests.
- Add scripts under `scripts/validate-*.ts` for docs, contract, and workflow metadata.
- Use deterministic fake providers for external services.

Recommended approach:
- Every feature ticket records red-phase failure in the worklog.
- UI features get component tests; cloud/storage/team features get security tests.

## Build

Extension point:
- Reuse root package scripts for validation, typecheck, tests, Electron build, web UI build, and macOS artifacts.
- Add GitHub Actions in later CI/release tickets.

Recommended approach:
- T002 owns baseline CI.
- T033 owns Mac ARM build workflow.
- T040 owns final release-candidate validation.
