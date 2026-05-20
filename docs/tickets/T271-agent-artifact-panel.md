# T271 - Agent artifact right panel

Status: TODO

## Summary

Add a Claude/Codex Artifacts-style right-side panel for agent outputs in chat. Artifacts are first-class session entities with version history, a Preview/Code switcher, sandboxed HTML rendering, and toolbar actions.

## Acceptance Criteria

- Chat can open a right-side resizable artifact panel without replacing the main conversation.
- Artifacts persist as separate session-scoped entities with `id`, `conversationId`, `type`, `title`, `content`, and `versions`.
- Agent edits update the active artifact and append versions instead of creating duplicate artifacts.
- Preview and Code modes are supported for HTML, Markdown, code, text, and JSON artifacts.
- HTML/interactive artifacts render only in a safe sandbox iframe that cannot reach app tokens, cookies, preload APIs, or the main application DOM.
- Toolbar actions exist for Copy, Download, Fullscreen, and Close.
- The panel uses existing shell sizing, spacing, and compact-mode behavior.
- Targeted shared, server-core, renderer, routing, and security tests pass.
