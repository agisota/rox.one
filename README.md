# ROX.ONE

Agent-native desktop terminal for working with the most powerful LLMs.

ROX.ONE is a beautiful, document-centric workspace for AI agents. Multi-session inbox, instant connections to any API or MCP server, fluid UI, no CLI required. Built on the Claude Agent SDK and the Pi SDK.

We build ROX.ONE with ROX.ONE.

## After R.11 history rewrite

**Visible coordination banner, keep until 2026-05-19 23:59 UTC.** Main history
was rewritten for the R.11 rebrand cleanup. Existing clones must realign before
new work:

```bash
git fetch origin --prune
git switch main
git reset --hard origin/main
```

Cherry-pick any local-only commits onto the new `main` after the reset.

## Install

> **Note on code signing.** ROX.ONE is currently distributed as ad-hoc-signed builds (no Apple Developer Program / Windows EV certificate). The install scripts below handle the OS trust prompts automatically and are the recommended path. Direct DMG/EXE downloads work too, but require a manual one-time bypass — see [Manual install fallback](#manual-install-fallback) below.

**macOS / Linux** — recommended (auto-handles macOS quarantine):

```bash
curl -fsSL https://app.rox.one/install-app.sh | bash
```

**Windows (PowerShell)** — recommended (auto-unblocks downloaded EXE):

```powershell
irm https://app.rox.one/install-app.ps1 | iex
```

**From source**

```bash
git clone https://github.com/agisota/rox.one.git
cd rox.one
bun install
bun run electron:start
```

The source tree lives at the repository root. To smoke-test the bundled CLI from
the checkout:

```bash
alias rox-cli="bun run $(pwd)/apps/cli/src/index.ts"
rox-cli ping
```

### Manual install fallback

If you prefer to download the installer directly from the [Releases](https://github.com/agisota/rox.one/releases/latest) page:

- **macOS:** double-clicking the `.dmg` will trigger Gatekeeper because the build is not notarized. Either:
  - **Right-click → Open** the first time, then click **Open** in the dialog, _or_
  - Run `xattr -dr com.apple.quarantine /Applications/ROX.ONE.app` after dragging it to Applications.
- **Windows:** SmartScreen will flag the unsigned `.exe`. Click **More info → Run anyway**.
- **Linux:** AppImage / `.deb` / `.rpm` work without bypasses; ensure FUSE is installed for AppImage.

## System Requirements

- **macOS:** Monterey 12.0 or newer (Monterey, Ventura, Sonoma, Sequoia, Tahoe). Apple silicon (arm64) and Intel (x64) are both supported.
- **Windows:** Windows 10 (1809) or newer; Windows 11 recommended. First launch shows a SmartScreen warning because builds are self-signed — click **More info → Run anyway** once.
- **Linux:** any glibc-based distribution with GTK 3 and `libnss3`. Native packages for Ubuntu 22.04+/24.04, Debian 12, Fedora 40 (DEB/RPM) plus an AppImage that runs on most distros. NixOS users can install via the bundled flake.

## Features

- Multi-session inbox with status workflow, flagging, and AI-named sessions
- Multiple providers — Anthropic, Google AI Studio, ChatGPT Plus, GitHub Copilot, OpenAI
- Sources — connect any MCP server, REST API, or local filesystem in one prompt
- Skills — specialized agent instructions per workspace
- Permission modes — Explore, Ask to Edit, Auto, with custom rules
- Background tasks, event-driven automations, cascading theme system
- Multi-file diff viewer
- Drag-drop attachments — images, PDFs, Office documents

## Quick Start

1. Launch the app
2. Pick a provider (Anthropic, Google, OpenAI, GitHub Copilot…)
3. Create a workspace
4. Add a source — just describe it ("add Linear", "add Slack")
5. Start a session

## Acknowledgements

ROX.ONE descends from the Apache-2.0 upstream at
https://github.com/lukilabs/rox-agents-oss. License and notice attribution
are preserved in [LICENSE](LICENSE), [NOTICE](NOTICE), and
[TRADEMARK.md](TRADEMARK.md).

## License

Apache 2.0 — see [LICENSE](LICENSE).
