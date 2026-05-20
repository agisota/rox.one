# Rox Design runtime payload

## What's here

Vendored Open Design 0.7.0 payload. This directory is populated at build/packaging
time by `bun run rox-design:prepare` and is not committed to git (except this
`README.md` and `NOTICES.md`).

Expected layout after preparation:

```text
apps/electron/resources/rox-design/
├─ NOTICES.md
├─ README.md
├─ open-design-config.json
├─ app/prebundled/daemon/daemon-sidecar.mjs
├─ app/prebundled/daemon/daemon-cli.mjs
├─ app/prebundled/web-sidecar.mjs
├─ open-design/bin/node
├─ open-design/skills/
├─ open-design/design-systems/
├─ open-design/design-templates/
├─ open-design/prompt-templates/
├─ open-design/frames/
└─ open-design-web-standalone/apps/web/server.js
```

The ROX main process (`RoxDesignRuntimeManager`) starts this payload lazily when
the user opens Rox Design. The payload is not a second desktop app and must not
include or run `Open Design.app`.

## Why vendored

See [ADR-T537a](../../../../docs/adr/T537a-vendored-fork-over-webview.md). Short
version: ROX must work offline, the CSS theming bridge (ADR-T537b) requires a
pinned HTML structure, and the managed-view pattern needs the payload served from
`file://` rather than a live network URL.

## Upstream sync procedure

Run this when adopting a new Open Design release:

1. Clone the upstream repository:
   ```bash
   git clone https://github.com/nexu-io/open-design.git /tmp/open-design
   ```

2. Check out the target version tag:
   ```bash
   cd /tmp/open-design && git checkout vX.Y.Z
   ```

3. Rsync the payload into the repo (excludes `.git`):
   ```bash
   rsync -a --delete --exclude='.git' \
     /tmp/open-design/ \
     /home/dev/craft/rox-one-terminal/apps/electron/resources/rox-design/
   ```

4. Update `NOTICES.md` — set `Vendored version`, `Vendored commit`, and
   `Vendored at`. Obtain the commit SHA with:
   ```bash
   git ls-remote https://github.com/nexu-io/open-design.git vX.Y.Z
   ```

5. Validate the payload:
   ```bash
   bun run rox-design:payload:verify
   ```

6. Run the full test suite, paying particular attention to visual regression:
   ```bash
   bun test
   bun run test:visual
   ```

7. Commit with a conventional message:
   ```
   chore(design): sync vendored Open Design to vX.Y.Z
   ```

## What you MUST NOT do

- **Do not edit files inside `apps/electron/resources/rox-design/` directly.**
  The payload is an upstream copy. Any edit will be silently overwritten on the
  next sync. See ADR-T537a.
- **Do not put theme overrides in the payload directory.** Theme overrides live in:
  `apps/electron/src/renderer/styles/rox-design-overrides.css`
  The bridge that applies them is documented in ADR-T537b.

## Renovate cadence

Renovate will file weekly issues for Open Design version bumps once PR #5b of the
T537 follow-up lands. Until then, track upstream releases manually at
https://github.com/nexu-io/open-design/releases.

## Bootstrap (local dev / packaging)

```bash
ROX_DESIGN_SOURCE_RESOURCES="/Applications/Open Design.app/Contents/Resources" \
  bun run rox-design:prepare -- --force
```

## Attribution

See `NOTICES.md` in this directory for the Apache-2.0 attribution notice required
by the Open Design license.
