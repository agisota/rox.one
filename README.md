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

**macOS / Linux**

```bash
curl -fsSL https://app.rox.one/install-app.sh | bash
```

**Windows (PowerShell)**

```powershell
irm https://app.rox.one/install-app.ps1 | iex
```

**From source**

```bash
git clone https://github.com/agisota/rox-one-terminal.git
cd rox-one-terminal
bun install
bun run electron:start
```

The source tree lives at `rox-one-terminal/`. To smoke-test the bundled CLI from
the checkout:

```bash
alias rox-cli="bun run $(pwd)/apps/cli/src/index.ts"
rox-cli ping
```

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
