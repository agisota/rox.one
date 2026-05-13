# ROX.ONE v1.0.0 — Known Limitations

Honest list of what v1.0.0 does NOT do. Each item links to where it's
implemented today and where the post-release work lives.

This is the operator's reality check. If something here is a blocker for
your environment, talk to us before deploying.

---

## Multi-tenant credential isolation is path-prefix only

ADR 0007 (`docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`)
defines tenant isolation as path-prefix isolation under
`<configDir>/tenants/<workspaceId>/…`. T217 added per-tenant key derivation
via HKDF over the local master key, but the resulting tenant keys still
share a single OS-keychain master.

Carve-out: a host-level attacker with read access to one tenant's process
memory can derive other tenants' keys from the shared master.

Post-release: per-tenant hardware-backed keys (Secure Enclave / TPM) is
planned but not v1.0.0.

---

## Audit event store has internal hash chain, no external anchoring

ADR 0008 ships an append-only audit storage layer with hash-chained
records, `listRecords()` retrieval, structured-logger fanout, and
retention policy (implemented by T218–T221).

What it DOES do:

- Per-event SHA-based `previousEventHash` + `eventHash`, verifiable end-
  to-end via `verifyAuditHashChain()`.
- Append-only file backend (`FileAuditEventStore`) with `0o600` file
  permissions and a `0o700` parent directory.
- Built-in payload-key sanitization for `token`, `secret`, `password`,
  `api_key`, `authorization`, `cookie`.

What it does NOT do:

- No external notarization. The hash chain is local; an operator with
  filesystem write access can rewrite a tail and recompute hashes
  forward. Detecting that requires comparing against an external snapshot.
- No write-once media enforcement at the OS layer.
- No structured query API yet — operators filter `listRecords()`
  client-side.

This is acceptable for v1.0.0's threat model (operator is trusted) but is
not suitable for regulatory tamper-resistance claims on its own. Pair the
local store with an external append-only sink for that use case.

Post-release: structured query API on the store; optional external sink
adapter.

---

## Pi-agent IPC has documented bounds

T215 + T216 wired the Pi subprocess to re-mint authenticated storage scope
via the trusted factory boundary and to reject forged workspace envelopes.

Documented bounds per the T215/T216 worklogs:

- The Pi subprocess receives an authenticated storage-scope envelope. The
  parent must populate `permittedWorkspaces` correctly — the Pi side trusts
  the integrity token, not the workspace list shape.
- Phase 2 (T224–T227) supplies the RBAC-produced permitted-workspace set.
  Until a deployment uses the Phase 2 RBAC path, the Pi process scopes to a
  single managed workspace per spawn.
- The one-time integrity token rotates per spawn; replay across spawns is
  rejected. Live-process compromise mid-spawn is out of scope for this
  defense.

Post-release: richer RBAC integration on the Pi path; full SessionManager
permitted-workspace plumbing.

---

## RBAC `'org'` scope is wired but not fully resolved

`packages/shared/src/auth/roles-schema.ts` defines
`ScopeKind = 'workspace' | 'org' | 'global'`. The `'workspace'` and
`'global'` arms have full resolver coverage. The `'org'` arm exists in the
type and store layers but the policy engine does not yet traverse
organization hierarchies — an `'org'` grant resolves only its direct
members.

Post-release: full org-tree traversal, sub-org inheritance, org-level
admin delegation.

---

## Public share shortlink may exclude adaptive media

The share bundle redacts secrets and file contents fetched into agent
context, but the public viewer is best-effort for adaptive media:

- Streamed tool outputs over a threshold are summarized (see "Large
  Response Handling" in README).
- Some rendered shapes (interactive widgets, video, very large diff views)
  fall back to a text representation in the viewer.
- The viewer is a thin renderer, not a re-hosted session — recipients
  cannot continue the conversation.

Operators are responsible for telling users what's shareable in their
context.

Post-release: richer public viewer with full media fidelity.

---

## Mission scheduler concurrency is a soft limit

Each workspace has a configurable max-concurrent-missions cap. Enforcement
is **best-effort** — the scheduler checks at launch time but does not
re-enforce mid-mission if state drifts (e.g. a stuck mission counted toward
the cap).

Operators see warnings in the audit feed if the limit is exceeded by a
state-drift edge case. The mission still runs; no missions are killed by
the cap.

Post-release: strict enforcement with a stuck-mission GC pass.

---

## Mac signing — notarization required for fresh installs, not upgrades

Fresh download + first launch on macOS requires notarization (Apple
Gatekeeper enforces). v1.0.0 ships a notarized macOS ARM build.

Users who already had a v0.9.x install can sometimes bypass with
`xattr -d com.apple.quarantine "/Applications/ROX Agents.app"`, but a clean
machine cannot. We do not document the bypass as the supported path.

Post-release: Intel Mac signed build (currently ARM-only).

---

## Linux release candidate is unsigned

The Linux build is shipped as an unsigned binary in v1.0.0. There is no
Snap, no Flatpak, no `.deb` / `.rpm` packaging — just a tarball.

Operators are responsible for verifying the SHA-256 against the published
release manifest and trusting the binary.

Post-release: Snap + Flatpak packaging, signed AppImage.

---

## Environment-variable shim is one-minor-version only

`readEnv()` in `packages/shared/src/utils/env-compat.ts` honors legacy
`CRAFT_*` names through v1.1.x. v1.2.0 reads `ROX_*` only.

Migration table is in `docs/release/v1-migration-guide.md` §2.

---

## Single bearer-token authentication on the headless server

`ROX_SERVER_TOKEN` is a single shared bearer token. There is no per-user
token issuance, no OAuth for the RPC surface itself, no token rotation
without restart.

For multi-user deployments this means: all desktop clients share one
token. Per-user identity comes from the user's ROX ID authentication layer
running on top of the bearer token.

Post-release: per-user RPC tokens, in-place rotation.

---

## In-memory persistence loses state on restart

The default in-memory backend is for development and demos only. It is the
explicit default for the server's first-launch experience but loses every
session, grant, and credential on restart.

Production deployments MUST select SQLite (single-host) or Postgres
(multi-host) — see `docs/release/v1-admin-guide.md` §4.
