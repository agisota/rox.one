# ROX.ONE v1.0.0 — Admin Guide

Audience: operators, IT teams, security reviewers, anyone running ROX.ONE for
more than one user.

Scope: deployment, multi-tenant operations, RBAC administration, persistence,
backup/restore, observability, security ops, upgrades, and air-gapped
installs.

This guide complements `docs/release/v1-user-guide.md` (for end users) and
`docs/release/v1-known-limitations.md` (what v1.0.0 explicitly does not
promise).

---

## 1. Deployment models

ROX.ONE supports three deployment shapes. Pick whichever matches your team.

### Desktop-only

The default. Each user installs the desktop app; sessions, sources, skills,
and credentials live in `~/.rox/` on their machine. No shared infrastructure.

Best for: solo operators, small consultancies, anyone with a strict
data-residency requirement.

### Desktop + headless server

A shared headless server runs the agent runtime. Desktop clients connect to
it over WebSocket. Long-running missions stay alive on the server even when
the laptop closes.

```text
laptop (Electron, thin client)
  └── wss://rox.your-domain:9100
        └── headless server (packages/server)
              ├── persistence backend (SQLite | Postgres)
              ├── credential store (file or vault)
              └── audit + observability sinks
```

Best for: teams that want shared sessions, persistent missions, and a single
RBAC + audit boundary.

### Server-only (web UI)

The headless server hosts both the RPC surface and the web client. Users
connect from a browser.

Best for: cloud-managed offering, BYOD environments, anyone who cannot ship
the Electron app to client machines.

---

## 2. Multi-tenant setup

Single-user is the default. Multi-tenant is **opt-in** and activates only
when the operator sets `ROX_MULTI_TENANT=1` on the server.

### When to use

- More than one ROX ID will use the same server.
- You need workspace-scoped RBAC across users.
- You need per-workspace credential isolation.

### Prerequisites

- A persistence backend other than the in-memory default (see §4).
- An authenticated session minting path. The server's
  `deriveScopeFromAuth(session, requestedWorkspaceId)` is the only place a
  branded `WorkspaceScope` is minted; renderer and webui inputs cannot mint
  scopes directly.
- A populated `session.permittedWorkspaces` set. Phase 2 RBAC owns this — see
  §3.

### Enabling

```bash
export ROX_MULTI_TENANT=1
export ROX_SERVER_TOKEN=<32-byte hex token>
export ROX_RPC_HOST=0.0.0.0
bun run packages/server/src/index.ts
```

When `ROX_MULTI_TENANT=1`, workspace scopes resolve to
`<configDir>/tenants/<workspaceId>/…`. When unset, they downgrade to the
flat `<configDir>/…` layout and an audit event records the downgrade.

See ADR 0007 (`docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`)
for the full design.

---

## 3. RBAC administration

The RBAC model lives at `packages/shared/src/auth/roles-schema.ts`. A grant
binds a user to a role at a scope.

### Designing role hierarchies

A **role** is a named bag of permissions. ROX.ONE ships defaults but expects
operators to model their own. A typical hierarchy:

```text
workspace.viewer
  └── workspace.editor (everything viewer has + write tools)
        └── workspace.admin (editor + invite + grant + revoke)

global.platform-admin (full server)
```

Roles compose by **name**; effective permissions are the union of all role
grants matching the request.

### Granting at scope

A grant has three scope kinds:

| Scope kind | `scopeId` | What it covers |
|---|---|---|
| `workspace` | a workspace id | Permissions inside that one workspace |
| `org` | an org id | Reserved for post-v1.0.0 — see Known Limitations |
| `global` | `null` | Server-wide |

Operators interact with grants through:

- The desktop UI (Settings → Team & permissions)
- The server RPC handlers (`packages/server-core/src/handlers/rpc/roles.ts`)
- Direct edits to `RoleStore` / `GrantStore` (for migration / disaster
  recovery only)

### Revocation propagation

Revocation is immediate. The next RBAC resolution after the grant store
write returns the new permission set. No restart, no cache flush — the
resolver is read-through.

For belt-and-braces in compromised-session scenarios: also revoke the
user's bearer token so existing connections drop.

---

## 4. Persistence backends

ROX.ONE has adapter seams for three backends.

| Backend | When | Single-instance | Multi-instance |
|---|---|---|---|
| **In-memory** | Tests, dev, ephemeral demos | yes | no |
| **SQLite** | Single-host production, small teams | yes | no |
| **Postgres** | Cloud, multi-instance, HA | yes | yes |

The backend is selected via env var on the server. See
`packages/shared/src/config/paths.ts` and the storage submodules for the
adapter list.

### What's persisted

- Workspaces, sessions, message history (JSONL on disk; row-oriented in SQL)
- Source configs (credentials are stored encrypted via the credentials
  store, **not** in the persistence backend)
- RBAC roles and grants
- Audit events (see §6)
- Mission state, checkpoints, gate evaluations

### What's never persisted

- LLM provider raw responses past the session message stream
- API keys in plaintext (always AES-256-GCM via the credentials store)

---

## 5. Backups

### What to back up from `~/.rox/`

Critical (back up daily):

```text
~/.rox/config.json
~/.rox/credentials.enc
~/.rox/workspaces/*/config.json
~/.rox/workspaces/*/sources/        # source configs
~/.rox/workspaces/*/sessions/       # session transcripts
~/.rox/workspaces/*/skills/         # custom skills
```

Useful (back up weekly):

```text
~/.rox/preferences.json
~/.rox/theme.json
~/.rox/workspaces/*/theme.json
~/.rox/workspaces/*/automations.json
~/.rox/workspaces/*/statuses/
```

Disposable (do not back up):

```text
~/.rox/logs/
```

### Recommended cadence

| Asset | Cadence | Why |
|---|---|---|
| `credentials.enc` | After every credential change | Re-onboarding source OAuth is painful |
| `sessions/` | Daily incremental, weekly full | High-value, append-mostly |
| Server persistence (SQLite/Postgres) | Whatever your DB ops dictate | Standard DB backup hygiene |
| Audit events | Per retention policy | See §6 |

### Restore procedure

1. Stop the desktop app or server.
2. Replace `~/.rox/` (or the equivalent server data dir) with the backup.
3. **Important** — for the credentials store to decrypt after restore, the
   OS keychain must still hold the master key for the same user. If you've
   migrated to a new machine, see §8 (Upgrade path) for keyring transfer.
4. Restart. Verify by listing workspaces and sources; agents will reconnect
   their OAuth flows automatically if any tokens have expired.

---

## 6. Observability

### Log streams

| Stream | Path | Format |
|---|---|---|
| Desktop main process | `~/.rox/logs/electron/main.log` | Structured JSON (pino) |
| Desktop renderer | DevTools console (forwarded to main log when debug mode is enabled) | JSON |
| Headless server | stdout (configurable redirect) | Structured JSON |
| Agent tool invocations | Audit event sink | Append-only JSONL or DB |

Debug verbose: launch the app with `-- --debug` or set `ROX_DEBUG=true` on
the server.

### Audit event query API

The audit storage layer (ADR 0008) exposes records via `listRecords()` on
`AuditEventStorageBackend`:

```ts
// packages/shared/src/audit/audit-event-store.ts
import { FileAuditEventStore } from '@rox-one/shared'

const store = new FileAuditEventStore()
const records = await store.listRecords()

// Filter by tenant, event type, severity, or time range as needed.
const forgeries = records.filter(r =>
  r.eventType === 'scope.factory.forgery_rejected',
)
```

Records are append-only and hash-chained — each record carries the previous
record's hash. Use `verifyAuditHashChain(records)` to detect tampering.
Operators typically wire this into their own dashboard or SIEM pipeline.

### Recommended alerting thresholds

| Event kind | Suggested alert |
|---|---|
| `scope.factory.forgery_rejected` | Any occurrence — page on-call |
| `scope.brand.cast_breach` | Any occurrence — paged severity |
| `scope.factory.downgraded` | Burst >10 / minute |
| `scope.runtime.workspace_downgraded` | Burst >10 / minute |
| Tenant credential access signals | Anomalous spike vs. baseline |
| Bash / write-tool calls in Auto mode | Volume thresholds per workspace |
| RPC 5xx | Standard service alerting |

---

## 7. Security operations

### Credential rotation

Source credentials (OAuth tokens, API keys) rotate via the source's own
re-auth flow. To rotate the master encryption key, see the credentials
store's documented key-rotation routine (re-encrypts in place with the new
master, no plaintext exposure on disk).

### Session-token revocation

`ROX_SERVER_TOKEN` rotation is "restart the server with a new token,
distribute the new token". There is no token database in v1.0.0; one bearer
token per server.

For per-user session token revocation in multi-tenant deployments: revoke
the user's grants (see §3) — the next request fails RBAC, and the user must
re-authenticate.

### Incident response runbook stub

1. **Identify.** Capture the audit-event window and the affected workspaces.
2. **Contain.** Revoke compromised user grants. Rotate `ROX_SERVER_TOKEN` if
   the bearer token is suspected leaked.
3. **Eradicate.** Rotate any source credentials that touched the
   compromised path. The credentials store supports key rotation without
   re-onboarding sources.
4. **Recover.** Restore from backup if needed (§5).
5. **Post-mortem.** Use the audit event stream as the source of truth for
   timeline reconstruction.

Full incident response is operator-owned. v1.0.0 ships the surface; your
team owns the playbook.

---

## 8. Upgrade path

### From v0.9.x

1. Install v1.0.0 on the same machine — the desktop app and headless server
   both auto-detect legacy `~/.rox-agent/` or `~/.rox/` on first launch
   and copy them to `~/.rox/`. Source is preserved.
2. Verify by listing workspaces in the new install.
3. Once you've confirmed parity, you can delete the legacy directory at your
   own discretion. v1.0.0 will not re-migrate if `~/.rox/` exists.

See `docs/release/v1-migration-guide.md` for the full walkthrough including
the env-var deprecation table.

### Env-var deprecation timeline

`readEnv()` in `packages/shared/src/utils/env-compat.ts` honors legacy
`ROX_*` env vars for **one minor version** after v1.0.0 — i.e. v1.1.0 is
the last release that accepts them. v1.2.0 reads `ROX_*` only.

Migrate your scripts, Docker files, and CI now. The shim emits a
deprecation warning on first read of each legacy name per process.

### Config-dir migration shim

Implemented at `packages/shared/src/config/user-data-migration.ts`. On every
app launch:

- If `~/.rox/` already exists → no-op.
- If `~/.rox-agent/` exists and `~/.rox/` does not → copy
  `~/.rox-agent/` → `~/.rox/`.
- If both legacy dirs exist → log a warning, skip migration. Operator must
  manually consolidate.
- If only `~/.rox/` exists → copy `~/.rox/` → `~/.rox/`.

Migration is idempotent; safe to call on every launch.

---

## 9. Air-gapped install

ROX.ONE can run with no outbound network if your LLM provider is also
air-gapped (e.g. a local Ollama or a self-hosted Anthropic-compatible
endpoint).

### Bundled assets

The Electron build ships these locally so the app boots offline:

```text
apps/electron/resources/
├── bin/                    # CLI stubs (bun, scripts)
├── bridge-mcp-server/      # local bridge MCP
├── docs/                   # bundled docs
├── permissions/default.json
├── release-notes/
└── scripts/                # Python harness, helpers
```

No network calls are made during the launch path. Telemetry, update checks,
and remote install scripts are all opt-in.

### No-network setup

1. Side-load the Electron build via your usual MDM / image.
2. Point ROX.ONE at a local LLM endpoint (Ollama, vLLM, internal
   Anthropic-compatible gateway).
3. For MCP servers, prefer stdio-based servers that ship as bundled
   binaries — they spawn as local subprocesses.
4. Disable telemetry (Settings → Privacy) and update checks (Settings →
   Advanced).

---

## 10. Production blockers / open items

The post-release backlog includes:

- Full org-level RBAC (Phase post-v1.0.0; `'org'` scope kind is wired but
  policy resolution is partial)
- Tamper-resistant audit store (current store is queryable + append-only,
  not cryptographically anchored)
- Snap/Flatpak packaging for Linux
- Notarized Linux release candidate
- Per-tenant key derivation beyond path-prefix isolation (see ADR 0007
  carve-out)

See `docs/release/v1-known-limitations.md` for the complete list.

---

## 11. Where to go next

- **End-user onboarding** — `docs/release/v1-user-guide.md`
- **Upgrade walkthrough** — `docs/release/v1-migration-guide.md`
- **Known v1.0.0 limitations** — `docs/release/v1-known-limitations.md`
- **Release notes by phase** — `CHANGELOG.md`
- **ADRs** — `docs/decision-records/`
- **Architecture** — `docs/architecture/`
- **Security policy** — `SECURITY.md`
