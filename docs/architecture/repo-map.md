# T001 Repository Map

This map captures the current Craft Agents fork surfaces needed before adding Agent Workbench Suite layers. It is intentionally read-only architecture documentation: no application behavior changes are part of T001.

## UI

Primary renderer UI lives under `apps/electron/src/renderer`.

Key surfaces:
- `apps/electron/src/renderer/components/app-shell`: desktop shell, navigation, workspace framing.
- `apps/electron/src/renderer/components/chat`: chat/session composer and message UI.
- `apps/electron/src/renderer/components/settings`: settings panel components.
- `apps/electron/src/renderer/pages/settings`: settings pages, including account settings.
- `apps/electron/src/renderer/components/automations`: automations management UI.
- `apps/electron/src/renderer/components/browser`: embedded browser UI controls.
- `apps/electron/src/renderer/components/files`: file-facing UI components.
- `packages/ui/src/components`: reusable UI primitives, markdown, overlay, terminal, annotations, code viewer.

Responsibility:
- Renderer owns user-facing navigation, settings screens, chat panels, browser controls, and reusable UI blocks.
- Settings route metadata is centralized in `apps/electron/src/shared/settings-registry.ts` and uses i18n label keys.

Risks:
- Composer and session controls are high-regression surfaces because existing send behavior must stay intact.
- Account and browser UI crosses renderer, preload, main, and server boundaries.

Recommended tests:
- Component tests for new panels/buttons.
- Existing send-flow regression tests when adding composer toolbars.
- Accessibility checks for icon-only controls and keyboard traversal.

## Server

Server-side runtime is split across `packages/server`, `packages/server-core`, and shared protocol packages.

Key surfaces:
- `packages/server/src/index.ts`: server bootstrap, resources path resolution, remote/headless workspace paths, source refresh notifications.
- `packages/server-core/src/handlers/rpc`: RPC handlers for sessions, labels, server, system, and related runtime APIs.
- `packages/server-core/src/services`: service layer used by handlers and runtime wiring.
- `packages/server-core/src/runtime`: runtime/session execution support.
- `packages/server-core/src/domain`: domain models and service-facing types.
- `packages/server-core/src/transport`: transport integration.

Responsibility:
- Server-core owns the runtime and RPC API boundary.
- Server package wires runtime startup and workspace/resource directories.

Risks:
- Managed cloud additions must not weaken local-only filesystem guards.
- Account, team, storage, and sync APIs need explicit auth/session context before production exposure.

Recommended tests:
- Handler-level tests for 401/403 and tenant isolation.
- Service tests for model/schema logic.
- Regression tests for existing session and label RPC behavior.

## Workspaces

Workspace definitions and storage helpers live under `packages/shared/src/workspaces`.

Key surfaces:
- `packages/shared/src/workspaces/types.ts`: workspace shape and documented default paths.
- `packages/shared/src/workspaces/storage.ts`: workspace filesystem layout, default `~/.rox/workspaces`, source/skill directories, label config initialization, plugin manifest support.
- `packages/shared/src/credentials/types.ts`: source credential path conventions under workspace source directories.

Responsibility:
- Workspaces define persistence roots for sessions, sources, skills, statuses, labels, attachments, plans, and permissions.
- Workspace storage is the natural extension point for default Agent Workbench bundles.

Risks:
- First-run installers must be idempotent and must not overwrite user workspace skills.
- Cloud sync must not assume transparent bidirectional sync exists.

Recommended tests:
- Temp-workspace installer tests.
- Idempotency tests for generated labels/statuses/skills.
- Snapshot and conflict tests before local-cloud sync.

## Skills

Skill surfaces live in shared workspace/source code and now in project-local bootstrap docs.

Key surfaces:
- `packages/shared/src/skills`: skill storage and resolution logic.
- `packages/shared/src/mentions/index.ts`: resolves skill and source mentions for prompts.
- Workspace-level `skills` directories are initialized through workspace storage.
- `.agents/skills/*/SKILL.md`: Agent Workbench execution skills created by T000.

Responsibility:
- Existing Craft skills are user/workspace execution assets.
- T000 skills are Codex workflow instructions for disciplined backlog execution.

Risks:
- Product skill packs must not collide with user-authored workspace skills.
- Prompt workflow buttons should use skills through an explicit registry instead of ad hoc prompt strings.

Recommended tests:
- Skill manifest schema validation.
- Installer tests for preserve-user-skill behavior.
- Mention resolution regression tests.

## Automations

Automation logic is centered under `packages/shared/src/automations` and UI under the Electron renderer.

Key surfaces:
- `packages/shared/src/automations/automation-system.test.ts`: core automation test coverage.
- `packages/shared/src/automations/event-bus.test.ts`: event bus behavior.
- `packages/shared/src/automations/handlers`: prompt, event-log, and related automation handlers.
- `packages/shared/src/scheduler/scheduler-service.ts`: scheduled automation subscription support.
- `apps/electron/src/renderer/components/automations`: automations UI.
- `apps/electron/src/shared/__tests__/route-parser-automations.test.ts`: route parsing for automation screens.

Responsibility:
- Automations bind workspace/session events to prompt-actions, shell actions, logs, and scheduled tasks.

Risks:
- Agent Workbench presets must not run external commands in tests.
- Status-triggered validation must be auditable and idempotent.

Recommended tests:
- Preset schema tests.
- Idempotent installation tests.
- Fake action runner tests.

## Permissions

Permission-related code spans shared agent tools, preload routing, server handlers, and workspace state.

Key surfaces:
- `packages/shared/src/agent/__tests__/browser-tools-permissions.test.ts`: browser tool permission behavior.
- `packages/shared/src/agent/__tests__/call-llm-permissions.test.ts`: LLM permission behavior.
- `packages/shared/src/agent/__tests__/session-tool-safe-mode-permissions.test.ts`: safe-mode permission behavior.
- `packages/shared/src/workspaces/__tests__/storage-permission-mode-normalization.test.ts`: workspace permission mode normalization.
- `packages/server-core/src/handlers/rpc/sessions.ts`: session labels and permission request handling.
- `apps/electron/src/preload/bootstrap.ts`: local/remote routing, remote URL constraints, browser consent flow.

Responsibility:
- Existing permissions protect tool use, filesystem access, browser actions, and session-level actions.

Risks:
- Product modes must not replace permission/autonomy modes.
- Cloud/team features need deny-by-default RBAC on top of existing local permissions.

Recommended tests:
- Product mode to permission compatibility tests.
- Browser disabled-by-default tests outside research/review modes.
- RBAC deny tests for cloud/team resources.

## Labels

Labels are a mature extension surface in shared and server handler code.

Key surfaces:
- `packages/shared/src/labels`: label config, matching, and helpers.
- `packages/shared/src/views/functions.ts`: query helpers such as `contains(labels, "priority")` and valued label support.
- `packages/server-core/src/handlers/rpc/labels.ts`: label list/create/delete RPC.
- `packages/server-core/src/handlers/rpc/sessions.ts`: session label handling.

Responsibility:
- Labels classify sessions, tasks, statuses, modes, priorities, validation results, scopes, and artifacts.

Risks:
- Agent Workbench should reuse labels instead of building a parallel tagging system.
- Auto-label automations must remain transparent and reversible.

Recommended tests:
- Label installer schema tests.
- History/log filtering by mode label.
- Session label regression tests.

## Remote Server

Remote access and web UI are already present but not equivalent to managed SaaS multi-tenancy.

Key surfaces:
- `packages/server-core/src/webui/http-server.ts`: web UI server, optional account bootstrap hook, OAuth callbacks, workspace config APIs, SPA fallback.
- `packages/server-core/src/webui/__tests__/account-http.test.ts`: account HTTP behavior.
- `packages/server-core/src/webui/__tests__/http-server.test.ts`: HTTP server coverage.
- `packages/server-core/src/webui/__tests__/oauth-callback.test.ts`: OAuth callback coverage.
- `apps/electron/src/preload/bootstrap.ts`: remote connection setup and encrypted remote checks.
- `packages/server-core/src/handlers/rpc/server.ts`: workspace health/status and remote server status.

Responsibility:
- Remote server supports long-running sessions and web/browser/CLI access.
- Managed cloud must add auth boundary, tenant isolation, quotas, lifecycle, and audit logs.

Risks:
- Existing remote server primitives must not be exposed as public multi-tenant SaaS without auth/RBAC/rate limits.
- Remote filesystem operations need strict local-only guards.

Recommended tests:
- Cloud-only endpoint 401/403 tests.
- Session context spoofing tests.
- Tenant-scoped workspace list tests.

## Tests

The repo already has Bun-based test coverage across shared, server-core, Electron, and UI packages.

Key surfaces:
- `bun test` runs the project test suite.
- Shared tests live throughout `packages/shared/src/**/__tests__` and `*.test.ts` files.
- Server tests live under `packages/server-core/src/**/__tests__`.
- Electron tests live under `apps/electron/src/**/__tests__`.
- UI tests live under `packages/ui/src/components/**/__tests__`.
- Contract validators live under `scripts/validate-*.ts`.

Responsibility:
- Use unit tests for pure registries/schemas.
- Use integration tests for adapters/services/handlers.
- Use UI/component tests for screens and controls.
- Use validators for docs, backlog, and CI contract files.

Risks:
- TDD compliance requires recording expected failing output before implementation.
- Fake providers must validate contracts instead of masking broken schema.

Recommended tests:
- Add focused tests beside existing subsystem tests.
- Use deterministic fake providers for LLM/browser/S3/cloud provisioner behavior.

## Build

Build and validation commands are exposed through root package scripts.

Key commands:
- `bun run validate:agent-contract`: validates AGENTS/docs/tickets/skills contract.
- `bun run validate:docs`: alias for agent contract validation.
- `bun run test`: project tests.
- `bun run typecheck`: package typechecks.
- `bun run typecheck:electron`: Electron typecheck.
- `bun run validate:ci`: CI validation bundle.
- `bun run lint`: lint tasks.
- `bun run electron:build`: Electron build.
- `bun run electron:dist:dev:mac`: dev macOS desktop artifact.
- `bun run webui:build`: web UI build.

Responsibility:
- T000/T001 use lightweight contract validators because no application behavior changes.
- Later UI/server/storage tasks must run targeted tests plus relevant build/typecheck gates.

Risks:
- Full builds are expensive and should be reserved for affected areas or release tasks.
- Mac ARM workflow belongs in a later release/build ticket, not T001.

Recommended tests:
- Validator tests for docs and workflows.
- Targeted typecheck/build based on touched package boundaries.
