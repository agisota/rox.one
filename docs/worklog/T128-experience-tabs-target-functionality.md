# T128 - Experience Tabs Target Functionality Worklog

## Summary

Created the target operating specification for every button/control in the six
`Опыт` tabs. The document defines shared demo console behavior, per-tab user
flows, data flow, UX expectations, available functions, acceptance criteria, and
future hardening checkpoints.

## Files

- `docs/product/experience-tabs-target-functionality.md`
- `docs/tickets/T128-experience-tabs-target-functionality.md`
- `docs/worklog/T128-experience-tabs-target-functionality.md`

## Validation

| Command | Result |
|---|---|
| `bun run validate:docs` | PASS after adding the required `Status` line to the T128 ticket |
| `git diff --check` | PASS |
| `bun run electron:build` | PASS; Vite chunk-size warning only |
| `bun run electron:smoke` | PASS; Electron headless startup passed |
| `bun run electron:start` | PASS; ROX window revealed at 1400x900, WS client connected, 8 sessions loaded, known MCP sources include `byterover`, `exa`, `firecrawl`, `github`, `playwright`, `zai-mcp-server` |

## Remaining Risk

- Live dev launch still reports existing dev-mode warnings: bundled `uv` is
  absent from the generated dev runtime path but `uv` is available on `PATH`;
  Pi provider live refresh remains disabled by accepted dependency-risk policy;
  auto-update looks for `app-update.yml` in dev runtime. These did not block
  build, smoke, or local startup.
