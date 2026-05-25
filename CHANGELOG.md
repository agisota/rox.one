# Changelog

All notable changes to ROX.ONE are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Phase keys reference `.swarm/master-roadmap-log.md` for commit-level
traceability.

---

## [1.0.7] — 2026-05-25

Wave 0 contract chain + Wave 1 module chain release. Comprehensive
data-contract scaffolds and module-layer foundations for downstream work.

### Added

- **WT-00** snapshot hygiene + scaffold-ownership validators + secrets rotation (#405)
- **WT-01** release pipeline + R2 mirror + CI caching (#406)
- **WT-02** ROX Design security/lifecycle hardening (#407)
- **WT-03** ROX Design TopBar UX + hotkey (#408)
- **WT-04** User + Identity data contract (#409)
- **WT-05** Tenant + Org data contract (#420)
- **WT-06** Workspace + Team data contract (#410)
- **WT-07** Entitlement + Feature flag registry (#411)
- **WT-08** Audit + Telemetry data contract (#412)
- **WT-09** Linear / Featurebase sync automation (#413)
- **WT-45** ModuleRegistry — typed ModuleDefinition + sidebar/routes/panels (#414)
- **WT-46** ContentObject + Block universal schema (#415)
- **WT-47** RelationService — typed bidirectional relations (#416)
- **WT-48** AIContextPacket builder (permission-filtered) (#417)
- **WT-49** ActivityEvent emission policy (extends WT-08 audit) (#418)
- **WT-50** SearchIndex — full-text + tag + relationship (#419)

### Fixed

- Pin `actions/github-script` to SHA in `wt-merge-gate.yml` (workflow-pins
  security policy) (#424)

### Changed

- Migrate per-WT scaffold READMEs from root `.wt-scaffold/README.md` to
  `.wt-scaffold/wt-NN/README.md` subfolders; resolves add/add merge conflicts
  across the Wave 0/1 PR chain. Updates `scripts/orchestrator/dispatch-wave-0.sh`
  accordingly (#425)

---

## [1.0.0] — TBD (after 72h soak)

The first stable ROX.ONE release. Built as a white-label fork of the
upstream Rox Agents OSS project (Apache 2.0; attribution preserved in
`LICENSE`, `NOTICE`, `TRADEMARK.md`, and the `Dockerfile.server` source
label).

### Added

#### Identity and rebrand (rebrand sweep phases R.0 – R.10)

- **R.0** Canonical inventory of legacy → canonical token mappings
  (T260, T261, T262).
- **R.1** Surface-text completion of user-facing renames (T263).
- **R.2** Code identifier renames across packages and apps (T264, T265,
  T266).
- **R.3** Asset and file renames (T267, T268).
- **R.4** Documentation and plan cleanup; legacy docs allowlisted as
  historical record (T269 – T272).
- **R.5** Package scope rename: `@rox-agent/*` → `@rox-one/*` across all
  workspace packages (T273 – T284).
- **R.6** Env-var shim — `ROX_*` accepted via `readEnv()` for one minor
  version; canonical `ROX_*` names introduced (T285 – T288).
- **R.7** Docker image rename `rox-agent-server` → `rox-one-server`; CI
  build pipeline updates (T289, T290, T291).
- **R.8** User-data migration shim copies `~/.rox-agent/` or `~/.rox/`
  to `~/.rox/` on first launch, idempotent and non-destructive (T292,
  T293, T294).
- **R.9** Community link audit and refresh (T295).
- **R.9.5** Allowlist expansion and final rebrand literal-text scrub
  (T298a, T299a, T300a).
- **R.10** Final rebrand sweep, permanent gate via `bun run
  validate:rebrand`, and `rebrand-v1` checkpoint tag (T296, T297).

#### Multi-tenant storage isolation (Phase 1.x / ADR 0007)

- Authenticated storage scope minting via `deriveScopeFromAuth(session,
  requestedWorkspaceId)`; renderer and webui inputs cannot mint scopes
  directly.
- `BrandedWorkspaceScope` nominal brand owned exclusively by
  `packages/shared/src/config/storage-scope-auth.ts`.
- `ROX_MULTI_TENANT=1` activation flag; default install remains
  single-user.
- Path-prefix tenant isolation under `<configDir>/tenants/<workspaceId>/`
  with audited downgrade on activation absence.
- Defense-in-depth runtime brand check (`BrandedScopeBreachError`).
- Per-tenant credential key derivation via HKDF over the local master
  key (T217); single-user credentials remain compatible.
- Pi-agent-server IPC scope propagation: the Pi subprocess re-mints
  authenticated scope locally and rejects forged envelopes (T215, T216;
  phase-1.3 commit `5e8b17a`).

#### Audit storage (Phase 1.x / ADR 0008)

- Append-only audit event store with structured-logger fanout and
  queryable API (T218 – T221).
- Retention policy with explicit evaluation per stored event.
- Coverage for factory downgrades, forgery rejection, workspace-scope
  runtime downgrades, scope-brand cast breaches, and tenant credential
  access signals.

#### RBAC foundation (Phase M.2)

- `RoleStore` and `GrantStore` with mutation API and resolver invalidation
  (M.2-foundation: T224, T225).
- RBAC policy engine wired into `session.permittedWorkspaces` (M.2 T226).
- `roles.ts` RPC handler module: list / create / grant / revoke (M.2
  T227).
- Scope kinds: `workspace` (resolved), `org` (wired, partial — see Known
  Limitations), `global` (resolved).
- Resolver is read-through; revocation propagates without restart.

#### Persistent sessions and headless server

- Headless WebSocket RPC surface on `packages/server`.
- Thin-client desktop mode via `ROX_SERVER_URL` / `ROX_SERVER_TOKEN`.
- TLS support (`wss://`) with cert/key/CA configuration.
- Docker image `rox-one-server` with bind-mounted `/root/.rox/` data
  volume.
- 21-step CLI integration test via `rox-cli --validate-server`.

#### CLI client (`apps/cli`)

- Self-contained `rox-cli run <prompt>` — spawns server, sends prompt,
  streams response, exits.
- Multi-provider support: `--provider anthropic | openai | google |
  openrouter | groq | mistral | xai | …` with `--model` and `--api-key`
  flags or per-provider env vars.
- Source enablement via `--source <slug>` (repeatable).
- Workspace registration via `--workspace-dir <path>`.
- `rox-cli` binary kept as an alias for one minor version (canonical
  `rox-cli` is planned for v1.1.x).

#### Composer and Mission Modes

- Three Experience Layers: `command`, `game`, `arena`
  (`packages/shared/src/workbench/experience-layer.ts`).
- Mission Mode prompt registry with failure-mode classification
  (`mission-mode-prompt-registry.ts`).
- Long-running missions with checkpoints, validation gates, and final
  artifact + passing-gate completion rule.

#### Skills and sources

- Workspace-scoped skills at `~/.rox/workspaces/<id>/skills/`.
- MCP source support (stdio + HTTP) with config-JSON paste-in.
- REST API sources (Gmail, Calendar, Drive, YouTube, Search Console,
  Slack, Microsoft 365).
- Local filesystem sources (Obsidian, Git repos).
- Encrypted source credentials via AES-256-GCM (`~/.rox/credentials.enc`).

#### Permission modes

- Three modes: Explore (`safe`), Ask to Edit (`ask`), Auto (`allow-all`).
- Per-session SHIFT+TAB cycling.
- Workspace-level permission rules.
- Skill permission contracts are additive (narrow only).

#### Public sharing

- Public shortlink generation with 24h / 7d / 30d / until-revoked expiry.
- Secret + file-content redaction on bundle creation.
- Best-effort adaptive media rendering in the public viewer.
- Revocation is immediate and irreversible.

#### Themes

- Cascading theme model: app → workspace → session overrides.
- Workspace theme override at `~/.rox/workspaces/<id>/theme.json`.
- Agent-authored themes via natural-language requests.

#### Documentation (Phase M.19)

- v1.0.0 user guide (`docs/release/v1-user-guide.md`).
- v1.0.0 admin guide (`docs/release/v1-admin-guide.md`).
- v1.0.0 known limitations (`docs/release/v1-known-limitations.md`).
- v1.0.0 migration guide (`docs/release/v1-migration-guide.md`).
- This CHANGELOG.md.

#### User experience and platform polish (T528 – T533)

- **Session pinning (T528)** — users can pin frequently used sessions
  to the top of the session list; pin state persists across restarts
  via cold-session metadata.
- **Inline session organization (T529)** — row-level rename and
  quick-label actions on session items, no menu navigation required.
- **Registration ROX handle and starter balance (T530)** — new accounts
  receive a `username@rox.one` handle and a starter balance ledger
  entry during signup.
- **Russian compact release notes (T531)** — `.ru.md` companions for
  the What's New surface deliver short Russian bullets without
  rewriting the English release-owned source notes.
- **Zed-inspired bundled themes (T532)** — Kanagawa Wave, macOS
  Classic, Snazzy, and VS Code Dark Modern presets in the Appearance
  picker; bundled-theme parser and syntax-theme preload validation.
- **Skill marketplace foundation (T533)** — 20 starter skills seeded in
  every new workspace; shared marketplace catalog exposes install-state
  metadata so the visible marketplace surface can offer one-click
  installs.

#### Lane M (M.1 – M.21) completion

- **Composer Pillar 4 (M.10)** — history navigation, emphasis toolbar,
  line numbers, paste-image preview with 2 MB / 2048 px resize budget,
  and voice-input slot (T233, T234, T237, T237b).
- **Observability producer (M.14)** — `FileAuditSink` with retention
  evaluation per event, queryable surface, and structured-logger fanout
  (T245, T218 – T221).
- **Mission scheduler kernel (M.8)** — RPC surface, sqlite-backed store,
  checkpoint persistence, and concurrency cap (T241, T243-missions,
  T244-sqlite, T244b).
- **Experience Layer kernel (M.6)** — three-layer model with React hook
  for renderer binding.
- **Provider orchestration backbone (M.7)** — adapter contract, host
  manager, and multi-provider wiring (T240).
- **SQLite production persistence (M.4)** — adapter wired into session,
  workspace, and mission stores (T063, T244-sqlite).
- **Rate-limiter and budget-guard primitives (M.15)** — token-bucket
  limiter and budget-guard wired into RPC handlers (T071, T071b, T071c).
- **Private release pipeline (M.17)** — manual workflow dispatch, tag
  protection, and sha256 checksum manifests.
- **Mac signed-build CI workflow (M.18)** — `mac-arm-build` workflow
  with notarization gate (T250).
- **Multi-platform trust boundaries (M.18)** — Mac (T250), Windows
  (T252), and Linux (T253) validators wired into the rebrand gate.
- **RBAC admin UI + audit log (M.2)** — admin surface plus the
  property-based scope-forgery test suite (T228, T243).

### Changed

- Config directory canonical path is `~/.rox/`. Pre-v1 builds used
  `~/.rox-agent/` or `~/.rox/`. The R.8 migration shim handles the
  move automatically.
- Env var prefix canonical is `ROX_*`. The R.6 shim accepts legacy
  `ROX_*` through v1.1.x with a deprecation warning.
- Docker image canonical tag is `rox-one-server`. Legacy
  `rox-agent-server` is sunset.
- Workspace package scope canonical is `@rox-one/*`. Legacy
  `@rox-agent/*` no longer published.
- Storage submodules now route through `getConfigDirForScope(scope)` —
  single resolver for flat single-user and tenant-prefixed paths.

### Deprecated

- `ROX_*` env-var names — accepted through v1.1.x via the readEnv()
  shim, removed in v1.2.0.
- `rox-cli` binary name — kept through v1.1.x, removed in v1.2.0.
- `@rox-agent/*` package scope imports — already removed from published
  artifacts; legacy local copies will fail to install in v1.2.0+.

### Removed

- `rox-agent-server` Docker image tag — no longer published from
  v1.0.0 onward.

### Security

- Workspace-id forgery defense via the trusted minting choke point in
  `storage-scope-auth.ts`.
- Brand-check defense-in-depth for unsafe `as BrandedWorkspaceScope`
  casts at runtime.
- Local MCP subprocess env-var filtering: `ANTHROPIC_API_KEY`,
  `CLAUDE_CODE_OAUTH_TOKEN`, `AWS_*`, `GITHUB_TOKEN`, `OPENAI_API_KEY`,
  `GOOGLE_API_KEY`, `STRIPE_SECRET_KEY`, `NPM_TOKEN` are stripped from
  spawned MCP servers unless explicitly forwarded via the source's `env`
  field.
- Permanent rebrand validation gate via `bun run validate:rebrand`
  (rebrand sweep R.10).
- Append-only audit storage with retention policy (ADR 0008).
- TLS termination support on the headless server (`wss://`).
- AES-256-GCM encrypted credential store with documented key rotation.
- RBAC scope-forgery property tests — 4006 iterations / 6347 assertions
  across workspace, org, and global scopes (T243).
- Schema-layer reservation of `'*'` as a forbidden workspace scopeId
  (T244) — caught by `RoleStore` and `GrantStore` mutation paths.
- Zod input-validation at every RPC boundary (T303) — handler arguments
  reject malformed envelopes before any side effect.
- Integrity-pass test sweep (T052) — combined coverage gate over auth,
  scope, audit, and credential modules.
- Token-bucket rate-limiter and budget-guard abuse-hardening primitives
  wired into RPC handlers (T071, T071b, T071c).
- Multi-platform trust-boundary validators — Mac (T250), Windows (T252),
  and Linux (T253) — each enforced by a dedicated `validate:*` script.

### Known Limitations

The full list is in `docs/release/v1-known-limitations.md`. Highlights:

- Multi-tenant credential isolation is path-prefix only (ADR 0007
  carve-out — per-tenant hardware-backed keys are post-v1.0.0).
- Audit store is queryable and append-only but not cryptographically
  tamper-resistant.
- RBAC `'org'` scope is wired but full org-tree traversal is post-v1.0.0.
- Mission scheduler concurrency cap is best-effort.
- Linux release is unsigned; Snap/Flatpak packaging is post-v1.0.0.
- In-memory persistence is for dev only — production deployments must
  select SQLite or Postgres.

---

## Phase reference

Commit-level traceability for this release. Each entry is the phase key
recorded in `.swarm/master-roadmap-log.md`:

| Phase | Commits | Tickets |
|---|---|---|
| phase-1.3-pi-ipc-scope-propagation | `5e8b17a` | T216 |
| rebrand-R.0-canonical-inventory | `58613ed` | T260, T261, T262 |
| rebrand-R.1-surface-text-completion | `24aa751` | T263 |
| rebrand-R.2-code-identifier-renames | `93e7b73`, `cc89339`, `e6117bb` | T264, T265, T266 |
| rebrand-R.3-asset-file-renames | `82a8425`, `e9305ca` | T267, T268 |
| rebrand-R.4-doc-plan-cleanup | `5bfd87a`, `1cd54cf`, `0fd740f`, `cb34ecd` | T269 – T272 |
| rebrand-R.5-package-scope-renames | `acc1946`, `76b85ec`, `f07da34`, `09ef0ef`, `34dc261`, `35098cc`, `f7c2a15`, `d7a9af1`, `8a390ec`, `baad43e`, `3ab5324`, `2c70ed4` | T273 – T284 |
| rebrand-R.6-env-var-shim | `777ada7` | T285 – T288 |
| rebrand-R.7-docker-ci-build | `1766229`, `24b0d01`, `23a3b73` | T289, T290, T291 |
| rebrand-R.8-user-data-migration | `3f9ea58`, `efdf1bc`, `f39d087` | T292, T293, T294 |
| rebrand-R.9-community-link-audit | `17990c4` | T295 |
| rebrand-R.9.5-allowlist-and-final-text | `b8d6abd` | T298a, T299a, T300a |
| rebrand-R.10-final-sweep-and-gate | `b287c4e` | T296, T297 |
| M.2-foundation | `89e3423`, `375e89a` | T224, T225 |
| M.2-T226-rbac-resolver | `cad0550` | T226 |
| M.2-T227-foundation | `7e76711` | T227-part1 |
| M.2-T227-complete | `ca208d7` | T227 |

---

## Pre-v1.0.0

Pre-v1 development happened on the `mac/rox-production-ready-rc` branch
and the integration waves T060 – T087. See:

- `docs/release/final-rc-2026-05-06.md` for the integration-wave RC
  report.
- `docs/release/current-state-snapshot-2026-05-06.md` for the
  pre-rebrand state.
- `docs/release/known-limitations-2026-05-06.md` for the pre-rebrand
  limitations register.
- `docs/release/admin-guide-2026-05-06.md` and
  `docs/release/user-guide-mvp-2026-05-06.md` for the pre-rebrand
  operator guides.

These documents are preserved as historical record and are not the
canonical v1.0.0 references.
