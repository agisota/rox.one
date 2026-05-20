# Rox Design payload supply chain

Tracked in Linear as **[PZD-51](https://linear.app/pzd/issue/PZD-51)** (B-REPRO-2). Closes the non-reproducibility gap from the 2026-05-20 PR #268 release-readiness audit.

## Three prep modes

`scripts/prepare-rox-design-runtime.ts` now supports three modes:

### Mode 1 — host-local (default, mac contributor path)

```bash
ROX_DESIGN_SOURCE_RESOURCES="/Applications/Open Design.app/Contents/Resources" \
  bun run rox-design:prepare -- --force
```

What it does: copies the directory tree from the host-local Open Design install into `apps/electron/resources/rox-design/`. Same as before.

When to use: mac contributors with Open Design 0.7.0 installed.

Limitation: NOT reproducible. Two macs with the same Open Design version string can produce different payload bytes.

### Mode 2 — pinned archive (canonical CI path, B-REPRO-2 fix)

```bash
bun run rox-design:prepare -- \
  --from-archive=https://rox-design-runtime-payloads.s3.amazonaws.com/rox-design-payload-0.7.0-${SHA_SHORT}.tar.gz \
  --expected-sha256=${SHA256} \
  --force
```

What it does:
1. Downloads the archive (or reads from a local path / `file://` URL).
2. Verifies its SHA-256 matches `--expected-sha256` exactly. **Mismatch aborts immediately** before any extraction.
3. Extracts the tarball into `apps/electron/resources/rox-design/` using system `tar -xzf`.
4. Validates the extracted layout matches `REQUIRED_PATHS`.
5. Writes `MANIFEST.json` with `archiveSource` and `archiveSha256` (alongside the existing `version` and `copiedAt`).

When to use: any release lane (Linux, Windows, generic mac). The canonical archive is the single source of truth for what gets shipped.

Reproducibility guarantee: bit-identical packaged artifacts across CI runs (modulo build-time timestamps).

### Mode 3 — local file (offline / fixture)

```bash
bun run rox-design:prepare -- \
  --from-archive=/tmp/rox-design-payload-0.7.0-test.tar.gz \
  --expected-sha256=<hex> \
  --force
```

What it does: same as Mode 2 but reads from a local filesystem path (no network).

When to use: fixture-based tests, air-gapped CI, debugging.

## CLI flags

| Flag | Required when | Effect |
|---|---|---|
| `--from-archive=<url\|path>` | switching to Mode 2/3 | Use the pinned-archive path instead of host-local copy. |
| `--expected-sha256=<hex>` | `--from-archive` is set | Required for integrity. Refuses to proceed if mismatch. |
| `--force` | target already populated | Wipes and re-populates the target (preserves `README.md`). |
| `--check` | discovery / validation | Validates the source/archive without writing the target. Exits 0 on success. |

Environment override:

| Env var | Mode | Effect |
|---|---|---|
| `ROX_DESIGN_SOURCE_RESOURCES` | Mode 1 | Override the default `/Applications/Open Design.app/Contents/Resources` source path. |
| `ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY=1` | any | Skip the packaging gate (`rox-design:payload:verify`). Dev only — packaged Rox Design will not work. |

## `runtime-payload-versions.json` (canonical version manifest)

Single source of truth for which archive each release pulls. Committed at the repo root once a canonical archive is built and uploaded.

```json
{
  "schema": "rox-design-runtime-payload-versions.v1",
  "current": "0.7.0-2026-05-20",
  "versions": {
    "0.7.0-2026-05-20": {
      "openDesignVersion": "0.7.0",
      "preparedAt": "2026-05-20T07:00:00Z",
      "integrationCommit": "abcdef0",
      "archiveUrl": "https://rox-design-runtime-payloads.s3.amazonaws.com/rox-design-payload-0.7.0-abcdef0.tar.gz",
      "archiveSha256": "deadbeef…",
      "archiveSizeBytes": 263000000
    }
  }
}
```

`current` points at the version every release lane should pull. Older entries are kept for downgrade/rollback evidence.

CI release workflows resolve via `jq`:

```bash
ARCHIVE_URL=$(jq -r '.versions[.current].archiveUrl' runtime-payload-versions.json)
ARCHIVE_SHA=$(jq -r '.versions[.current].archiveSha256' runtime-payload-versions.json)
bun run rox-design:prepare -- --from-archive="$ARCHIVE_URL" --expected-sha256="$ARCHIVE_SHA" --force
```

## Building the canonical archive

A dedicated CI workflow on a self-hosted mac runner does this once per Open Design upgrade. Out of scope for this initial PR — tracked as follow-up.

Manual recipe (on a mac with Open Design 0.7.0):

```bash
cd /tmp
src='/Applications/Open Design.app/Contents/Resources'
ver=$(jq -r .appVersion "$src/open-design-config.json")
sha_short=$(git -C "$ROX_REPO" rev-parse --short HEAD)
out="rox-design-payload-$ver-$sha_short.tar.gz"
( cd "$src" && tar -czf "/tmp/$out" \
  open-design-config.json app/prebundled app/node_modules \
  open-design open-design-web-standalone )
shasum -a 256 "/tmp/$out"
# Upload /tmp/$out to S3; update runtime-payload-versions.json with the SHA-256.
```

## Manifest schema changes

`MANIFEST.json` written into the prepared payload now optionally includes:

```json
{
  "schema": "rox-design-runtime-manifest.v1",
  "archiveSource": "https://…/rox-design-payload-0.7.0-…tar.gz",
  "archiveSha256": "deadbeef…",
  "version": "0.7.0",
  "copiedAt": "2026-05-20T07:30:00Z",
  "copiedPaths": ["open-design-config.json", "app/prebundled", …]
}
```

Mode 1 (host-local) still writes `sourceRoot` instead of `archiveSource`/`archiveSha256`.

The packaging gate (`scripts/check-rox-design-runtime-payload.ts`) accepts both shapes — it only validates `schema` + `version` + `REQUIRED_PATHS`. Future work may add an `--expected-sha256` cross-check in the gate to refuse mismatched payloads even in Mode 2.

## What this PR does NOT do

- Doesn't create the S3 bucket / IAM role for the canonical archive job.
- Doesn't add `runtime-payload-versions.json` to the repo (left empty until the first canonical archive is built and uploaded).
- Doesn't wire CI workflows to use Mode 2 yet — workflows continue to expect a pre-prepared payload via Mode 1 until the canonical archive exists.
- Doesn't update the packaging gate to cross-check `archiveSha256`.

These four items are intentional follow-ups; see Implementation Plan in [PZD-51](https://linear.app/pzd/issue/PZD-51).

## Verification

Mode 3 (local fixture) is fully verifiable on any host:

```bash
# Build a fixture tarball matching the layout REQUIRED_PATHS demands
fixture=/tmp/rox-design-fixture-payload
rm -rf "$fixture" && mkdir -p "$fixture"
mkdir -p "$fixture"/{app/prebundled/daemon,app/node_modules/better-sqlite3,app/node_modules/blake3-wasm,open-design/{bin,skills,design-systems,design-templates,prompt-templates},open-design-web-standalone/apps/web}
echo '{"appVersion":"0.7.0-fixture"}' > "$fixture/open-design-config.json"
touch "$fixture"/{app/prebundled/daemon/daemon-sidecar.mjs,app/prebundled/daemon/daemon-cli.mjs,app/prebundled/web-sidecar.mjs,open-design/bin/node,open-design-web-standalone/apps/web/server.js}
( cd "$fixture" && tar -czf /tmp/fixture.tar.gz . )
SHA=$(shasum -a 256 /tmp/fixture.tar.gz | awk '{print $1}')

# Run prepare in Mode 3
bun run rox-design:prepare -- --from-archive=/tmp/fixture.tar.gz --expected-sha256=$SHA --force

# Verify the gate is happy
bun run rox-design:payload:verify
```

Expected output: `archive SHA-256 verified: …` then `prepared Open Design 0.7.0-fixture runtime from archive at …`, then verifier prints OK.
