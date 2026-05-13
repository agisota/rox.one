# ROX.ONE v1.0.0 — Migration Guide

Audience: anyone upgrading from a pre-v1 build of the white-label fork
(formerly known by its legacy name on disk and in env vars).

Scope: config directory move, env-var renames, package-scope changes,
Docker image rename, CLI binary alias, and rollback advice.

If you're starting fresh, you don't need this — install v1.0.0 directly and
read `docs/release/v1-user-guide.md`.

---

## 1. Config directory — automatic on first launch

v1.0.0 reads its config from `~/.rox/`. Pre-v1 builds read from either
`~/.craft-agent/` (newer pre-v1) or `~/.craft/` (older). On first launch the
**R.8 user-data migration shim** copies your existing directory into the new
location.

### How it works

Implemented at `packages/shared/src/config/user-data-migration.ts`.
Migration runs once on each app launch with these rules:

| Source state | Action |
|---|---|
| `~/.rox/` exists | Skip — the new dir is authoritative. |
| `~/.craft-agent/` exists, `~/.rox/` does not | Copy `~/.craft-agent/` → `~/.rox/`. |
| `~/.craft/` exists, `~/.rox/` does not | Copy `~/.craft/` → `~/.rox/`. |
| Both legacy dirs exist | Log a warning, skip. Manually consolidate. |

The source directory is **never deleted**. It's left intact so you can roll
back if needed.

### Verification steps

After your first v1.0.0 launch:

1. Confirm `~/.rox/` exists and contains `config.json`, `workspaces/`, and
   (if you had credentials) `credentials.enc`.
2. Open the desktop app — your workspaces should appear in the sidebar.
3. Open a session — your message history should load.
4. Check the migration log:

   ```bash
   grep '[user-data-migration]' ~/.rox/logs/electron/main.log
   ```

   Expect a `copy complete (<N> files)` line.

If migration didn't run (your new dir is empty), confirm the source dir
exists and has read permission for your user, then relaunch.

---

## 2. Env vars — `CRAFT_*` → `ROX_*`

The R.6 `readEnv()` shim (`packages/shared/src/utils/env-compat.ts`) accepts
both names for **one minor version**. v1.1.x still accepts `CRAFT_*` with a
deprecation warning. v1.2.0 reads `ROX_*` only.

### Renames

| Legacy | Canonical | Surface |
|---|---|---|
| `CRAFT_SERVER_TOKEN` | `ROX_SERVER_TOKEN` | Headless server bearer token |
| `CRAFT_SERVER_URL` | `ROX_SERVER_URL` | Thin-client connection URL |
| `CRAFT_RPC_HOST` | `ROX_RPC_HOST` | Server bind address |
| `CRAFT_RPC_PORT` | `ROX_RPC_PORT` | Server bind port |
| `CRAFT_RPC_TLS_CERT` | `ROX_RPC_TLS_CERT` | TLS certificate path |
| `CRAFT_RPC_TLS_KEY` | `ROX_RPC_TLS_KEY` | TLS private-key path |
| `CRAFT_RPC_TLS_CA` | `ROX_RPC_TLS_CA` | TLS CA chain path |
| `CRAFT_DEBUG` | `ROX_DEBUG` | Verbose logging |
| `CRAFT_E2E` / `CRAFT_HEADLESS` | `ROX_E2E` / `ROX_HEADLESS` | Test runtime flags |
| `CRAFT_DEV_RUNTIME` | `ROX_DEV_RUNTIME` | Dev runtime selector |
| `CRAFT_MCP_URL` / `CRAFT_MCP_TOKEN` | `ROX_MCP_URL` / `ROX_MCP_TOKEN` | Bundled MCP bridge |
| `CRAFT_ANTHROPIC_API_KEY` | `ROX_ANTHROPIC_API_KEY` | Anthropic key passthrough |
| `CRAFT_WH_*` | `ROX_WH_*` | Webhook URLs (Discord, Slack, etc.) |
| `CRAFT_UV` / `CRAFT_SCRIPTS` / `CRAFT_BUN` / `CRAFT_CLI_ENTRY` | `ROX_UV` / `ROX_SCRIPTS` / `ROX_BUN` / `ROX_CLI_ENTRY` | Shell-stub overrides |
| `CRAFT_LABEL` / `CRAFT_SESSION_ID` | `ROX_LABEL` / `ROX_SESSION_ID` | Automation prompt expansion |

The shim is one-way — set the new name AND remove the legacy one to avoid
ambiguity. If both are set, the canonical `ROX_*` wins; the shim does not
warn about that case.

### Migrating scripts

Search-and-replace `CRAFT_` → `ROX_` in your CI configs, shell aliases, and
Docker compose files. Then run with the legacy names still set as a safety
net during the v1.1.x window.

---

## 3. Package scope — `@craft-agent/*` → `@rox-one/*`

Anyone importing from the workspace packages must rename their imports.

| Legacy package | Canonical |
|---|---|
| `@craft-agent/core` | `@rox-one/core` |
| `@craft-agent/shared` | `@rox-one/shared` |
| `@craft-agent/server` | `@rox-one/server` |
| `@craft-agent/server-core` | `@rox-one/server-core` |
| `@craft-agent/ui` | `@rox-one/ui` |
| `@craft-agent/audit` | `@rox-one/audit` |
| `@craft-agent/pi-agent-server` | `@rox-one/pi-agent-server` |
| `@craft-agent/session-mcp-server` | `@rox-one/session-mcp-server` |
| `@craft-agent/session-tools-core` | `@rox-one/session-tools-core` |
| `@craft-agent/messaging-gateway` | `@rox-one/messaging-gateway` |
| `@craft-agent/messaging-whatsapp-worker` | `@rox-one/messaging-whatsapp-worker` |
| `@craft-agent/test-fixtures` | `@rox-one/test-fixtures` |

There is **no `package.json` shim** for the scope rename — published v1.0.0
artifacts ship only under `@rox-one/*`. Update your `package.json` and run
`bun install` (or your package manager's equivalent).

The root `package.json` keeps its `name: craft-agent` for one more minor
version while the lockfile regeneration is sequenced into the M.21 release
prep. See the validate-rebrand allowlist for the carve-out reasoning.

---

## 4. Docker image — `rox-one-server` is the new name

| Legacy tag | Canonical tag |
|---|---|
| `craft-agent-server:*` | `rox-one-server:*` |

Sunset: the legacy tag is no longer published from v1.0.0 onward. Existing
deployments pinning the old tag will not auto-upgrade.

To migrate:

```bash
# Replace your image reference
docker pull rox-one-server:1.0.0

# Update env vars (see §2) — the in-image shim accepts CRAFT_* through v1.1.x
docker run -d \
  -p 9100:9100 \
  -e ROX_SERVER_TOKEN=<token> \
  -e ROX_RPC_HOST=0.0.0.0 \
  -v rox-data:/root/.rox \
  rox-one-server:1.0.0
```

The data volume mount point moved from `/root/.craft/` to `/root/.rox/`. The
config-dir migration shim runs inside the container on first launch, so a
bind-mounted legacy volume gets copied to `/root/.rox/` automatically.

---

## 5. CLI binary alias — `craft-cli` kept for one minor

The `craft-cli` bin name is preserved through v1.1.x as a deliberate
carve-out (see T298a worklog). The canonical name is `rox-cli`, planned to
become the only published name in v1.2.0.

| Now (v1.0.0 – v1.1.x) | v1.2.0+ |
|---|---|
| `craft-cli ping` | `rox-cli ping` |
| `craft-cli send …` | `rox-cli send …` |

If you've aliased `craft-cli` to a path in your shell rc, swap to `rox-cli`
when convenient. Both bins resolve to the same Bun entry point —
`apps/cli/src/index.ts`.

---

## 6. Reverting

Not recommended — but if you must:

1. Find the rebrand checkpoint tag in `git`:

   ```bash
   git log --oneline rebrand-v1
   ```

2. Check out the commit immediately preceding the tag. This is the last
   build that ran on the legacy `~/.craft/` paths.
3. Move your data back if needed:

   ```bash
   # Only if you want to use the pre-v1 build with your post-v1 data
   cp -r ~/.rox/ ~/.craft/
   ```

4. Rebuild and run the pre-v1 app.

Caveats:

- Anything you did in v1.0.0 that relies on new RBAC, multi-tenant, or
  audit-storage features will be silently lost on the older build.
- Sessions are forward-compatible (JSONL); credentials are not always
  forward-compatible if the key derivation changed (T217).
- The pre-v1 build won't know about the new env-var names. Re-export the
  legacy ones.

We strongly suggest running v1.0.0 alongside a backup of `~/.rox/` rather
than reverting.

---

## 7. Where to go next

- **First-time orientation** — `docs/release/v1-user-guide.md`
- **Operator setup** — `docs/release/v1-admin-guide.md`
- **What v1.0.0 won't do** — `docs/release/v1-known-limitations.md`
- **Detailed phase log** — `CHANGELOG.md`
