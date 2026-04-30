# T001 Test Harness Map

This map links Agent Workbench feature classes to existing test surfaces and validation commands.

## UI

Existing harness:
- Electron renderer and shared route tests live under `apps/electron/src/**/__tests__`.
- Reusable component tests live under `packages/ui/src/components/**/__tests__`.

Use for:
- Composer mode selector and action buttons.
- Spec Builder, Review Board, Account, Logs, Team Space, Files, Sync Center, and settings pages.

Required evidence:
- Render state.
- Click/keyboard behavior.
- Empty/loading/error states.
- Regression that existing chat submit still works when composer changes.

## Server

Existing harness:
- Server-core tests live under `packages/server-core/src/**/__tests__`.
- RPC and web UI behavior already has handler-level tests.

Use for:
- Account HTTP/session behavior.
- Cloud workspace lifecycle.
- Protected endpoints.
- System/local-only guards.

Required evidence:
- 401 when unauthenticated.
- 403 when cross-tenant or wrong role.
- Existing local-only behavior remains protected.

## Workspaces

Existing harness:
- Workspace storage tests live under `packages/shared/src/workspaces/__tests__`.
- Related source/skill/status/label storage tests live under their package directories.

Use for:
- Default workspace bundle installer.
- Skill/status/label seeding.
- Sync snapshot inputs.

Required evidence:
- Installer can run twice without duplicates.
- Existing user skill is not overwritten.
- Missing workspace folder is created.

## Skills

Existing harness:
- Skill storage tests live under `packages/shared/src/skills/__tests__`.
- Mention resolution touches `packages/shared/src/mentions`.
- Agent contract validation lives under `scripts/validate-agent-contract.ts`.

Use for:
- Skill pack manifests.
- Runtime skill resolution from product modes.
- Contract validation of Codex execution skills.

Required evidence:
- Valid frontmatter and stable ids.
- Duplicate ids fail.
- Product skill packs preserve user overrides.

## Automations

Existing harness:
- Automation tests live under `packages/shared/src/automations/*.test.ts` and `packages/shared/src/automations/handlers/*.test.ts`.
- Route parser coverage exists in Electron shared tests.

Use for:
- Agent Workbench preset manifests.
- Event/action registration.
- Scheduled daily summary.
- Status-change validation triggers.

Required evidence:
- Invalid event/action config fails.
- Installation is idempotent.
- Fake runner prevents real shell/LLM calls in tests.

## Permissions

Existing harness:
- Agent tool permission tests live under `packages/shared/src/agent/__tests__`.
- Workspace permission normalization is covered under `packages/shared/src/workspaces/__tests__`.

Use for:
- Product mode allowed permission mapping.
- Browser tool gating.
- Skill/source access rules.
- Team/cloud RBAC overlay.

Required evidence:
- Disallowed mode cannot enable restricted browser/tool access.
- Viewer/member/admin/owner matrix denies by default.
- Cross-tenant access fails.

## Labels

Existing harness:
- Label package tests live under `packages/shared/src/labels/__tests__`.
- Label RPC handler code lives under server-core handlers.
- View functions support label queries.

Use for:
- `mode::*`, `artifact::*`, `validation::*`, `scope::*`, `priority::*` seed labels.
- Logs/history filtering.
- Automation triggers by label.

Required evidence:
- Required labels exist after install.
- Filtering by mode/status/scope returns expected events only.
- Auto-label decisions are logged.

## Remote Server

Existing harness:
- `packages/server-core/src/webui/__tests__/http-server.test.ts`.
- `packages/server-core/src/webui/__tests__/account-http.test.ts`.
- `packages/server-core/src/webui/__tests__/oauth-callback.test.ts`.
- Electron preload remote routing behavior is visible in preload tests and channel-map tests.

Use for:
- Cloud account bootstrap boundary.
- OAuth/account callbacks.
- Remote workspace config visibility.
- Managed workspace lifecycle APIs.

Required evidence:
- Local mode remains usable without cloud auth.
- Cloud-only APIs require authenticated identity.
- Remote workspace list is tenant-scoped.

## Tests

Core commands:
- `bun run validate:agent-contract` for T000 execution contract.
- `bun run validate:architecture-docs` for T001 architecture docs.
- `bun test` for full Bun tests when feature code changes.
- `bun run typecheck`, `bun run typecheck:electron`, and package-specific typechecks for typed code changes.

Use for:
- Script validators for docs and metadata.
- Unit/integration/component/security tests for implementation tickets.

Required evidence:
- Red-phase failure captured in worklog.
- Green-phase output captured in worklog.
- No real LLM, S3, or cloud calls in tests.

## Build

Existing command surface:
- `bun run validate:ci` for CI-grade validation.
- `bun run electron:build` for desktop build.
- `bun run electron:dist:dev:mac` for dev macOS packaging.
- `bun run webui:build` for web UI build.
- `bun run lint` and package lint scripts for code style.

Use for:
- T002 CI baseline.
- T033 Mac ARM workflow.
- T040 release-candidate validation.

Required evidence:
- Build command selection is documented per ticket.
- Desktop changes get Electron validation.
- Web/cloud changes get web UI validation.
