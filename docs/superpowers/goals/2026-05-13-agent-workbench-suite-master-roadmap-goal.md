# Codex `/goal` — Agent Workbench Suite Master Roadmap

> **SUPERSEDED for the global picture by the spine roadmap:**
> [`2026-05-13-rox-one-v1-end-to-end-spine-goal.md`](./2026-05-13-rox-one-v1-end-to-end-spine-goal.md).
>
> This file remains the canonical *phase-detail* reference for master-roadmap
> phases **M.1 through M.21**. The spine document owns sequencing, dependencies,
> the unified ticket schema, and Lane P (post-release). Codex should invoke the
> spine and let it dispatch to the phase-detail files as needed.

**Date:** 2026-05-13
**Author:** Architecture lane (post C.4 land)
**Successor of:** `docs/superpowers/goals/2026-05-10-c4-multi-tenant-storage-isolation-goal.md`
**Audience:** Codex CLI in autonomous `/goal` mode

## Mega-Objective

Drive the entire **Agent Workbench Suite** (the ROX.ONE white-label Craft Agents fork) from the current post-C.4 state to a tagged, signed, shippable **v1.0.0 release candidate** that satisfies every "Definition Of Done" criterion in `plan.md §2`. Each phase below is *in scope* — execute them in order, gate each one with its own evidence, then proceed. Stop only when the global stopping condition at the end is met or when one of the *Stop and ask* triggers fires.

## Read first (once, before phase 1)

1. `AGENTS.md` — operating contract (TDD loop, ticket+worklog discipline, 11-section worklog, Lore commit protocol, Definition of Done).
2. `plan.md` — the canonical product plan: target product, North Star (VDI), Definition of Done in §2, parallel lanes in §17.
3. `docs/release/` — current release notes, known limitations, evidence reconciliation conventions.
4. `docs/superpowers/specs/` and `docs/superpowers/plans/` — design and implementation plan conventions; these directories receive new artifacts.
5. `docs/decision-records/audit-harness/` — ADR series (0002–0007 already exist; new ADRs are added under this directory).
6. `docs/tickets/README.md` and `docs/tickets/TEMPLATE.md` — ticket discipline + template.
7. `.swarm/inventory.md` and `.swarm/backlog-status.md` — backlog source of truth.

## Discipline (inherited from `AGENTS.md`, applies to every phase)

- One ticket per logical change in `docs/tickets/<TASK>.md` (use the next free number; T213+ is the open range).
- One worklog per ticket in `docs/worklog/<TASK>.md`, following the **11-section format** (summary, repo context, files inspected, tests added first, expected failing test output, implementation changes, validation commands, passing test output, build output, remaining risks, acceptance criteria matrix).
- **TDD-first**: red test → confirm failure for the right reason → minimal implementation → targeted validation → relevant build → worklog → commit.
- Atomic commits using the repository's Lore commit protocol; one ticket = one commit (or one tight series tagged in the worklog).
- **No direct `main` pushes after this roadmap starts.** Each phase opens a feature branch named `feat/<phase-key>-<slug>` (or `fix/`, `chore/`, `refactor/`, `docs/`), pushes the branch, and opens a PR via `gh pr create`. PRs merge into `main` only after the phase's stopping condition is green. The single C.4 direct push (2026-05-13) was a one-time exception and is not the new norm.
- Use the explorer-subagent pattern when entering an unfamiliar surface; do not modify unrelated runtime files.
- Stay inside the per-phase boundary. Any cross-phase change that cannot be deferred → write a new ticket, pause, and resume the original phase.

## Global validation matrix (each phase must run before claiming green)

- `bun test <new + impacted test files>`
- `bun run typecheck`
- `bun run lint`
- `bun test` (full suite) when the phase changed runtime code; documentation-only phases skip the full suite but still run targeted tests.
- `bun run build` when the phase changed source/runtime behavior.
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`

The roadmap **stops** for human review any time a global gate regresses by more than 1 test relative to the previous green baseline.

## Step zero (do this once before phase 1)

```bash
git -C . fetch origin
git -C . switch main
git -C . pull --ff-only origin main
git -C . log --oneline -5
```

Confirm `HEAD` is at `e010065 Close C4 validation records after the green matrix` (or newer if other lanes have landed work). If not, **stop and report**.

Then check ticket status for every ticket referenced below by reading `Status:` line in each `docs/tickets/T###-*.md` file. Anything already marked `Status: DONE` with a matching worklog and commit evidence: skip the corresponding phase, note "already DONE — verified at commit `<sha>`" in this roadmap's running log, and proceed to the next phase.

---

# Phase 1 — Complete the C.4 follow-ons

The C.4 design spec deferred six concrete follow-ups. They are all in scope now.

### Phase 1.1 — Migrate the remaining `workspace.ts` RPC handlers through `deriveScopeFromAuth`

- **Read first:** `packages/server-core/src/handlers/rpc/workspace.ts` (every `// TODO(C4): use deriveScopeFromAuth when ready` marker); `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`; `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts` (the child-process test pattern).
- **New ticket:** `T213-c4-workspace-rpc-full-scope-migration`.
- **Work breakdown:**
  1. Author the ticket + 11-section worklog.
  2. For each `TODO(C4)` marker, write a failing child-process integration test (one scenario per handler: flat read, tenant read, forgery rejection). Reuse the `runWorkspaceScenario(...)` harness pattern from T206.
  3. Replace each `DEFAULT_LOCAL_SCOPE` site with `deriveScopeFromAuth(ctx)`-derived scope; remove the `TODO(C4)` marker.
  4. Delete the `// TODO(C4): use deriveScopeFromAuth when ready` comments.
- **Validation:** targeted tests + `cd packages/server-core && bunx tsc --noEmit` + full `bun test`.
- **Stopping condition:** zero `TODO(C4)` markers remain in `workspace.ts`; all new tests green; full suite green.

### Phase 1.2 — Migrate `apps/electron/src/main/handlers/*` to scoped storage

- **Read first:** `apps/electron/src/main/handlers/*` files; ADR 0005 §"Caller migration"; `packages/shared/src/config/storage-scope-auth.ts`.
- **New ticket:** `T214-c4-electron-main-handlers-scope-migration`.
- **Work breakdown:**
  1. Map every storage submodule call site in `apps/electron/src/main/handlers/*` (read-only explorer subagent).
  2. For each handler that carries a session context, derive scope via `deriveScopeFromAuth` against the session passed in IPC.
  3. For genuinely headless handlers, leave `DEFAULT_LOCAL_SCOPE` explicitly and document the reason in the worklog.
  4. Add integration tests that prove a multi-tenant runtime ($\texttt{ROX\_MULTI\_TENANT=1}$) routes the handler through tenant-prefixed storage.
- **Validation:** Electron typecheck + `bun test apps/electron/src/main/handlers/__tests__/**` + full suite.
- **Stopping condition:** every session-carrying handler uses `deriveScopeFromAuth`; headless exceptions are documented; tests prove tenant routing in multi-tenant mode.

### Phase 1.3 — Pi-agent-server IPC scope propagation

- **Read first:** `packages/server-core/src/sessions/SessionManager.ts`; the Pi subprocess bootstrap; ADR 0007 §"Out of scope" → Pi IPC propagation entry.
- **New spec + plan:** `docs/superpowers/specs/2026-05-14-pi-ipc-scope-propagation-design.md` and `docs/superpowers/plans/2026-05-14-pi-ipc-scope-propagation.md` (use the same shape as the C.4 design/plan).
- **New ticket:** `T216-pi-ipc-scope-propagation`.
- **Work breakdown:**
  1. Decide serialization: branded scope is opaque, so propagate the *inputs* (`requestedWorkspaceId` + `permittedWorkspaces`) and re-mint via `deriveScopeFromAuth` on the Pi side after a session handshake. The Pi subprocess imports `storage-scope-auth.ts` directly (single in-process trust boundary remains intact because each Pi process has its own auth context).
  2. Add a Pi-side `bootstrapScope(sessionEnvelope)` helper that mints the branded scope after validating envelope integrity (signed by the parent or scoped by a one-time secret).
  3. Update IPC envelopes to carry the auth context.
  4. Tests: round-trip a tenant scope through the IPC; forgery attempts via crafted envelopes must reject.
- **Validation:** targeted tests + typecheck + full suite + manual smoke of a Pi-backed agent session under `ROX_MULTI_TENANT=1`.
- **Stopping condition:** scope minted in the parent matches the resolved storage root on the Pi side; forgery attempts are rejected with audit emission; smoke passes.

### Phase 1.4 — Per-tenant credential key derivation

- **Read first:** `packages/shared/src/credentials/manager.ts`; ADR 0007 §"Out of scope" → credential key derivation; ADR 0005 §"Tenant-scoped credential namespaces".
- **New spec + plan:** `docs/superpowers/specs/2026-05-15-tenant-credential-key-derivation-design.md` + matching plan file.
- **New ticket:** `T217-tenant-credential-key-derivation`.
- **Work breakdown:**
  1. Define a per-tenant KDF: `tenantKey = HKDF(masterKey, salt=workspaceId, info="rox.credentials.v1")`. Keep `local-single-user` keyed by the existing master key (zero migration for single-user installs).
  2. Wrap credential read/write with a tenant-aware envelope that includes a KDF version field for future rotation.
  3. Provide a migration path: when the operator flips $\texttt{ROX\_MULTI\_TENANT=1}$, existing credentials remain readable; new writes use the tenant key.
  4. Audit events: credential read/write under tenant scope emits at trace level.
- **Validation:** targeted tests for both modes; `bun test packages/shared/src/credentials/__tests__/*`; full suite; build.
- **Stopping condition:** tenant A cannot decrypt tenant B credentials even with disk access; single-user installs are unchanged; KDF version field is in place.

### Phase 1.5 — Queryable audit storage backend

- **Read first:** ADR 0007 §"Out of scope" → queryable audit storage; current structured logger event surface (`packages/shared/src/utils/debug.ts`).
- **New spec + plan + ADR:** `2026-05-16-audit-storage-backend-design.md` + plan + `0008-audit-storage-backend.md`.
- **New tickets:** `T218-audit-storage-schema`, `T219-audit-event-writer`, `T220-audit-event-query-api`, `T221-audit-event-retention-policy`.
- **Work breakdown:**
  1. Append-only audit table with columns: `event_id, ts, actor, tenant_id, event_type, severity, payload_json, request_id`.
  2. Writer fanout: existing structured logger calls **plus** persistent append (configurable via `ROX_AUDIT_BACKEND={memory|file|sqlite|s3}`).
  3. Query API for admin UI: filter by tenant, actor, event type, time range.
  4. Retention policy with explicit `retention_days` per event type; tamper-evident hashing for compliance use.
- **Validation:** targeted tests per ticket; full suite; admin UI smoke that fetches recent audit events.
- **Stopping condition:** every `scope.*` event from C.4 is queryable; retention/rotation works; tests prove tamper-evidence chain.

### Phase 1.6 — Multi-tenant data migration tooling

- **Read first:** ADR 0007 §"Out of scope" → data migration tooling.
- **New ticket:** `T222-multi-tenant-data-migration-tool`.
- **Work breakdown:**
  1. CLI `bun run migrate:multi-tenant -- --tenant <id> --from flat --to tenant-prefixed --dry-run|--apply`.
  2. Pre-flight: verify free disk, lock the config directory, snapshot via `cp -a`.
  3. Migrate per file class (config, credentials, drafts, themes, workspaces, conversations, llm-connections, tool-icons) in deterministic order; verify per-file checksums before/after.
  4. Idempotent: rerunning is a no-op when destination already exists.
  5. Rollback: `--rollback <tenant>` restores from the snapshot.
- **Validation:** unit tests with temp directories; integration test that migrates a fixture; full suite; build.
- **Stopping condition:** migration is reversible, checksummed, idempotent, and tested.

### Phase 1 closeout

After 1.1 → 1.6: write `docs/worklog/T223-c4-followups-closeout.md` summarizing all six follow-ons with commit SHAs, then update ADR 0007 to mark these items implemented (not deferred).

---

# Phase 2 — RBAC slice (the consumer of C.4)

Phase 1 left `session.permittedWorkspaces` consumed but not produced. Phase 2 produces it.

### Read first

- `docs/tickets/T021-team-invites-rbac.md` (existing ticket; verify status).
- `docs/tickets/T035-team-workspace-sharing.md`.
- `packages/server-core/src/handlers/rpc/account-ownership.ts`.
- `packages/server-core/src/accounts/AccountStore.ts` (`listWorkspaceIds(userId)` is consumed by `deriveScopeFromAuth`).

### New ticket cluster

- `T224-rbac-roles-schema` — data model for roles, role-bindings, role grants.
- `T225-rbac-policy-engine` — pure-function policy evaluator (`canRead`, `canWrite`, `canAdmin` per resource × actor).
- `T226-rbac-session-permitted-workspaces` — populate `session.permittedWorkspaces` from RBAC policy.
- `T227-rbac-admin-rpc` — RPC handlers for role CRUD, role binding, role grants.
- `T228-rbac-admin-ui` — admin screens to manage roles and team memberships.
- `T229-rbac-integration-tests` — end-to-end RBAC: invite → role grant → workspace access → revoke → loss of access.
- `T230-rbac-adr` — `0009-rbac-policy.md`.

### Work breakdown

1. Schema: `roles(id, name, description, system_managed)`, `role_grants(role_id, actor_kind, actor_id, scope_kind, scope_id)`. System-managed roles: `owner`, `editor`, `viewer`.
2. Policy engine receives `(actor, action, resource)` and returns `{allow|deny, reason}`. Pure function, no I/O, exhaustively unit-tested.
3. Plug policy into the demo `deriveScopeFromAuth` path: `permittedWorkspaces` becomes `policyEngine.permittedWorkspaces(session.userId)`.
4. RPC: `roles.list`, `roles.create`, `roles.grant`, `roles.revoke`. Server-side guards: only owners can grant; revocation invalidates active sessions.
5. UI: settings → "Team & permissions" tab. Reuses existing form primitives.
6. Tests: each phase ticket gets unit + RPC integration; T229 ties them together with a real workspace lifecycle.
7. ADR records the policy model, why a pure-function engine, and the migration path from C.4's "always permit" stub.

### Validation per ticket

`bun test packages/server-core/src/handlers/rpc/__tests__/roles*.test.ts` + `bun test packages/shared/src/auth/__tests__/policy*.test.ts` + UI test under `apps/electron/src/renderer/components/settings/__tests__/**`.

### Stopping condition

T229's end-to-end test runs green; revoking a role removes workspace access within one request; ADR 0009 is committed; the C.4 "always permit" stub is replaced by the RBAC policy engine.

---

# Phase 3 — Upstream merge to v0.9.3

`plan.md §6` set this against v0.9.1, but upstream is now at v0.9.3 (2026-05-11). Bump the target.

### Read first

- `docs/tickets/T061-upstream-v0.9.1-merge-plan.md` and `T062-upstream-v0.9.1-merge-implementation.md` (revise dates and target tag).
- `plan.md §6.2` (Protected ROX-Owned Surfaces).
- The diff between `v0.8.12` (current local base) and `v0.9.3`.

### Updated ticket cluster

- `T231-upstream-v0.9.3-merge-plan` (supersedes T061's v0.9.1 target).
- `T232-upstream-v0.9.3-merge-implementation` (supersedes T062).
- `T233-upstream-v0.9.3-merge-evidence-log` — captures conflict resolution choices.

### Remote setup

```bash
git remote add upstream https://github.com/craft-ai-agents/craft-agents-oss.git || true
git fetch upstream --tags
git switch -c chore/upstream-v0.9.3-rox-merge
```

### Work breakdown

1. Generate `git diff --stat v0.8.12..upstream/v0.9.3` and classify each touched file as **ROX-owned** (per `plan.md §6.2`) vs **upstream-owned**.
2. Build the protected-file conflict map. For every protected file, capture the upstream change as a diff, then re-apply manually on top of the ROX version.
3. Merge in order: dependency updates → upstream bugfixes → session/auth changes → shell/renderer changes.
4. Re-run the merge gate from `plan.md §6.4`.
5. Smoke: Electron app starts, login persists, one mission runs to completion.

### Validation

The full `plan.md §6.4` merge gate, plus phase-1 multi-tenant tests, plus phase-2 RBAC tests must remain green.

### Stopping condition

Local `main` (via merge PR) carries upstream v0.9.3's behavior changes; protected ROX surfaces are intact; CI gate is green; bump `package.json.version` to track upstream.

---

# Phase 4 — Account persistent session storage (T063)

### Read first

- `docs/tickets/T063-account-persistent-session-storage.md` (verify status; the canonical ticket exists).
- `apps/electron/src/main/account-api.ts` and the surrounding session-handling code.
- Electron `safeStorage` docs and the OS keychain fallback paths.

### Work breakdown (already laid out in `plan.md §7`)

1. Capture `rox_session` post-login/register.
2. Encrypt via Electron `safeStorage` and persist under `app.getPath('userData')/session.enc`.
3. Hydrate on app start; verify with `/api/account/me`; clear on logout or decrypt failure.
4. Add a fakes-only integration test (no real ROX API).

### Validation

`bun test apps/electron/src/main/__tests__/account-session*.test.ts` + Electron smoke (login → restart → still logged in → logout → restart → logged out).

### Stopping condition

App restart preserves login; logout fully clears the encrypted blob; corrupted session blob fails closed; T063 ticket flips to `Status: DONE`.

---

# Phase 5 — Public share shortlink (T064)

### Read first

- `docs/tickets/T064-public-share-shortlink-provider.md` and `T084-public-share-shortlink-production-contract.md`.
- `plan.md §8` (the full T064 plan).

### Work breakdown

1. Verify the remote viewer endpoint; document the auth contract.
2. Add a deterministic fake share provider (used in tests).
3. Production upload: retry, error-state UI (copying, copied, expired, failed, auth-required), server-side shortlink model.
4. Make sure the public payload **never** contains the session token or any tenant-bearing secret.

### Validation

Targeted tests + Electron UI E2E for the share flow.

### Stopping condition

Real public URL is created; failure paths are specific; no secret leakage; both T064 and T084 flip to `Status: DONE`.

---

# Phase 6 — Production persistence adapter (T065)

### Read first

`plan.md §9`; existing in-memory stores in `packages/server-core/src/accounts/`, `.../teams/`, `.../billing/`, `.../sync/`, `.../missions/`, `.../audit/`.

### Work breakdown

1. Define the **adapter interface** for each surface (users, sessions, teams, members, invites, spaces, workspaces, workspace_members, ledger_entries, storage_objects, sync_snapshots, sync_operations, mission_runs, mission_checkpoints, agent_packages, quest_progress, audit_events). Use a single `PersistenceAdapter<T>` shape.
2. Fake implementation with contract tests (this is what stays in tests forever).
3. Production implementation backed by SQLite for desktop and Postgres for cloud — both behind the same interface.
4. Migration runner with `up`/`down` (per CLAUDE.md `<data_integrity>` rules).
5. Money as integer cents, UUID v7 IDs, UTC timestamps, soft-delete `deleted_at`, audit-log mutations.

### Validation

`bun test packages/server-core/src/**/__tests__/persistence-adapter*.test.ts` + Electron smoke.

### Stopping condition

Every persistence surface has a working fake **and** a working production adapter, both passing the same contract suite; migrations are reversible.

---

# Phase 7 — Real provider orchestration (T067)

### Read first

`plan.md §11`; existing demo shells under `packages/shared/src/agent/backend/`.

### Work breakdown

1. Provider taxonomy: LLM, browser research, object storage, email, billing, shortlink, scheduler, agent package registry.
2. Every real provider needs a fake with identical contract tests.
3. Wire production providers behind feature flags; document required env vars in `.env.example`.

### Validation

`bun test packages/shared/src/agent/backend/__tests__/**` plus targeted provider tests.

### Stopping condition

For every production provider, a green contract suite passes against **both** the fake and the real implementation; T067 flips to `Status: DONE`.

---

# Phase 8 — Durable mission scheduler (T066)

### Read first

`plan.md §10`; `docs/tickets/T049-long-running-mission-scheduler-adapter.md`; existing scheduler implementation.

### Work breakdown

1. Mission state machine `draft → queued → running → blocked/completed/failed/cancelled` persisted via the Phase 6 adapter.
2. Worker model: a single in-process supervisor on desktop; pluggable to a distributed worker pool on cloud.
3. Checkpoint cadence with deterministic test clock.
4. Budget/capacity guards before each branch; human approval gates block expensive expansions.
5. **Final mission status depends on validation evidence, not elapsed time** (this is a DoD criterion).

### Validation

`bun test packages/server-core/src/missions/__tests__/**` + an integration test that simulates a 1-second-mapped 24h mission with state survival across worker restart.

### Stopping condition

Restart preserves mission state; 24h/72h missions pass simulated time; budget gates enforce; T066 flips to `Status: DONE`.

---

# Phase 9 — Experience Layer real-state binding (T068, T074–T080)

### Read first

`docs/tickets/T068`, `T074`, `T075`, `T076`, `T077`, `T078`, `T079`, `T080`; `docs/experience-tabs-sessions-skills.md`; existing Experience screens under `apps/electron/src/renderer/components/workbench/`.

### Work breakdown

1. **T074** — Experience Runtime Store + Event Bus: single source of truth for mission state, VDI, quest progress, agent packages.
2. **T075** — Deep Missions Launch Flow: real form, real submit, real persisted mission run.
3. **T076** — Mission Control Live Scheduler Binding: stream checkpoint events into the UI.
4. **T077** — Global VDI / Quality Score / Execution Readiness / Quest Engine: implement the North Star metric and submetrics from `plan.md §1`.
5. **T078** — Agent Arena + Agent Forge Real Actions: install/fork/permission/visibility actions hit real adapters.
6. **T079** — Mission Mode Prompt Registry + Provider Orchestration: command/game/arena mode switches presentation only; underlying truth stays shared.
7. **T080** — Global Experience HUD: app-wide HUD reads from the Runtime Store.
8. **T068** — wraps and verifies real-state binding across all surfaces.

### Validation

`bun test apps/electron/src/renderer/components/workbench/**/__tests__/**` + Electron smoke covering each Experience tab.

### Stopping condition

Every Experience tab reads from and writes to the Runtime Store; no demo shell remains; VDI updates in real time as missions progress; all referenced tickets flip to `Status: DONE`.

---

# Phase 10 — Composer Pillar 4

### Read first

`docs/tickets/T180`..`T199`; Pillar 3 closed at T199. Pillar 4 continues the same shape.

### Work breakdown (illustrative cluster; refine before authoring tickets)

- `T234-composer-pillar-4-spec` — design doc for Pillar 4 scope: emphasis modes, multi-line affordances, slash-mention surface, attachment polish, paste-image dialog.
- `T235`..`T241` — per-affordance tickets, each with the same A11y + RTL + animation + visual polish layers used in Pillar 3.
- Pillar 4 closeout ticket with the audit-criteria matrix.

### Validation

`bun test apps/electron/src/renderer/components/composer/**/__tests__/**` + RTL coverage + axe-core checks + visual diff (when set up in Phase 16).

### Stopping condition

Every Pillar 4 ticket lands with passing tests; closeout matrix is green; no new dead-CSS classes.

---

# Phase 11 — F.1 Shiki migration

### Read first

The F.1 Shiki research doc (committed in commit `09c5fc1 docs(audit): F.1 shiki migration research doc — A/B/C options laid out`).

### Work breakdown

1. Pick one option (A, B, or C) based on bundle-size budget and grammar coverage; record the decision in `0010-shiki-highlighter.md`.
2. Author `T242-shiki-migration-plan` and `T243-shiki-migration-implementation`.
3. Replace the current highlighter behind a small `Highlighter` adapter so the renderer surface does not change.
4. Add a contract test that captures the rendered HTML for 20 representative code samples (sanity for tokenizer differences).

### Validation

Targeted highlighter tests + bundle-size regression check + visual smoke on the markdown/code surfaces.

### Stopping condition

Old highlighter removed; bundle does not exceed the Phase 17 performance budget; ADR 0010 committed.

---

# Phase 12 — Visual polish v2 (T069 + T081)

### Read first

`plan.md §13`; `docs/tickets/T069-visual-polish-v2.md`; `docs/tickets/T081-visual-polish-motion-states-ux-coherence.md`.

### Work breakdown

For each screen in the `plan.md §13` list (Composer, Prompt Lab, Spec Builder, Review Gate, Account, Deep Missions, Arena Builder, Mission Control, Progression, Quest Map, Agent Forge): typography scale, color hierarchy, grid rhythm, loading/skeleton/empty/error states, hover/focus/selected/disabled states, motion only where it clarifies progress. Use the Phase 16 visual-diff harness to catch regressions.

### Stopping condition

Every screen has the full state matrix; visual diffs are stable; T069 and T081 flip to `Status: DONE`.

---

# Phase 13 — Security and abuse hardening (T038, T052, T071, T086)

### Read first

`plan.md §15`; `docs/tickets/T038`, `T052`, `T071`, `T086`; the existing Risk Register (T104, T109, T111, T121).

### Work breakdown

1. **Tenant isolation** — already enforced by C.4 + Phase 1. Add a property-based test that randomly forges scopes and asserts the brand registry rejects them.
2. **Workspace RBAC** — covered by Phase 2; add penetration-style cross-tenant access tests.
3. **Team package visibility** — Agent Forge packages respect visibility flags.
4. **Ledger spoofing** — billing ledger writes are signed; verifier rejects unsigned mutations.
5. **Quota bypass** — storage and mission quotas enforced server-side, with a regression test that tries to bypass via direct API call.
6. **Shortlink payload leakage** — Phase 5 covers the format; add a fuzz test that scans uploaded payloads for known secret patterns.
7. **Prompt-injection package scan** — packages installed from the registry get scanned for prompt-injection markers; flagged packages require explicit user approval.
8. **Mission budget bypass** — Phase 8 covers the gate; add an attempt that creates "free" follow-up missions to bypass budget.
9. **Paid entitlement bypass** — paid capacity increases limits only; never satisfies quality gates.
10. **Secret redaction** — `pino` redactor scrub paths cover credentials, tokens, env vars; CI test asserts no secret leaks in logs.
11. **Sync conflict overwrite** — explicit conflict UI, no silent overwrite.
12. **CSP** — strict `Content-Security-Policy`; no `unsafe-inline` without nonces.
13. **Input validation at boundaries** — Zod schemas at every RPC and HTTP boundary.
14. **Container rootless** — Docker image runs as non-root user.
15. **Secret-leak scan in CI** — trufflehog or gitleaks integrated into Phase 18 CI/CD.

### New tickets

`T244-property-based-scope-forgery-tests`, `T245-cross-tenant-pentest-suite`, `T246-ledger-signature-verifier`, `T247-quota-bypass-regression`, `T248-prompt-injection-package-scanner`, `T249-mission-budget-bypass-regression`, `T250-pino-redactor-coverage`, `T251-csp-strict-with-nonces`, `T252-zod-boundary-validation-sweep`.

### Validation

`bun test packages/shared/src/**/__tests__/security*.test.ts` + a full security-test job in Phase 18 CI.

### Stopping condition

Every security test in the new ticket cluster passes; T038/T052/T071/T086 flip to `Status: DONE`; the Accepted Risk Register (T109/T111) reflects current reality.

---

# Phase 14 — Observability and audit trail (T039)

### Read first

`docs/tickets/T039-observability-audit-trail.md`; the Phase 1.5 audit storage backend.

### Work breakdown

1. Structured logger taxonomy: `session.*`, `mission.*`, `scope.*`, `auth.*`, `billing.*`, `quota.*`, `pkg.*`.
2. Distributed tracing across the Electron main ↔ webui ↔ Pi subprocess boundary (OpenTelemetry-compatible).
3. Per-request correlation IDs propagated through every RPC/HTTP/IPC envelope.
4. Admin UI panel reads from the Phase 1.5 audit store.
5. Alert rules: per-tenant error-rate threshold, per-tenant cost threshold, scope-forgery rate threshold.

### Stopping condition

Every emitted log carries a request ID; admin UI shows the recent audit trail; alert rules are testable; T039 flips to `Status: DONE`.

---

# Phase 15 — Test stabilization + E2E suites (T034, T051, T082, plus broader stabilization)

### Read first

`docs/tickets/T034-e2e-core-scenario-suite.md`; `T051-experience-layer-e2e-scenario.md`; `T082-e2e-experience-journey.md`; existing Playwright/Electron E2E harness under `apps/electron/src/__e2e__/` (if present) or `packages/e2e/` (if present).

### Work breakdown

1. Identify any remaining flaky tests; harden them with deterministic clocks, fixed seeds, child-process isolation (the same pattern T206 used).
2. Build the **E2E Core Scenario Suite** (T034) covering the ten release-candidate scenarios in `plan.md §16`.
3. **Experience Layer E2E** (T051) — workspace creation → mission run → checkpoint → final verification.
4. **E2E Experience Journey** (T082) — full user lifecycle from registration to release-candidate validation scenario #2.
5. Visual diff harness: snapshot every primary screen in dark + light + reduced-motion + high-contrast.
6. Add an `e2e:smoke` script that runs the ten release scenarios in < 10 minutes.

### Validation

`bun run e2e:smoke` green; `bun run e2e:core` green; full suite stable across three consecutive runs.

### Stopping condition

E2E gate is reproducible; T034/T051/T082 flip to `Status: DONE`.

---

# Phase 16 — Bundle and performance budget (T092, T118, T124)

### Read first

`docs/tickets/T092-bundle-performance-budget.md`; `T118-inputcontainer-rollup-circular-chunk.md`; `T124-bundle-policy-gate.md`.

### Work breakdown

1. Pin the per-route JS budget at ≤ 200 KB gzipped per CLAUDE.md `<code_quality>`.
2. LCP ≤ 2.5 s, INP ≤ 200 ms — measured in the Playwright Lighthouse run.
3. Resolve the InputContainer circular-chunk warning.
4. Bundle policy gate as a CI step.
5. Tree-shake unused locales and unused providers in the Electron build.

### Stopping condition

Bundle and performance metrics are within budget on every CI run; T092/T118/T124 flip to `Status: DONE`.

---

# Phase 17 — Private CI/CD release pipeline (T070, T085)

### Read first

`docs/tickets/T070-private-ci-cd-release-pipeline.md`; `T085-private-ci-cd-release-pipeline.md`.

### Work breakdown

1. GitHub Actions workflow: lint, typecheck, full unit tests, full E2E, docs validation, security scan (trufflehog or gitleaks), bundle policy gate, Mac ARM dev build.
2. Reproducible build: same lockfile produces identical output.
3. Release notes auto-generation from commit messages (Conventional Commits per CLAUDE.md `<git_and_versioning>`).
4. SBOM generation (CycloneDX) per CLAUDE.md `<release_and_supply_chain>`.
5. License compliance scan (deny GPL/AGPL in proprietary parts).
6. Private artifact upload to the canonical private GitHub release.

### Stopping condition

Every push to `main` produces a green pipeline with all artifacts; T070/T085 flip to `Status: DONE`.

---

# Phase 18 — Mac private release trust boundary (T121, T122)

### Read first

`docs/tickets/T121-mac-private-release-trust-boundary.md`; `T122-mac-arm-artifact-validator-upload-gate.md`; `T033-mac-arm-build.md`.

### Work breakdown

1. Code-sign the Mac ARM build with a Developer ID certificate (or document the self-signed path for private distribution).
2. Notarize the build.
3. Artifact validator: post-build, run `codesign --verify` and `spctl --assess` and gate the upload on success.
4. Verify the Liquid Glass icon contract from T116 stays green inside the packaged build.

### Stopping condition

Mac ARM build opens on a clean machine, passes Gatekeeper, smoke is green; T033/T121/T122 flip to `Status: DONE`.

---

# Phase 19 — Final RC documentation and build (T072, T087)

### Read first

`docs/tickets/T072-final-release-candidate.md`; `T087-final-product-rc-documentation-build.md`; `docs/release/` conventions.

### Work breakdown

1. User guide: every Experience tab, every action button, every Composer mode.
2. Admin guide: RBAC, audit trail, persistence backups, multi-tenant ops.
3. Known limitations: write them honestly; do not paper over.
4. Migration guide: how a single-user install moves to multi-tenant.
5. CHANGELOG.md covering every commit since `ac9bca2`.
6. Run release candidate scenarios 1–10 from `plan.md §16` manually; capture screenshots for the user guide.

### Stopping condition

Documentation passes a docs validation gate; manual RC scenarios all green; T072 and T087 flip to `Status: DONE`.

---

# Phase 20 — Release candidate validation

### Read first

`plan.md §16` (the ten release scenarios); `plan.md §17` (parallel lanes — used here only to ensure no lane left stale).

### Work breakdown

1. Run the ten release scenarios end-to-end on a clean machine.
2. Resolve any blockers under their own ticket+worklog before proceeding.
3. Update `docs/release/2026-05-XX-rc-evidence.md` with the run log and SHAs.
4. Open a single "RC sign-off" PR that updates `package.json.version` to `1.0.0-rc.1` and tags `v1.0.0-rc.1`.

### Stopping condition

Tag `v1.0.0-rc.1` exists; release evidence doc is complete; CI is green on the tag commit.

---

# Phase 21 — v1.0.0 release

### Work breakdown

1. Promote `v1.0.0-rc.1` to `v1.0.0` after a 72-hour soak window with no rollback signal.
2. Tag `v1.0.0`; push tag; create GitHub Release with notes generated from Phase 17 pipeline.
3. Notify; update README badges; archive the master roadmap into `docs/release/2026-05-XX-master-roadmap-closeout.md` with commit references.
4. Open the `v1.1.0` planning doc; do not close this `/goal` yet — the **Global stopping condition** below requires the release tag to be confirmed live.

### Stopping condition

`v1.0.0` tag is live on the canonical remote; release notes are published; CHANGELOG.md is updated; soak window passed without rollback.

---

# Global stopping condition

All of the following hold simultaneously:

1. Every phase above has its closeout ticket marked `Status: DONE` with matching worklog and commit SHA.
2. Every existing `docs/tickets/T0XX-*.md` referenced in this roadmap is `Status: DONE`.
3. `bun run typecheck`, `bun run lint`, full `bun test`, `bun run e2e:core`, `bun run validate:docs`, `bun run validate:agent-contract`, and `bun run build` are all green on the `v1.0.0` tag commit.
4. The ten release-candidate scenarios in `plan.md §16` have a live evidence trail.
5. `v1.0.0` tag is pushed to `origin` and a GitHub Release is published.
6. The closeout doc `docs/release/2026-05-XX-master-roadmap-closeout.md` lists every phase commit SHA, every closed ticket, and every accepted risk.

# Stop and ask if

- A phase's design spec is ambiguous and the in-repo plan does not resolve the ambiguity.
- A regression suite cannot be made deterministic inside the phase's allowed file boundary.
- Step zero fails (cannot fast-forward `main`).
- A production dependency or service credential is needed and not present in the environment.
- A merge conflict during Phase 3 (upstream merge) requires a human ROX-surface decision.
- Any security test in Phase 13 fails closed and the root cause is outside the phase's allowed boundary.
- A scenario in Phase 20 fails and the fix would expand the phase scope by more than three new tickets.
- The CLAUDE.md "no direct main pushes" rule conflicts with an immediate need; the answer is *always* "open a PR" unless a human turn-by-turn override is recorded.

# Operational notes

- Maintain a running log of phase-completion commit SHAs in `.swarm/master-roadmap-log.md`. After every phase, append: `<phase-key> | <head sha> | <ticket ids> | <utc timestamp>`.
- After Phase 1 closeout, after Phase 2 closeout, and after Phase 9 closeout, request a human checkpoint — these are the highest-risk gates.
- Long Bun commands (`bun test`, `bun run build`) should be started in background and monitored. Do not poll on a sleep loop.
- Every phase that touches the renderer must run an axe-core sweep before claiming green.
- Every phase that adds a new RPC must add the matching Zod schema at the handler boundary.
- Every phase that adds a new persistent column must ship a reversible migration with `up` and `down` and tests for both.

# Resumption protocol (if Codex is restarted mid-run)

1. Read `.swarm/master-roadmap-log.md`; the last appended line names the most recently completed phase.
2. Verify the listed commit SHA is reachable via `git log --oneline | grep <sha>`.
3. Re-run Step zero (fast-forward `main`).
4. Re-read this file and the next phase's *Read first* list.
5. Resume from the first phase whose closeout ticket is not yet `Status: DONE`.
