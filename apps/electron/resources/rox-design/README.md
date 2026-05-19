# Rox Design runtime payload

This directory is intentionally kept out of git except for this README.

Release/local packaging must populate it with a pinned Open Design runtime before building ROX packages:

```bash
ROX_DESIGN_SOURCE_RESOURCES="/Applications/Open Design.app/Contents/Resources" \
  bun run rox-design:prepare -- --force
```

Expected payload layout after preparation:

```text
apps/electron/resources/rox-design/
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

The ROX main process starts this payload lazily when the user opens `Rox Design`.
The payload is not a second desktop app and should not include or run `Open Design.app`.
