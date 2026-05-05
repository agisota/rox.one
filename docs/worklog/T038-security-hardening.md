# T038 — Security hardening

## 1. Task summary

Harden the implemented Experience Layer / Agent Forge trust boundary before broader execution resumes.

## 2. Repo context discovered

- `packages/shared/src/workbench/experience-layer-security.ts` already contains pure tenant, entitlement, ledger, permission, and prompt-injection guards.
- `apps/electron/src/renderer/components/workbench/agent-forge-state.ts` already blocks install without a contract and blocks public publish only when prompt-injection warnings exist.
- `listVisibleAgentPackages()` currently scopes team packages by `ownerTeamId`; T038 needs an explicit private owner boundary for user-owned packages.
- Existing tests cover cross-team team package visibility and prompt-injection publish blocking, but not contract/review/test/trust requirements for public publish.
- `packages/server-core/src/webui/http-server.ts` already gates team chat by team membership, but before this pass it did not validate that a supplied `workspaceId` or workspace ref belonged to that team when cloud workspaces are enabled.
- Team invite HTTP input was TypeScript-narrowed, but runtime JSON could still pass `owner` or unknown role strings into the team store.

## 3. Files inspected

- `docs/tickets/T038-security-hardening.md`
- `packages/shared/src/workbench/experience-layer-security.ts`
- `packages/shared/src/workbench/__tests__/experience-layer-security.test.ts`
- `packages/shared/src/workbench/experience-layer.ts`
- `apps/electron/src/renderer/components/workbench/agent-forge-state.ts`
- `apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/webui/__tests__/team-chat-http.test.ts`
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
- `packages/server-core/src/webui/account-cloud-workspaces.ts`
- `packages/shared/package.json`

## 4. Tests added first

- Shared public publish trust gate coverage.
- Agent Forge public publish hardening coverage.
- Agent Forge private user-owned visibility coverage.
- Runtime-malformed shared guard coverage for omitted evidence.
- Team chat HTTP workspace/ref spoofing coverage.
- Team invite HTTP invalid role coverage.

## 5. Expected failing test output

`bun test packages/shared/src/workbench/__tests__/experience-layer-security.test.ts apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx`

- Shared guard failed because `assertPublicPackagePublishable()` returned `true` when `hasContract: false`.
- Agent Forge failed because `publishAgentPackage(state, 'pkg-no-contract', 'public')` returned a public package instead of throwing.
- Agent Forge failed because `listVisibleAgentPackages()` returned `pkg-private-owner` to `viewerUserId: user-other` in the same team.

Summary: `11 pass`, `3 fail`, `23 expect() calls`.

`bun test packages/shared/src/workbench/__tests__/experience-layer-security.test.ts`

- Shared guard failed because a runtime-malformed call with only `promptInjectionWarnings: []` returned `true`.

Summary: `6 pass`, `1 fail`, `8 expect() calls`.

`bun test packages/shared/src/workbench/__tests__/experience-layer-security.test.ts apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx packages/server-core/src/webui/__tests__/team-chat-http.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`

- Team invite route failed because `{ role: "owner" }` returned `201` instead of `400`.
- Team chat route failed because an Alpha team message could spoof a Beta team `workspaceId` and returned `201` instead of `403`.

Summary: `32 pass`, `2 fail`, `165 expect() calls`.

`bun run typecheck:shared`

- Failed after adding the runtime-malformed guard test because TypeScript required the malformed value to be cast through `unknown` before calling the strict function signature.

## 6. Implementation changes

- Exported `@craft-agent/shared/workbench/experience-layer-security` so Electron state code can use the same security guard as shared tests.
- Made `assertPublicPackagePublishable()` require explicit contract, reviewer, passing-test, and trust-score evidence. Missing or failing evidence now blocks public publish instead of being treated as "not checked".
- Wired Agent Forge public publish through the shared guard. Public publish now requires contract evidence, review count, passing test count, prompt-injection clearance, and trust score >= 50.
- Preserved the existing prompt-injection block, with the canonical message `Prompt injection warnings block public package publish.`
- Scoped private user-owned agent packages to `viewerUserId` instead of leaking them to every member of the same team.
- Added runtime invite role parsing in the account HTTP route. `admin`, `member`, and `viewer` remain valid invite roles; `owner`, unknown strings, and non-strings return `400`.
- Added team-chat workspace access validation when `accountCloudWorkspaceStore` is configured. POST/GET requests now reject foreign `workspaceId` values and foreign workspace refs with `403`.
- Kept legacy local team-chat tests permissive when no cloud workspace store is configured, so embedded/local usage without managed workspaces is not broken by the hardening pass.

## 7. Validation commands run

- `bun test packages/shared/src/workbench/__tests__/experience-layer-security.test.ts apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx packages/server-core/src/webui/__tests__/team-chat-http.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`
- `bun test packages/server-core/src/webui/__tests__/account-teams.test.ts packages/server-core/src/webui/__tests__/team-chat.test.ts packages/server-core/src/webui/__tests__/account-ledger.test.ts packages/server-core/src/webui/__tests__/account-billing.test.ts packages/server-core/src/webui/__tests__/account-session-boundary.test.ts packages/server-core/src/storage/__tests__/object-storage.test.ts packages/shared/src/workbench/__tests__/validation-gates.test.ts packages/shared/src/workbench/__tests__/tdd-task-generator.test.ts`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run lint:electron`
- `bun run validate:agent-contract`
- `git diff --check`
- `bun run electron:smoke`
- `bun audit`

## 8. Passing test output summary

- Targeted T038 suite: `34 pass`, `0 fail`, `175 expect() calls`, `4 files`.
- Security/regression suite: `35 pass`, `0 fail`, `125 expect() calls`, `8 files`.
- `bun run typecheck:shared`: pass after strict guard signature and malformed-test cast.
- `bun run typecheck:electron`: pass.
- `cd packages/server-core && bun run tsc --noEmit`: pass.
- `bun run lint:electron`: pass.
- `bun run validate:agent-contract`: `[agent-contract] ok: 11 skills, 48 tickets, 7 required docs`.
- `git diff --check`: pass.

## 9. Build output summary

- `bun run electron:smoke` rebuilt main, preload, renderer, resources, and assets, initialized the Electron main process, started the ROX server, then exited through the smoke `exit-on-ready` path.
- Final smoke evidence: `[smoke] Electron headless startup passed`.
- Non-blocking build warnings remain from existing surfaces: Vite `outDir` warning, Jotai Babel deprecation warnings, and large chunk warnings.

## 10. Remaining risks

- `bun audit` still fails with `103 vulnerabilities (4 critical, 47 high, 47 moderate, 5 low)`. This is a dependency-remediation lane, not solved by the focused app-layer hardening in T038.
- Critical audit examples include `basic-ftp`, `protobufjs`, `xmldom`, and `node-tesseract-ocr`; high examples include `@hono/node-server`, `hono`, `undici`, `minimatch`, `axios`, `xlsx`, and `fast-xml-parser`.
- Public marketplace remains intentionally out of scope; T038 hardens team/private registry and public-publish preconditions only.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Public package publish cannot bypass contract/review/test/trust requirements | Pass | Shared + Agent Forge targeted tests |
| Prompt injection warnings still block public publish | Pass | Shared + Agent Forge targeted tests |
| Private user-owned packages are visible only to their owner | Pass | Agent Forge targeted test |
| Team package visibility remains tenant-scoped | Pass | Existing Agent Forge cross-tenant test |
| Team chat cannot spoof workspace IDs or refs across teams | Pass | Team chat HTTP hardening test |
| Team invite roles are runtime-validated | Pass | Account HTTP invalid-role tests |
| Tests pass | Pass | Targeted `34 pass`; regression `35 pass` |
| Typecheck/lint/smoke validation passes | Pass | Shared/electron/server typechecks, electron lint, agent contract, diff check, electron smoke |
| Dependency audit is recorded | Pass with risk | `bun audit` fails with 103 known dependency vulnerabilities |
| Worklog complete | Pass | This file |
| Scoped Lore commit exists | Pending until commit | Commit will include only T038 files |
