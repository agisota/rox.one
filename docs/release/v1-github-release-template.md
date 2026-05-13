# ROX.ONE v1.0.0 — GitHub Release Body Template

This is the canonical body for the `v1.0.0` GitHub Release that M.21
publishes after the 72-hour soak (`docs/release/v1-rc-72h-soak-protocol.md`)
completes green. The operator fills in the placeholder spans marked
`<…>` at tag time and pastes the rendered Markdown into the GitHub UI.

The fenced block below is the release body verbatim. Everything outside
the block is template guidance for the operator.

---

```markdown
# ROX.ONE v1.0.0

**Tag:** `v1.0.0`
**Release date:** <YYYY-MM-DD>
**Soak window closed:** <YYYY-MM-DD> (72h, per `v1-rc-72h-soak-protocol.md`)

The first stable ROX.ONE release. Built as a white-label fork of the
upstream Rox Agents OSS project (Apache 2.0; attribution preserved in
`LICENSE`, `NOTICE`, `TRADEMARK.md`, and `Dockerfile.server`).

## What's new

- **Multi-tenant storage isolation** — authenticated scope minting,
  path-prefix tenant directories, per-tenant credential key derivation,
  and runtime brand-check defense-in-depth (ADR 0007).
- **Append-only audit storage** — hash-chained events, retention policy,
  and queryable API for workspace/global scope mutations (ADR 0008).
- **RBAC slice** — roles, grants, admin UI, audit log integration, and
  4006-iteration property-based scope-forgery test suite.
- **Composer Pillar 4** — history navigation, emphasis toolbar, line
  numbers, paste-image preview with 2 MB / 2048 px budget, and voice
  input slot.
- **Mission scheduler kernel** — RPC surface, sqlite-backed store,
  checkpoint persistence, and best-effort concurrency cap.
- **Multi-provider orchestration** — adapter contract for Anthropic,
  OpenAI, Google, OpenRouter, Groq, Mistral, and xAI with host manager.
- **Headless server + thin-client desktop** — WebSocket RPC, TLS
  (`wss://`), and the `rox-one-server` Docker image.

## Download

Signed builds are published as workflow artifacts. Sha256 checksums are
in the `SHA256SUMS.txt` manifest attached to this release.

| Platform | Artifact |
| --- | --- |
| macOS (Apple Silicon, signed + notarized) | `ROX.ONE-1.0.0-arm64.dmg` |
| macOS (Intel, signed + notarized) | `ROX.ONE-1.0.0-x64.dmg` |
| Windows (signed installer) | `ROX.ONE-Setup-1.0.0.exe` |
| Linux (AppImage, unsigned) | `ROX.ONE-1.0.0.AppImage` |
| Docker (headless server) | `ghcr.io/<org>/rox-one-server:1.0.0` |

After download, verify the checksum:

```bash
sha256sum -c SHA256SUMS.txt
```

## Migration notes

If you ran a pre-v1 build of the white-label fork, the upgrade is
non-destructive but renames a few things. Full guide:
`docs/release/v1-migration-guide.md`.

- **User data dir** — `~/.rox-agent/` and `~/.rox/` are automatically
  copied to `~/.rox/` on first launch by the R.8 migration shim. Source
  directories are left intact for rollback.
- **Env-var prefix** — `ROX_*` is canonical. Legacy `ROX_*` is accepted
  through v1.1.x with a deprecation warning, removed in v1.2.0.
- **Package scope** — `@rox-one/*` is canonical. Legacy `@rox-agent/*`
  is no longer published; local copies break in v1.2.0+.
- **Docker image** — `rox-one-server` is canonical. Legacy
  `rox-agent-server` tags are sunset from v1.0.0.
- **CLI binary** — `rox-cli` is canonical. Legacy `rox-cli` is kept as
  an alias through v1.1.x, removed in v1.2.0.

## Known limitations

Full register: `docs/release/v1-known-limitations.md`. Highlights:

- Multi-tenant credential isolation is path-prefix only; per-tenant
  hardware-backed keys are post-v1.0.0 (ADR 0007 carve-out).
- Audit store hash chain is internal — no external anchoring yet.
- RBAC `'org'` scope is wired but full org-tree traversal lands post-v1.
- Mission scheduler concurrency cap is best-effort.
- Linux release is unsigned; Snap/Flatpak packaging is post-v1.
- In-memory persistence is dev-only — production must select SQLite
  or Postgres.

## Acknowledgements

ROX.ONE is a white-label fork of the upstream **Rox Agents** OSS
project, distributed under Apache 2.0. Attribution is preserved in:

- `LICENSE` — Apache 2.0 license text.
- `NOTICE` — required NOTICE-file inclusions.
- `TRADEMARK.md` — trademark carve-out for the upstream name.
- `Dockerfile.server` source label — `org.opencontainers.image.source`
  pointing at the upstream repository.

Thanks to every upstream contributor whose work is the foundation of
this release.

## Checksums

```text
<sha256-of-mac-arm64-dmg>  ROX.ONE-1.0.0-arm64.dmg
<sha256-of-mac-x64-dmg>    ROX.ONE-1.0.0-x64.dmg
<sha256-of-win-setup-exe>  ROX.ONE-Setup-1.0.0.exe
<sha256-of-linux-appimage> ROX.ONE-1.0.0.AppImage
```

Full manifest: `SHA256SUMS.txt` attached to this release.

## Phase reference

Commit-level traceability is in `CHANGELOG.md` and
`.swarm/master-roadmap-log.md`. The Lane M progression M.1 – M.21
covers every feature listed under "What's new" above.
```

---

## Operator checklist for M.21

Before publishing the release with the body above:

1. Confirm the 72-hour soak window closed green per
   `docs/release/v1-rc-72h-soak-protocol.md`.
2. Replace every `<…>` placeholder with the actual value.
3. Replace `CHANGELOG.md` `TBD (after 72h soak)` with the release date.
4. Attach `SHA256SUMS.txt` and the four platform artifacts to the
   GitHub Release.
5. Tag is `v1.0.0`; target ref is the soak-passing SHA.
6. Mark "Latest release"; do NOT mark "Pre-release".
